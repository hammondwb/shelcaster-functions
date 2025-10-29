import { DynamoDBClient, GetItemCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dbClient = new DynamoDBClient();
const TABLE_NAME = "shelcaster-app";
const BATCH_SIZE = 25;
const MAX_PARALLEL_BATCHES = 4;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const getItem = async (networkId, channelId, playlistId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: marshall({
      pk: `n#${networkId}#ch#${channelId}#playlists`,
      sk: `pl#${playlistId}`
    })
  };

  const data = await dbClient.send(new GetItemCommand(params));
  return data.Item ? unmarshall(data.Item) : null;
};

export const handler = async (event) => {
  try {
    const { networkId, channelId } = event.pathParameters;
    const { playlistItems, userWithAccess } = JSON.parse(event.body);

    if (!networkId || !channelId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing networkId or channelId" })
      };
    }

    if (!Array.isArray(playlistItems) || playlistItems.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Invalid playlistItems" })
      };
    }

    if (!userWithAccess || userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Missing user permissions to update network." })
      };
    }

    const putRequests = [];
    for (const { playlistId, newOrder } of playlistItems) {
      const existingItem = await getItem(networkId, channelId, playlistId);
      if (!existingItem) {
        console.error(`Item not found for playlistId: ${playlistId}`);
        continue;
      }

      existingItem.GSI2PK = `n#${networkId}#ch#${channelId}#playlists`;
      existingItem.GSI2SK = `pl#o#${newOrder}#${playlistId}`;
      existingItem.customOrder = newOrder;

      putRequests.push({ PutRequest: { Item: marshall(existingItem) } });
    }

    if (putRequests.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ message: "No matching items found" }) };
    }

    const batchPromises = [];
    for (let i = 0; i < putRequests.length; i += BATCH_SIZE * MAX_PARALLEL_BATCHES) {
      const batches = [];
      for (let j = 0; j < MAX_PARALLEL_BATCHES; j++) {
        const start = i + (j * BATCH_SIZE);
        const end = start + BATCH_SIZE;
        const batchChunk = putRequests.slice(start, end);

        if (batchChunk.length > 0) {
          batches.push(
            dbClient.send(new BatchWriteItemCommand({ RequestItems: { [TABLE_NAME]: batchChunk } }))
          );
        }
      }
      if (batches.length > 0) {
        batchPromises.push(Promise.all(batches));
      }
    }

    await Promise.all(batchPromises);

    return { statusCode: 200, headers, body: JSON.stringify({ message: "Order updated successfully" }) };
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Internal server error", details: error.message }) };
  }
};
