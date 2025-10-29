
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient();

export const handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const params = {
    TableName: "shelcaster-app",
    FilterExpression: "begins_with(pk, :userPrefix) AND sk = :infoKey",
    ExpressionAttributeValues: {
      ":userPrefix": { S: "u#" },
      ":infoKey": { S: "info" },
    },
  };

  try {
    const data = await dynamoDBClient.send(new ScanCommand(params));

    const users = data.Items?.map(item => unmarshall(item)) || [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: users }),
    };
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error", error }),
    };
  }
};
