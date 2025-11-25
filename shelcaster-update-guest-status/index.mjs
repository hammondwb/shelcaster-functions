import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
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
    const { showId, guestId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { status } = body;

    if (!showId || !guestId || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required fields: showId, guestId, status" }),
      };
    }

    const now = new Date().toISOString();
    const updateExpressions = ['#status = :status'];
    const expressionAttributeNames = { '#status': 'status' };
    const expressionAttributeValues = { ':status': status };

    // Set timestamp based on status
    if (status === 'joined') {
      updateExpressions.push('#joinedAt = :joinedAt');
      expressionAttributeNames['#joinedAt'] = 'joinedAt';
      expressionAttributeValues[':joinedAt'] = now;
    } else if (status === 'left') {
      updateExpressions.push('#leftAt = :leftAt');
      expressionAttributeNames['#leftAt'] = 'leftAt';
      expressionAttributeValues[':leftAt'] = now;
    }

    const params = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: `guest#${guestId}`,
      }),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ guest: unmarshall(result.Attributes) }),
    };
  } catch (error) {
    console.error("Error updating guest status:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

