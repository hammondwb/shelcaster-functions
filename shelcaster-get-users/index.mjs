import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient();

export const handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Use GSI to query by entityType - much more efficient than scan
  const baseParams = {
    TableName: "shelcaster-app",
    IndexName: "entityType-index",
    KeyConditionExpression: "entityType = :entityType",
    ExpressionAttributeValues: {
      ":entityType": { S: "user#creator" },
    },
  };

  try {
    // Handle pagination to get all users
    let allUsers = [];
    let lastEvaluatedKey = undefined;

    do {
      const params = {
        ...baseParams,
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const data = await dynamoDBClient.send(new QueryCommand(params));

      if (data.Items) {
        const users = data.Items.map(item => unmarshall(item));
        allUsers = allUsers.concat(users);
      }

      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Returning ${allUsers.length} users`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: allUsers }),
    };
  } catch (error) {
    console.error("DynamoDB query error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error", error }),
    };
  }
};
