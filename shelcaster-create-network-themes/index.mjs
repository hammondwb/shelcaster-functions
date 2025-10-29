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
    const { themesItems, userWithAccess } = JSON.parse(event.body);
    const someThemesHaveNoID = themesItems.some(th => !th.themeId)
    const hasDuplicateThemeId = new Set(themesItems.map(th => th.themeId)).size !== themesItems.length;

    if (!networkId || !themesItems) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing networkId or themesItems array" }),
      };
    }

    if (!userWithAccess || userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Missing user permissions to update network." }),
      };
    }

    if (themesItems.length > 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "You can only add 10 network themes at a time." }),
      };
    }

    if (someThemesHaveNoID || hasDuplicateThemeId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "All Network themes must have a unique themeIds." }),
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

    const themeRequests = themesItems.map((theme) => ({
      PutRequest: {
        Item: marshall({
          pk: `n#${networkId}#themes`,
          sk: `th#${theme.themeId}`,
          entityType: "network-theme",
          ...theme,
        }),
      },
    }));

    const batchCommand = new BatchWriteItemCommand({
      RequestItems: {
        "shelcaster-app": themeRequests,
      },
    });

    await dynamoDBClient.send(batchCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Themes created successfully",
      }),
    };
  } catch (error) {
    console.error("Error creating themes:", error);
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