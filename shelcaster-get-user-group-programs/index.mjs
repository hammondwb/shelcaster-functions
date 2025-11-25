import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dbClient = new DynamoDBClient();

export const handler = async (event) => {
  const { userId, groupId } = event.pathParameters;
  const { limit, lastKey } = event.queryStringParameters || {};
  const parsedLimit = limit ? +limit : 20;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const params = {
      TableName: "shelcaster-app",
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)",
      ExpressionAttributeValues: marshall({
        ":gsi1pk": `u#${userId}#g#${groupId}`,
        ":gsi1sk": `p#`,
      }),
      Limit: parsedLimit,
    };

    if (lastKey) {
      params.ExclusiveStartKey = marshall(JSON.parse(lastKey));
    }

    const command = new QueryCommand(params);
    const result = await dbClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        result: {
          ...result,
          Items: result.Items ? result.Items.map((item) => unmarshall(item)) : [],
          LastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(unmarshall(result.LastEvaluatedKey)) : null,
        },
      }),
    };
  } catch (error) {
    console.error("Error querying DynamoDB", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};