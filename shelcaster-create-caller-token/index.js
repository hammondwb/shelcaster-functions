const { IVSRealTime, CreateParticipantTokenCommand } = require("@aws-sdk/client-ivs-realtime");
const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
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
    const { callerName, callerId } = JSON.parse(event.body || '{}');

    if (!showId || !callerName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId or callerName parameter" }),
      };
    }

    // Get the show to get the stage ARN
    const getShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
    };

    const showResult = await dynamoDBClient.send(new GetItemCommand(getShowParams));
    const show = showResult.Item ? unmarshall(showResult.Item) : null;

    if (!show || !show.stageArn) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Show or stage not found" }),
      };
    }

    // Create participant token for caller
    const tokenCommand = new CreateParticipantTokenCommand({
      stageArn: show.stageArn,
      duration: 7200, // 2 hours
      capabilities: ['PUBLISH', 'SUBSCRIBE'],
      userId: callerId || `caller-${Date.now()}`,
      attributes: {
        username: callerName,
        role: 'caller',
      },
    });

    const tokenResponse = await ivsRealTimeClient.send(tokenCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token: tokenResponse.participantToken.token,
        participantId: tokenResponse.participantToken.participantId,
        stageArn: show.stageArn,
      }),
    };
  } catch (error) {
    console.error('Error creating caller token:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to create caller token",
        error: error.message 
      }),
    };
  }
};

