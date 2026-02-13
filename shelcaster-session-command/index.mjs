import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { MediaLiveClient, BatchUpdateScheduleCommand } from "@aws-sdk/client-medialive";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const mediaLiveClient = new MediaLiveClient({ region: "us-east-1" });

/**
 * Parse sourceId into structured format
 * @param {string} sourceId - Format: "participants" | "track:{trackId}"
 * @returns {{type: 'participants'|'track', id?: string}}
 */
function parseSourceId(sourceId) {
  if (sourceId === "participants") {
    return { type: 'participants' };
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
 * Map sourceId to MediaLive InputAttachmentNameReference
 * MVP: Only two inputs — "participants" (IVS Composition tiled grid) and "tracklist" (S3 HLS)
 * @param {string} sourceId - Format: "participants" | "track:{trackId}"
 * @returns {string} InputAttachmentName to switch to
 */
function mapSourceToInputAttachment(sourceId) {
  if (sourceId === 'participants') {
    return 'participants';
  }
  if (sourceId.startsWith('track:')) {
    return 'tracklist';
  }
  throw new Error(`Cannot map sourceId to input attachment: ${sourceId}`);
}

/**
 * Switch MediaLive channel input using BatchUpdateSchedule
 */
async function switchMediaLiveInput(channelId, sourceId) {
  const inputAttachmentName = mapSourceToInputAttachment(sourceId);

  const command = new BatchUpdateScheduleCommand({
    ChannelId: channelId,
    Creates: {
      ScheduleActions: [{
        ActionName: `switch-${inputAttachmentName}-${Date.now()}`,
        ScheduleActionSettings: {
          InputSwitchSettings: {
            InputAttachmentNameReference: inputAttachmentName
          }
        },
        ScheduleActionStartSettings: {
          ImmediateModeScheduleActionStartSettings: {}
        }
      }]
    }
  });

  console.log('Switching MediaLive input:', { channelId, sourceId, inputAttachmentName });

  const result = await mediaLiveClient.send(command);

  console.log('MediaLive schedule updated:', JSON.stringify(result, null, 2));

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

      // Switch MediaLive input via BatchUpdateSchedule
      const channelId = session.mediaLive?.channelId;
      if (!channelId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'MediaLive channel not found on session — is streaming started?' }),
        };
      }

      await switchMediaLiveInput(channelId, sourceId);

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

