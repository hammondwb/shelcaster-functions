const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle OPTIONS request for CORS
  if (event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { showId } = event.pathParameters;

    // Handle GET request for status
    if (event.requestContext.http.method === 'GET') {
      const getVpParams = {
        TableName: "shelcaster-app",
        Key: marshall({
          pk: `show#${showId}`,
          sk: 'vp#info',
        }),
      };

      const vpResult = await dynamoDBClient.send(new GetItemCommand(getVpParams));
      const vp = vpResult.Item ? unmarshall(vpResult.Item) : null;

      if (!vp) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: "Virtual participant not found" }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          vpId: vp.vpId,
          showId: vp.showId,
          status: vp.status,
          taskArn: vp.taskArn,
          participantId: vp.participantId,
          error: vp.error,
          updatedAt: vp.updatedAt,
        }),
      };
    }

    const { action, trackUrl } = JSON.parse(event.body || '{}');

    if (!showId || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId or action parameter" }),
      };
    }

    // Get VP record from shelcaster-app table
    const getVpParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'vp#info',
      }),
    };

    const vpResult = await dynamoDBClient.send(new GetItemCommand(getVpParams));
    const vp = vpResult.Item ? unmarshall(vpResult.Item) : null;

    if (!vp) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Virtual participant not found" }),
      };
    }

    // For now, we'll store the command in DynamoDB
    // In production, you'd send this via WebSocket to the ECS container
    const updateParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'vp#info',
      }),
      UpdateExpression: 'SET #action = :action, #trackUrl = :trackUrl, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#action': 'lastAction',
        '#trackUrl': 'currentTrackUrl',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':action': action,
        ':trackUrl': trackUrl || vp.currentTrackUrl || null,
        ':updatedAt': new Date().toISOString(),
      }),
      ReturnValues: 'ALL_NEW',
    };

    const updateResult = await dynamoDBClient.send(new UpdateItemCommand(updateParams));
    const updatedVp = unmarshall(updateResult.Attributes);

    // TODO: Send command to VP via WebSocket/API Gateway WebSocket
    // For now, the VP will poll DynamoDB for commands

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Command ${action} sent to virtual participant`,
        vp: {
          vpId: updatedVp.vpId,
          showId: updatedVp.showId,
          status: updatedVp.status,
          lastAction: updatedVp.lastAction,
          currentTrackUrl: updatedVp.currentTrackUrl,
        },
      }),
    };
  } catch (error) {
    console.error('Error controlling virtual participant:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to control virtual participant",
        error: error.message 
      }),
    };
  }
};

