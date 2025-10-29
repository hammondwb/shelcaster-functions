import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { userId, programId } = event.pathParameters;

    if (!userId || !programId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing userId, or programId." }),
      };
    }

    const params = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `u#${userId}#programs`,
        sk: `p#${programId}`,
      })
    };

    const command = new DeleteItemCommand(params);
    const Item = await client.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Item deleted successfully.",
        deletedItem: Item,
      }),
    };
  } catch (error) {
    console.error("Error deleting item:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to delete item.",
        error: error.message,
      }),
    };
  }
};