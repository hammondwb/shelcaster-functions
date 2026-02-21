import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
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
    const queryParams = event.queryStringParameters || {};
    const { state, limit = '50', nextToken } = queryParams;

    // Query channels using entityType GSI
    const queryCommandParams = {
      TableName: "shelcaster-app",
      IndexName: "entityType-index",
      KeyConditionExpression: "entityType = :type",
      ExpressionAttributeValues: marshall({
        ":type": "persistentChannel"
      }),
      Limit: parseInt(limit),
    };

    // Add state filter if provided
    if (state) {
      queryCommandParams.FilterExpression = "#state = :state";
      queryCommandParams.ExpressionAttributeNames = {
        "#state": "state"
      };
      queryCommandParams.ExpressionAttributeValues = marshall({
        ":type": "persistentChannel",
        ":state": state
      });
    }

    // Add pagination token if provided
    if (nextToken) {
      queryCommandParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const result = await dynamoDBClient.send(new QueryCommand(queryCommandParams));
    
    const channels = result.Items ? result.Items.map(item => {
      const channel = unmarshall(item);
      // Don't expose stream key in list view
      delete channel.streamKey;
      return channel;
    }) : [];

    const response = {
      channels,
      count: channels.length,
    };

    // Add next token if there are more results
    if (result.LastEvaluatedKey) {
      response.nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error listing channels:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to list channels",
        error: error.message,
      }),
    };
  }
};
