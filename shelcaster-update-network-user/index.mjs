import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

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
    const { ...rest } = JSON.parse(event.body);

    if (!userId || !networkId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing userId and networkId" }),
      };
    }

    const params = {
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `up#${userId}`,
        sk: `info#n#${networkId}`,
      }),
      UpdateExpression: '',
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: marshall({}),
      ReturnValues: 'ALL_NEW',
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
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
        message: 'Network user updated successfully',
        updatedUser: unmarshall(data.Attributes),
      }),
    };
  } catch (error) {
    console.error('Error updating network user:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};