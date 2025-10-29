import { DynamoDBClient, BatchWriteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient();

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };

  try {
    const { networkId } = event.pathParameters;
    const { channelsItems, userWithAccess } = JSON.parse(event.body);
    const someChannelsHaveNoID = channelsItems.some(ch => !ch.channelId)
    const hasDuplicateChannelId = new Set(channelsItems.map(ch => ch.channelId)).size !== channelsItems.length;

    if (!networkId || !channelsItems) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing networkId or channelsItems array" }),
      };
    }

    if (!userWithAccess || userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Missing user permissions to update network." }),
      };
    }

    if (channelsItems.length > 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Network channels concurrent limit of 10 exceeded." }),
      };
    }

    if (someChannelsHaveNoID || hasDuplicateChannelId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "All Network channels must have a unique channelId." }),
      };
    }

    const getItemCommand = new GetItemCommand({
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `n#${networkId}`,
        sk: `info`,
      }),
    });

    const { Item } = await dynamoDBClient.send(getItemCommand);

    if (!Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "NetworkId not found" }),
      };
    }

    const channelRequests = channelsItems.map((channel) => ({
      PutRequest: {
        Item: marshall({
          pk: `n#${networkId}#channels`,
          sk: `ch#${channel.channelId}`,
          entityType: "channel",
          order: 0,
          ...channel,
          categories: channel.categories,
          categoriesIds: `cat#${channel?.categories.map(cat => cat.categoryId).join("#")}`,
        }),
      },
    }));

    const batchCommand = new BatchWriteItemCommand({
      RequestItems: {
        "shelcaster-app": channelRequests,
      },
    });

    await dynamoDBClient.send(batchCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Channels created successfully",
      }),
    };
  } catch (error) {
    console.error("Error creating channels:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message,
      }),
    };
  }
};