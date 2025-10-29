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
    const { networkId, themeId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { userWithAccess, ...rest } = body;

    if (!networkId || !themeId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing networkId or themeId" }),
      };
    }

    if (!userWithAccess || userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Missing user permissions to update network." }),
      };
    }

    const params = {
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `n#${networkId}#themes`,
        sk: `th#${themeId}`,
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
        message: 'Theme updated successfully',
        updatedChannel: unmarshall(data.Attributes),
      }),
    };
  } catch (error) {
    console.error('Error updating theme:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};