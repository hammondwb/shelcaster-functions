import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

const MAX_CHANNELS_PER_ACCOUNT = 20; // AWS default limit

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
    // Count current channels
    const countParams = {
      TableName: "shelcaster-app",
      IndexName: "entityType-index",
      KeyConditionExpression: "entityType = :type",
      ExpressionAttributeValues: marshall({
        ":type": "persistentChannel"
      }),
      Select: "COUNT"
    };

    const countResult = await dynamoDBClient.send(new QueryCommand(countParams));
    const currentCount = countResult.Count || 0;
    const remainingCapacity = MAX_CHANNELS_PER_ACCOUNT - currentCount;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        currentChannelCount: currentCount,
        maxChannelLimit: MAX_CHANNELS_PER_ACCOUNT,
        remainingCapacity,
        utilizationPercentage: ((currentCount / MAX_CHANNELS_PER_ACCOUNT) * 100).toFixed(2),
      }),
    };
  } catch (error) {
    console.error('Error getting channel capacity:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to get channel capacity",
        error: error.message,
      }),
    };
  }
};
