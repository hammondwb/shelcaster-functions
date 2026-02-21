import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle OPTIONS preflight
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { channelId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { hostUserId } = body;

    // Get admin user ID from Cognito authorizer
    const adminUserId = event.requestContext?.authorizer?.jwt?.claims?.sub ||
                        event.requestContext?.authorizer?.claims?.sub;

    if (!channelId || !hostUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required fields: channelId, hostUserId" }),
      };
    }

    // Verify channel exists
    const getChannelParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `channel#${channelId}`,
        sk: 'info',
      }),
    };

    const channelResult = await dynamoDBClient.send(new GetItemCommand(getChannelParams));
    if (!channelResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Channel not found" }),
      };
    }

    const channel = unmarshall(channelResult.Item);
    const now = new Date().toISOString();

    // Create channel assignment record with denormalized channel data
    const assignmentRecord = {
      pk: `host#${hostUserId}`,
      sk: 'channel#assignment',
      entityType: 'channelAssignment',
      hostUserId,
      channelId,
      channelArn: channel.channelArn,
      playbackUrl: channel.playbackUrl,
      ingestEndpoint: channel.ingestEndpoint,
      streamKey: channel.streamKey, // Note: Should be encrypted in production
      assignedAt: now,
      assignedBy: adminUserId || 'system',
    };

    const putParams = {
      TableName: "shelcaster-app",
      Item: marshall(assignmentRecord),
    };

    await dynamoDBClient.send(new PutItemCommand(putParams));

    console.log(`Channel ${channelId} assigned to host ${hostUserId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Channel assigned successfully',
        assignment: {
          channelId,
          hostUserId,
          assignedAt: now,
        }
      }),
    };
  } catch (error) {
    console.error('Error assigning channel:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to assign channel",
        error: error.message,
      }),
    };
  }
};
