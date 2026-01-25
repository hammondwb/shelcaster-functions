import { DynamoDBClient, UpdateItemCommand, GetItemCommand, DeleteItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient();

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export const handler = async (event) => {

  try {
    const { userId, programId } = event.pathParameters;
    const { userWithAccess, ...rest } = JSON.parse(event.body);

    if (!userId || !programId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing userId or programId" }),
      };
    }

    // Check if groupId is being changed - if so, we need to delete and recreate
    // because GSI keys (GSI1PK, GSI1SK) cannot be updated
    if (rest.groupId) {
      // Get the existing program first
      const getCommand = new GetItemCommand({
        TableName: 'shelcaster-app',
        Key: marshall({
          pk: `u#${userId}#programs`,
          sk: `p#${programId}`,
        }),
      });

      const existingData = await dynamoDBClient.send(getCommand);

      if (!existingData.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: "Program not found" }),
        };
      }

      const existingProgram = unmarshall(existingData.Item);

      // Delete the old item
      const deleteCommand = new DeleteItemCommand({
        TableName: 'shelcaster-app',
        Key: marshall({
          pk: `u#${userId}#programs`,
          sk: `p#${programId}`,
        }),
      });

      await dynamoDBClient.send(deleteCommand);

      // Create new item with updated groupId and GSI keys
      const updatedProgram = {
        ...existingProgram,
        ...rest,
        groupId: rest.groupId,
        GSI1PK: `u#${userId}#g#${rest.groupId}`,
        GSI1SK: `p#${programId}`,
      };

      const putCommand = new PutItemCommand({
        TableName: 'shelcaster-app',
        Item: marshall(updatedProgram),
      });

      await dynamoDBClient.send(putCommand);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Program updated successfully (group changed)',
          updatedProgram,
        }),
      };
    }

    // If groupId is not being changed, use normal update
    const params = {
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `u#${userId}#programs`,
        sk: `p#${programId}`,
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
        message: 'Program updated successfully',
        updatedProgram: unmarshall(data.Attributes),
      }),
    };
  } catch (error) {
    console.error('Error updating program:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};