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
    const { userId, networkId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { firstName, lastName, email, dob, ...rest } = body;
    console.log("Pathe parameters", userId, networkId);

    if (!userId || !networkId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing userId or networkId" }),
      };
    }

    const networkUserItem = {
      TableName: "shelcaster-app",
      Item: marshall({
        pk: `up#${userId}`,
        sk: `info#n#${networkId}`,
        firstName,
        lastName,
        dob,
        email,
        type: "user-profile",
        userId,
        entityType: `user-profile`,
        GSI1PK: `n#${networkId}`,
        GSI1SK: `up#${userId}`,
        networkId,
        ...rest,
      }),
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    };

    const command = new PutItemCommand(networkUserItem);
    await dynamoDBClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "User items written successfully",
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