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

  try {
    const { tracklistId } = event.pathParameters;

    if (!tracklistId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing tracklistId parameter" }),
      };
    }

    const params = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `tracklist#${tracklistId}`,
        sk: 'info',
      }),
    };

    const result = await dynamoDBClient.send(new GetItemCommand(params));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Tracklist not found" }),
      };
    }

    const tracklist = unmarshall(result.Item);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ tracklist }),
    };
  } catch (error) {
    console.error("Error getting tracklist:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

