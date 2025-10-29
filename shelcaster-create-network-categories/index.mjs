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
  const { networkId } = event.pathParameters;
  const { categoriesItems, userWithAccess } = JSON.parse(event.body);
  const someCategoriesHaveNoID = categoriesItems.some((cat) => !cat.categoryId);

  if (!networkId || !Array.isArray(categoriesItems) || someCategoriesHaveNoID) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid networkId or categoriesItems data." }),
    };
  }

  if(userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ message: "Missing user permissions to update network." }),
    };
  }

  if (categoriesItems?.length > 25) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Network categories are limited to 25 items at a time." }),
    };
  }

  try {
    const writeRequests = categoriesItems.map((category) => ({
      PutRequest: {
        Item: marshall({
          pk: `n#${networkId}#categories`,
          sk: `cat#${category.categoryId}`,
          entityType: "network-category",
          categoryId: category.categoryId,
          dateCreated: new Date().toISOString(),
          ...category,
        }),
      },
    }));

    const command = new BatchWriteItemCommand({
      RequestItems: {
        [TABLE_NAME]: writeRequests,
      },
    });

    await ddbClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Category items were created successfully." }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to create items." }),
    };
  }
};