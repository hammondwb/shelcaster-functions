import { IVSRealTimeClient, StartCompositionCommand } from "@aws-sdk/client-ivs-realtime";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ivsClient = new IVSRealTimeClient({ region: "us-east-1" });
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

    if (!showId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId parameter" }),
      };
    }

    // Get show details
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

    if (!show.stageArn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Show does not have a stage. Create stage first." }),
      };
    }

    if (!show.ivsChannelArn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Show does not have an IVS channel. Create channel first." }),
      };
    }

    // Start composition
    const compositionParams = {
      stageArn: show.stageArn,
      destinations: [
        {
          channel: {
            channelArn: show.ivsChannelArn,
            encoderConfigurationArn: process.env.ENCODER_CONFIGURATION_ARN, // Optional
          },
        },
      ],
      layout: {
        grid: {
          featuredParticipantAttribute: "host", // Feature the host
        },
      },
    };

    console.log('Starting composition with params:', JSON.stringify(compositionParams, null, 2));

    const compositionResponse = await ivsClient.send(new StartCompositionCommand(compositionParams));
    const compositionArn = compositionResponse.composition.arn;

    console.log('Composition started:', compositionArn);

    // Update show with composition ARN
    const updateShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #compositionArn = :compositionArn, #status = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#compositionArn': 'compositionArn',
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':compositionArn': compositionArn,
        ':status': 'live',
        ':updatedAt': new Date().toISOString(),
      }),
    };

    await dynamoDBClient.send(new UpdateItemCommand(updateShowParams));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        compositionArn,
        stageArn: show.stageArn,
        channelArn: show.ivsChannelArn,
        playbackUrl: show.ivsPlaybackUrl,
        message: 'Composition started successfully',
      }),
    };
  } catch (error) {
    console.error('Error starting composition:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to start composition",
        error: error.message,
      }),
    };
  }
};

