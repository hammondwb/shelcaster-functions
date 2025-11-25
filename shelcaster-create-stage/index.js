const { IVSRealTime, CreateStageCommand, CreateParticipantTokenCommand } = require("@aws-sdk/client-ivs-realtime");
const { DynamoDBClient, UpdateItemCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const ivsRealTimeClient = new IVSRealTime({ region: "us-east-1" });
const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId } = event.pathParameters;
    const { userId } = JSON.parse(event.body || '{}');

    if (!showId || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId or userId parameter" }),
      };
    }

    // Get the show to check if it already has a stage
    const getShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
    };

    const showResult = await dynamoDBClient.send(new GetItemCommand(getShowParams));
    const show = showResult.Item ? unmarshall(showResult.Item) : null;

    if (!show) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Show not found" }),
      };
    }

    // If show already has a stage, return it with a new host token
    if (show.stageArn) {
      const hostTokenCommand = new CreateParticipantTokenCommand({
        stageArn: show.stageArn,
        duration: 7200, // 2 hours
        capabilities: ['PUBLISH', 'SUBSCRIBE'],
        userId: `host-${userId}`,
        attributes: {
          username: 'Host',
          role: 'host',
        },
      });

      const tokenResponse = await ivsRealTimeClient.send(hostTokenCommand);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          stageArn: show.stageArn,
          hostToken: tokenResponse.participantToken.token,
          participantId: tokenResponse.participantToken.participantId,
        }),
      };
    }

    // Create new IVS Real-Time Stage
    const createStageCommand = new CreateStageCommand({
      name: `shelcaster-${showId}`,
      participantTokenConfigurations: [
        {
          duration: 7200, // 2 hours
          capabilities: ['PUBLISH', 'SUBSCRIBE'],
          userId: `host-${userId}`,
          attributes: {
            username: 'Host',
            role: 'host',
          },
        },
      ],
    });

    const stageResponse = await ivsRealTimeClient.send(createStageCommand);
    const { stage, participantTokens } = stageResponse;

    // Update the show with stage information
    const updateShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #stageArn = :stageArn, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#stageArn': 'stageArn',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':stageArn': stage.arn,
        ':updatedAt': new Date().toISOString(),
      }),
      ReturnValues: 'ALL_NEW',
    };

    await dynamoDBClient.send(new UpdateItemCommand(updateShowParams));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        stageArn: stage.arn,
        hostToken: participantTokens[0].token,
        participantId: participantTokens[0].participantId,
      }),
    };
  } catch (error) {
    console.error('Error creating stage:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to create stage",
        error: error.message 
      }),
    };
  }
};

