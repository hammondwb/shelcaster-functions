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

  try {
    const { producerId } = event.pathParameters;
    const { limit, lastKey } = event.queryStringParameters || {};
    const parsedLimit = limit ? parseInt(limit) : 20;

    if (!producerId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing producerId parameter" }),
      };
    }

    const params = {
      TableName: "shelcaster-app",
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
      ExpressionAttributeValues: marshall({
        ":pk": `producer#${producerId}`,
        ":sk": "show#",
      }),
      Limit: parsedLimit,
      ScanIndexForward: false, // Most recent first
    };

    if (lastKey) {
      params.ExclusiveStartKey = marshall(JSON.parse(lastKey));
    }

    const result = await dynamoDBClient.send(new QueryCommand(params));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        Items: result.Items ? result.Items.map((item) => unmarshall(item)) : [],
        LastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(unmarshall(result.LastEvaluatedKey)) : null,
      }),
    };
  } catch (error) {
    console.error("Error getting producer shows:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

