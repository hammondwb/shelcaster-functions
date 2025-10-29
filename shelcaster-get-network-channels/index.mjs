import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dbClient = new DynamoDBClient();

export const handler = async (event) => {
  const { networkId } = event.pathParameters;
  const { limit, lastKey, getByCustomOrder="false" } = event.queryStringParameters || {};
  const parsedLimit = limit ? +limit : 20;
  const doGetByCustomOrder = getByCustomOrder === "true";

  if (!networkId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "NetworkId is missing" }),
    }
  }

  try {
    const params = {
      TableName: "shelcaster-app",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: marshall({
        ":pk": `n#${networkId}#channels`,
        ":sk": `ch#`,
      }),
      Limit: parsedLimit,
    };

    // Check if we should use GSI2
    if (doGetByCustomOrder) {
      params.IndexName = "GSI2";
      params.KeyConditionExpression = "GSI2PK = :pk AND begins_with(GSI2SK, :sk)";
    } else {
      params.KeyConditionExpression = "pk = :pk AND begins_with(sk, :sk)";
    }

    if (lastKey) {
      params.ExclusiveStartKey = marshall(JSON.parse(lastKey));
    }

    const command = new QueryCommand(params);
    const result = await dbClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        Items: result.Items ? result.Items.map((item) => unmarshall(item)) : [],
        LastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(unmarshall(result.LastEvaluatedKey)) : null,
      }),
    };
  } catch (error) {
    console.error("Error querying DynamoDB", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};