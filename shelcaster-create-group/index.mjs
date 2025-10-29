import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { userId, groupId } = event.pathParameters;
    const { ...rest } = JSON.parse(event.body);

    if (!userId || !groupId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing userId or groupId" }),
      };
    }

    const Item = {
      TableName: "shelcaster-app",
      Item: marshall({
        pk: `u#${userId}#groups`,
        sk: `g#${groupId}`,
        entityType: "group",
        programsCount: 0,
        ownerId: userId,
        groupId,
        ...rest,
      }),
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    };

    const createCommand = new PutItemCommand(Item);
    const groupItem = await dynamoDBClient.send(createCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Group item written successfully",
        groupItem: groupItem.Attributes,
      }),
    };
  } catch (error) {
    console.error("Error creating group:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};