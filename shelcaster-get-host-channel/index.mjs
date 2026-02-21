import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
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
    const { hostUserId } = event.pathParameters;

    if (!hostUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required field: hostUserId" }),
      };
    }

    // Get channel assignment for host
    const getAssignmentParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `host#${hostUserId}`,
        sk: 'channel#assignment',
      }),
    };

    const assignmentResult = await dynamoDBClient.send(new GetItemCommand(getAssignmentParams));
    
    if (!assignmentResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "No channel assigned to this host" }),
      };
    }

    const assignment = unmarshall(assignmentResult.Item);

    // Get full channel details
    const getChannelParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `channel#${assignment.channelId}`,
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        channelId: channel.channelId,
        channelArn: channel.channelArn,
        channelName: channel.channelName,
        playbackUrl: channel.playbackUrl,
        ingestEndpoint: channel.ingestEndpoint,
        state: channel.state,
        assignedAt: assignment.assignedAt,
        currentSessionId: channel.currentSessionId,
      }),
    };
  } catch (error) {
    console.error('Error getting host channel:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to get host channel",
        error: error.message,
      }),
    };
  }
};
