
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient();

export const handler = async (event) => {
  const { userId, groupId } = event.pathParameters;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  if (!groupId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "Missing required parameters: networkId.",
      }),
    };
  }

  const params = {
    TableName: "shelcaster-app",
    Key: {
      pk: { S: `u#${userId}#groups` },
      sk: { S: `g#${groupId}` },
    },
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