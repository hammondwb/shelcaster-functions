import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient();

export const handler = async (event) => {
  const { userId } = event.pathParameters;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "Missing required parameters: userId.",
      }),
    };
  }

  const params = {
    TableName: "shelcaster-app",
    Key: marshall({
      pk: `u#${userId}`,
      sk: "info",
    }),
  };

  try {
    const data = await dynamoDBClient.send(new GetItemCommand(params));

    if (!data.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Item not found." }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: unmarshall(data.Item) }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error", error }),
    };
  }
};
