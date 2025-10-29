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
    const { networkId, channelId, playlistId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { userWithAccess, ...rest } = body;

    if (!networkId || !channelId || !playlistId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing networkId, channelId or playlistId" }),
      };
    }

    if(userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Missing user permissions to update network." }),
      };
    }

    const params = {
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `n#${networkId}#ch#${channelId}#playlists`,
        sk: `pl#${playlistId}`,
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
        message: 'Playlist updated successfully',
        updatedUser: unmarshall(data.Attributes),
      }),
    };
  } catch (error) {
    console.error('Error updating playlist:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};