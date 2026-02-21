import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

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
    const { channelId, hostUserId } = event.pathParameters;

    if (!channelId || !hostUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required fields: channelId, hostUserId" }),
      };
    }

    // Delete channel assignment record
    const deleteParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `host#${hostUserId}`,
        sk: 'channel#assignment',
      }),
    };

    await dynamoDBClient.send(new DeleteItemCommand(deleteParams));

    console.log(`Channel ${channelId} unassigned from host ${hostUserId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Channel unassigned successfully',
        channelId,
        hostUserId,
      }),
    };
  } catch (error) {
    console.error('Error unassigning channel:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to unassign channel",
        error: error.message,
      }),
    };
  }
};
