import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const TABLE_NAME = "shelcaster-app";

export const handler = async (event) => {
  try {
    const { networkId, categoryId } = event.pathParameters;
    const { userWithAccess } = JSON.parse(event.body);

    if (!networkId || !categoryId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing networkId or categoryId" }),
      };
    }

    if (!userWithAccess || userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Missing user permissions to update network." }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Key: {
        pk: { S: `n#${networkId}#categories` },
        sk: { S: `cat#${categoryId}` },
      },
    };

    await client.send(new DeleteItemCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Item deleted successfully" }),
    };
  } catch (error) {
    console.error("Error deleting item:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
