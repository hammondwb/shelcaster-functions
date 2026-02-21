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
    const { channelId } = event.pathParameters;

    if (!channelId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required field: channelId" }),
      };
    }

    // Get channel record
    const getParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `channel#${channelId}`,
        sk: 'info',
      }),
    };

    const result = await dynamoDBClient.send(new GetItemCommand(getParams));
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Channel not found" }),
      };
    }

    const channel = unmarshall(result.Item);

    // Return statistics
    const stats = {
      channelId: channel.channelId,
      channelName: channel.channelName,
      totalBroadcasts: channel.totalBroadcasts || 0,
      totalStreamingHours: ((channel.totalStreamingMinutes || 0) / 60).toFixed(2),
      totalStreamingMinutes: channel.totalStreamingMinutes || 0,
      lastBroadcastAt: channel.lastBroadcastAt || null,
      currentState: channel.state,
      createdAt: channel.createdAt,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stats),
    };
  } catch (error) {
    console.error('Error getting channel stats:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to get channel statistics",
        error: error.message,
      }),
    };
  }
};
