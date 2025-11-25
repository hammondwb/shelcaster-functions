import { DynamoDBClient, DeleteItemCommand, QueryCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { tracklistId } = event.pathParameters;

    if (!tracklistId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing tracklistId parameter" }),
      };
    }

    // First, get all programs in the tracklist
    const queryParams = {
      TableName: "shelcaster-app",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: marshall({
        ":pk": `tracklist#${tracklistId}`,
        ":sk": "program#",
      }),
    };

    const queryResult = await dynamoDBClient.send(new QueryCommand(queryParams));

    // Delete all programs in batches of 25
    if (queryResult.Items && queryResult.Items.length > 0) {
      const deleteRequests = queryResult.Items.map((item) => {
        const unmarshalled = unmarshall(item);
        return {
          DeleteRequest: {
            Key: marshall({
              pk: unmarshalled.pk,
              sk: unmarshalled.sk,
            }),
          },
        };
      });

      for (let i = 0; i < deleteRequests.length; i += 25) {
        const chunk = deleteRequests.slice(i, i + 25);
        const batchParams = {
          RequestItems: {
            "shelcaster-app": chunk,
          },
        };
        await dynamoDBClient.send(new BatchWriteItemCommand(batchParams));
      }
    }

    // Delete the tracklist itself
    const deleteParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `tracklist#${tracklistId}`,
        sk: 'info',
      }),
    };

    await dynamoDBClient.send(new DeleteItemCommand(deleteParams));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Tracklist deleted successfully" }),
    };
  } catch (error) {
    console.error("Error deleting tracklist:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

