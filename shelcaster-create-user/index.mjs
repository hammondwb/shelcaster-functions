import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient();

export const handler = async (event) => {

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { userId } = event.pathParameters;
    const { type, firstName, lastName, email, dob, ...rest } = JSON.parse(event.body);
    const entityType = type === "creator" ? "#creator" : "";
    let originalUser = null;

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing userId" }),
      };
    }

    const userItem = {
      TableName: "shelcaster-app",
      Item: marshall({
        pk: `u#${userId}`,
        sk: "info",
        firstName,
        lastName,
        dob: dob,
        email: email,
        type: type,
        userId,
        entityType: `user${entityType}`,
        ...rest,
      }),
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    };

    const command = new PutItemCommand(userItem);
    await dynamoDBClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "User item written successfully",
        userItem: unmarshall(userItem.Item),
      }),
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};