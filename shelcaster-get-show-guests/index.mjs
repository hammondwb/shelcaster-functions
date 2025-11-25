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
    const { showId } = event.pathParameters;

    if (!showId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId parameter" }),
      };
    }

    const params = {
      TableName: "shelcaster-app",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: marshall({
        ":pk": `show#${showId}`,
        ":sk": "guest#",
      }),
    };

    const result = await dynamoDBClient.send(new QueryCommand(params));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        guests: result.Items ? result.Items.map((item) => unmarshall(item)) : [],
      }),
    };
  } catch (error) {
    console.error("Error getting show guests:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

