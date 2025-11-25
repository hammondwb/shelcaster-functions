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
    const { showId } = event.pathParameters;
    const updates = JSON.parse(event.body);

    if (!showId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId parameter" }),
      };
    }

    // Fields that can be updated
    const allowedFields = [
      'title', 
      'description', 
      'scheduledStartTime', 
      'scheduledEndTime',
      'tracklistId',
      'status',
      'actualStartTime',
      'actualEndTime',
      'viewerCount',
      'peakViewerCount'
    ];

    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updates[key];
      }
    });

    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "No valid fields to update" }),
      };
    }

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const params = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
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
      body: JSON.stringify({ show: unmarshall(result.Attributes) }),
    };
  } catch (error) {
    console.error("Error updating show:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

