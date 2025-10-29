
import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
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
  const { playlistPrograms, userWithAccess } = JSON.parse(event.body);
  console.log("creds", networkId, channelId, playlistId, playlistPrograms);
  console.log("UserWithAccess", userWithAccess);

  if (!networkId || !channelId || !playlistId || !Array.isArray(playlistPrograms)) {

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing networkId, channelId, playlistId or playlistPrograms." }),
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
    const writeRequests = playlistPrograms.map((program, index) => ({
      PutRequest: {
        Item: marshall({
          ...program,
          pk: `n#${networkId}#ch#${channelId}#pl#${playlistId}`,
          sk: `p#${program.programId}`,
          entityType: "network#playlist#program",
          GSI1PK: `p#${program.programId}`,
          GSI1SK: `n#${networkId}#ch#${channelId}#pl#${playlistId}`,
          programId: program.programId,
          playlistId,
          networkId,
          channelId,
          dateCreated: new Date().toISOString(),
          order: 0
        }),
      },
    }));

    const command = new BatchWriteItemCommand({
      RequestItems: {
        [TABLE_NAME]: writeRequests,
      },
    });

    await ddbClient.send(command);
    // console.log("record added", writeRequests);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: `Playlist programs were added successfully`, writeRequests }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to add programs to playlist." }),
    };
  }
};