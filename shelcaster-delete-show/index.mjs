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
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
    };

    await dynamoDBClient.send(new DeleteItemCommand(params));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Show deleted successfully" }),
    };
  } catch (error) {
    console.error("Error deleting show:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

