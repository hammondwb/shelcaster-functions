
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient();

export const handler = async (event) => {

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { networkId } = event.pathParameters;
    const { category="general" } = event.queryStringParameters || {};
    const { ...rest } = JSON.parse(event.body);

    if (!networkId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing networkId" }),
      };
    }

    const networkItem = {
      TableName: "shelcaster-app",
      Item: marshall({
        pk: `n#${networkId}`,
        sk: "info",
        entityType: "network",
        networkId,
        GSI1PK: "networks",
        GSI1SK: `cat#${category}#${networkId}`,
        category,
        totalUsersCount: 0,
        ...rest
      }),
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    };

    const createNetworkCommand = new PutItemCommand(networkItem);
    const Item = await dynamoDBClient.send(createNetworkCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Network item written successfully",
        networkItem: unmarshall(networkItem.Item),
      }),
    };
  } catch (error) {
    console.error("Error creating network:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};