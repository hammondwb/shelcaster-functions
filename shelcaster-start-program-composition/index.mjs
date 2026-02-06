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
    const { sessionId } = event.pathParameters;

    if (!sessionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing sessionId parameter" }),
      };
    }

    // Get LiveSession details
    const getSessionParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info',
      }),
    };

    const sessionResult = await dynamoDBClient.send(new GetItemCommand(getSessionParams));
    const session = sessionResult.Item ? unmarshall(sessionResult.Item) : null;

    if (!session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "LiveSession not found" }),
      };
    }

    if (!session.ivs?.programStageArn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "LiveSession does not have a PROGRAM stage" }),
      };
    }

    if (!session.ivs?.programChannelArn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "LiveSession does not have a PROGRAM channel" }),
      };
    }

    // Start composition on PROGRAM stage
    const compositionParams = {
      stageArn: session.ivs.programStageArn,
      destinations: [
        {
          channel: {
            channelArn: session.ivs.programChannelArn,
            encoderConfigurationArn: process.env.ENCODER_CONFIGURATION_ARN, // Optional
          },
        },
        {
          s3: {
            storageConfigurationArn: process.env.STORAGE_CONFIGURATION_ARN,
            encoderConfigurationArn: process.env.ENCODER_CONFIGURATION_ARN,
          },
        },
      ],
      layout: {
        grid: {
          featuredParticipantAttribute: "program",
          omitStoppedVideo: false,
          videoFillMode: "COVER",
        },
      },
    };

    console.log('Starting PROGRAM composition with params:', JSON.stringify(compositionParams, null, 2));

    const compositionResponse = await ivsClient.send(new StartCompositionCommand(compositionParams));
    const compositionArn = compositionResponse.composition.arn;

    console.log('PROGRAM composition started:', compositionArn);

    // Update LiveSession with composition ARN
    const updateSessionParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #ivs.#compositionArn = :compositionArn, #streaming.#isLive = :isLive, #streaming.#startedAt = :startedAt, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#ivs': 'ivs',
        '#compositionArn': 'compositionArn',
        '#streaming': 'streaming',
        '#isLive': 'isLive',
        '#startedAt': 'startedAt',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues': marshall({
        ':compositionArn': compositionArn,
        ':isLive': true,
        ':startedAt': new Date().toISOString(),
        ':updatedAt': new Date().toISOString(),
      }),
    };

    await dynamoDBClient.send(new UpdateItemCommand(updateSessionParams));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        compositionArn,
        programStageArn: session.ivs.programStageArn,
        programChannelArn: session.ivs.programChannelArn,
        programPlaybackUrl: session.ivs.programPlaybackUrl,
        message: 'PROGRAM composition started successfully',
      }),
    };
  } catch (error) {
    console.error('Error starting PROGRAM composition:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to start PROGRAM composition",
        error: error.message,
      }),
    };
  }
};

