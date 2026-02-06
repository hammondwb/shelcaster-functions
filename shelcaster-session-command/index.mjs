import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const sqsClient = new SQSClient({ region: "us-east-1" });

const PROGRAM_COMMANDS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/124355640062/shelcaster-program-commands";

// Feature flag for IVS composition updates (0 = stub, 1 = apply)
const APPLY_IVS = parseInt(process.env.APPLY_IVS || '0');

/**
 * Parse sourceId into structured format
 * @param {string} sourceId - Format: "host" | "caller:{participantId}" | "track:{trackId}"
 * @returns {{type: 'host'|'caller'|'track', id?: string}}
 */
function parseSourceId(sourceId) {
  if (sourceId === "host") {
    return { type: 'host' };
  }
  
  if (sourceId.startsWith("caller:")) {
    const id = sourceId.substring(7); // Remove "caller:" prefix
    if (!id) {
      throw new Error("Invalid caller sourceId: missing participantId");
    }
    return { type: 'caller', id };
  }
  
  if (sourceId.startsWith("track:")) {
    const id = sourceId.substring(6); // Remove "track:" prefix
    if (!id) {
      throw new Error("Invalid track sourceId: missing trackId");
    }
    return { type: 'track', id };
  }
  
  throw new Error(`Unknown sourceId format: ${sourceId}`);
}

/**
 * Send SWITCH_SOURCE command to PROGRAM controller via SQS
 */
async function sendProgramCommand(sessionId, sourceId) {
  const messageId = randomUUID();
  const message = {
    sessionId,
    command: "SWITCH_SOURCE",
    sourceId,
    timestamp: new Date().toISOString(),
    messageId,
  };

  const params = {
    QueueUrl: PROGRAM_COMMANDS_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      sessionId: {
        DataType: 'String',
        StringValue: sessionId,
      },
      command: {
        DataType: 'String',
        StringValue: 'SWITCH_SOURCE',
      },
    },
  };

  console.log('Sending PROGRAM command to SQS:', JSON.stringify(message, null, 2));

  const result = await sqsClient.send(new SendMessageCommand(params));

  console.log('SQS message sent:', result.MessageId);

  return result;
}

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { sessionId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { action, sourceId } = body;

    // Get authenticated user ID from Cognito authorizer
    // API Gateway JWT authorizer puts claims in event.requestContext.authorizer.jwt.claims
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub ||
                   event.requestContext?.authorizer?.claims?.sub;

    console.log('Event requestContext:', JSON.stringify(event.requestContext, null, 2));
    console.log('Extracted userId:', userId);

    if (!sessionId || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required fields: sessionId, action" }),
      };
    }

    // Get LiveSession from DynamoDB
    const getSessionParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info',
      }),
    };

    const sessionResult = await dynamoDBClient.send(new GetItemCommand(getSessionParams));
    const session = sessionResult.Item ? unmarshall(sessionResult.Item) : null;

    if (!session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "LiveSession not found" }),
      };
    }

    // Validate ownership: authenticated userId must equal LiveSession.hostUserId
    console.log('Ownership validation:', { userId, hostUserId: session.hostUserId, match: userId === session.hostUserId });
    if (userId !== session.hostUserId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          message: "Forbidden: You are not the host of this session",
          debug: {
            userId,
            hostUserId: session.hostUserId
          }
        }),
      };
    }

    // Validate session state: must be ACTIVE
    if (session.status !== "ACTIVE") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: `Session is not active (status: ${session.status})` }),
      };
    }

    // Handle SWITCH_SOURCE command
    if (action === "SWITCH_SOURCE") {
      if (!sourceId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "Missing sourceId for SWITCH_SOURCE action" }),
        };
      }

      // Parse and validate sourceId format
      let parsedSource;
      try {
        parsedSource = parseSourceId(sourceId);
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: error.message }),
        };
      }

      // Check idempotency: if already set to this source, return current state
      if (session.programState.activeVideoSource === sourceId) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            message: 'Source already active (idempotent)',
            programState: session.programState,
          }),
        };
      }

      // Update LiveSession.programState in DynamoDB
      const updateParams = {
        TableName: "shelcaster-app",
        Key: marshall({
          pk: `session#${sessionId}`,
          sk: 'info',
        }),
        UpdateExpression: 'SET #programState.#activeVideoSource = :sourceId, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#programState': 'programState',
          '#activeVideoSource': 'activeVideoSource',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: marshall({
          ':sourceId': sourceId,
          ':updatedAt': new Date().toISOString(),
        }),
        ReturnValues: 'ALL_NEW',
      };

      const updateResult = await dynamoDBClient.send(new UpdateItemCommand(updateParams));
      const updatedSession = unmarshall(updateResult.Attributes);

      // Send SWITCH_SOURCE command to PROGRAM controller via SQS
      await sendProgramCommand(sessionId, sourceId);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Source switched successfully',
          programState: updatedSession.programState,
        }),
      };
    }

    // Unknown action
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: `Unknown action: ${action}` }),
    };

  } catch (error) {
    console.error('Error processing session command:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to process command",
        error: error.message,
      }),
    };
  }
};

