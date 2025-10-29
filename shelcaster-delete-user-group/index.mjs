
import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient();

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { userId, groupId } = event.pathParameters;

    if (!userId || !groupId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing userId or groupId" }),
      };
    }

    const deleteCommand = new DeleteItemCommand({
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `u#${userId}#groups`,
        sk: `g#${groupId}`,
      }),
    });

    await dynamoDBClient.send(deleteCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Item deleted successfully" }),
    };
  } catch (error) {
    console.error("Error deleting item:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};
