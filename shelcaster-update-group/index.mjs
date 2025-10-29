import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  const { userId, groupId } = event.pathParameters;
  const { ...rest } = JSON.parse(event.body);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {

    if (!userId || !groupId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing userId or groupId" }),
      };
    }

    const params = {
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `u#${userId}#groups`,
        sk: `g#${groupId}`,
      }),
      UpdateExpression: '',
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: marshall({}),
      ReturnValues: 'ALL_NEW',
      ConditionExpression: 'attribute_exists(pk)'
    };

    const updateExpressionParts = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    for (const [key, value] of Object.entries(rest)) {
      const attributeName = `#${key}`;
      const attributeValue = `:${key}`;

      updateExpressionParts.push(`${attributeName} = ${attributeValue}`);
      expressionAttributeNames[attributeName] = key;
      expressionAttributeValues[attributeValue] = value;
    }

    params.UpdateExpression = `SET ${updateExpressionParts.join(', ')}`;
    params.ExpressionAttributeNames = expressionAttributeNames;
    params.ExpressionAttributeValues = marshall(expressionAttributeValues);

    const updateCommand = new UpdateItemCommand(params);
    const data = await dynamoDBClient.send(updateCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Group updated successfully',
        updatedGroup: unmarshall(data.Attributes),
      }),
    };
  } catch (error) {
    console.error('Error updating group:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};