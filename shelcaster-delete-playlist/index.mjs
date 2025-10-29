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
    const { networkId, channelId, playlistId } = event.pathParameters;
    const { userWithAccess } = JSON.parse(event.body);

    if (!networkId || !channelId || !playlistId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing networkId, channelId or playlistId" }),
      };
    }

    if (!userWithAccess || userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Missing user permissions to update network." }),
      };
    }

    const deleteCommand = new DeleteItemCommand({
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `n#${networkId}#ch#${channelId}#playlists`,
        sk: `pl#${playlistId}`,
      }),
    });

    await dynamoDBClient.send(deleteCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Playlist deleted successfully" }),
    };
  } catch (error) {
    console.error("Error deleting playlist:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};
