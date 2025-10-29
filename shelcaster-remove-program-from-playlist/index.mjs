import { DynamoDBClient, PutItemCommand, DeleteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient();

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { networkId, channelId, playlistId, programId } = event.pathParameters;

    if (!networkId || !channelId || !playlistId || !programId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required path parameters" }),
      };
    }

    // Fetch existing item
    const getItemParams = {
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `n#${networkId}#ch#${channelId}#pl#${playlistId}`,
        sk: `p#${programId}`
      })
    };

    const getItemCommand = new GetItemCommand(getItemParams);
    const getItemResponse = await dynamoDBClient.send(getItemCommand);

    if (!getItemResponse.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Item not found" }),
      };
    }

    const existingItem = unmarshall(getItemResponse.Item);

    // Define new keys
    const newPk = `n#${networkId}#programs`;
    const newSk = `p#${programId}`;

    // Step 1: Insert the new item
    const putParams = {
      TableName: 'shelcaster-app',
      Item: marshall({
        ...existingItem,
        pk: newPk,
        sk: newSk,
        GSI1PK: `p#${programId}`,
        GSI1SK: `n#${networkId}#programs`,
        entityType: "network#program",
        playlistId: null,
      })
    };

    const putCommand = new PutItemCommand(putParams);
    await dynamoDBClient.send(putCommand);

    // Step 2: Delete the old item
    const deleteParams = {
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: existingItem.pk,
        sk: existingItem.sk
      })
    };

    const deleteCommand = new DeleteItemCommand(deleteParams);
    await dynamoDBClient.send(deleteCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Program was removed from playlist successfully" }),
    };
  } catch (error) {
    console.error("Error updating item:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};
