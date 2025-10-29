import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const ddbClient = new DynamoDBClient();
const TABLE_NAME = "shelcaster-app";

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export const handler = async (event) => {
  const { networkId, channelId, playlistId } = event.pathParameters;
  const { playlist, playlistPrograms, userWithAccess } = JSON.parse(event.body);
  console.log("playlistPrograms from request", playlistPrograms);

  if (!networkId || !channelId || !playlistId || !Array.isArray(playlistPrograms)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid input data." }),
    };
  }

  if (!userWithAccess || userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ message: "Missing user permissions to update network." }),
    };
  }

  if (playlistPrograms.length > 25) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Playlist Programs uploads is limited to 25 items at a time." }),
    };
  }

  try {
    const PlaylistItem = {
      Put: {
        TableName: TABLE_NAME,
        Item: marshall({
          pk: `n#${networkId}#ch#${channelId}#playlists`,
          sk: `pl#${playlistId}`,
          entityType: "playlist",
          playlistId,
          networkId,
          channelId,
          dateCreated: new Date().toISOString(),
          order: 0,
          ...playlist,
        }),
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    }
  
    const ProgramItems = playlistPrograms.map((program, index) => ({
      Put: {
        TableName: TABLE_NAME,
        Item: marshall({
          pk: `n#${networkId}#ch#${channelId}#pl#${playlistId}`,
          sk: `p#${program.programId}`,
          entityType: "network#playlist#program",
          GSI1PK: `p#${program.programId}`,
          GSI1SK: `n#${networkId}#ch#${channelId}#pl#${playlistId}`,
          playlistId,
          networkId,
          channelId,
          dateCreated: new Date().toISOString(),
          ...program
        }),
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    }));

    const transactionItems = [PlaylistItem, ...ProgramItems];
    // console.log("Transaction Items", transactionItems);

    const command = new TransactWriteItemsCommand({
      TransactItems: transactionItems,
    });

    await ddbClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Playlist was created and programs were added successfully." }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error }),//"Failed to create items."
    };
  }
};