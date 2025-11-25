const { IVSRealTime, StartCompositionCommand } = require("@aws-sdk/client-ivs-realtime");
const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
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

    if (!showId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId parameter" }),
      };
    }

    // Get the show to get stage ARN and IVS channel ARN
    const getShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
    };

    const showResult = await dynamoDBClient.send(new GetItemCommand(getShowParams));
    const show = showResult.Item ? unmarshall(showResult.Item) : null;

    if (!show || !show.stageArn || !show.ivsChannelArn) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Show, stage, or IVS channel not found" }),
      };
    }

    // Start composition to stream stage output to IVS channel
    const compositionCommand = new StartCompositionCommand({
      stageArn: show.stageArn,
      destinations: [
        {
          channel: {
            channelArn: show.ivsChannelArn,
            // Optional: Add encoder configuration
            encoderConfigurationArn: process.env.ENCODER_CONFIG_ARN,
          },
        },
      ],
      layout: {
        grid: {
          featuredParticipantAttribute: 'role', // Feature the host
        },
      },
      // Optional: Add custom layout configuration
      // You can customize how participants are arranged
    });

    const compositionResponse = await ivsRealTimeClient.send(compositionCommand);
    const { composition } = compositionResponse;

    // Update the show with composition ARN
    const updateShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #compositionArn = :compositionArn, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#compositionArn': 'compositionArn',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':compositionArn': composition.arn,
        ':updatedAt': new Date().toISOString(),
      }),
      ReturnValues: 'ALL_NEW',
    };

    await dynamoDBClient.send(new UpdateItemCommand(updateShowParams));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        compositionArn: composition.arn,
        state: composition.state,
      }),
    };
  } catch (error) {
    console.error('Error starting composition:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to start composition",
        error: error.message 
      }),
    };
  }
};

