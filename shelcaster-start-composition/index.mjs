import { IVSRealTimeClient, StartCompositionCommand } from "@aws-sdk/client-ivs-realtime";
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ivsClient = new IVSRealTimeClient({ region: "us-east-1" });
const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

const TABLE_NAME = "shelcaster-app";
const STORAGE_CONFIGURATION_ARN = process.env.STORAGE_CONFIGURATION_ARN;

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    // ── Extract showId from path parameters ──
    // API route: POST /shows/{showId}/start-composition
    const showId = event.pathParameters?.showId;

    if (!showId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId parameter" }),
      };
    }

    // ── Deterministic session resolution ──
    // Find most recent ACTIVE LiveSession for this showId
    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: "entityType-index",
      KeyConditionExpression: "entityType = :et",
      FilterExpression: "showId = :showId AND #st = :status",
      ExpressionAttributeNames: {
        "#st": "status", // reserved word
      },
      ExpressionAttributeValues: marshall({
        ":et": "liveSession",
        ":showId": showId,
        ":status": "ACTIVE",
      }),
    };

    const queryResult = await dynamoDBClient.send(new QueryCommand(queryParams));
    const activeSessions = (queryResult.Items || []).map(item => unmarshall(item));

    if (activeSessions.length === 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ message: "No active session. Host must Join Stage first." }),
      };
    }

    // Sort by createdAt DESC → pick newest
    activeSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (activeSessions.length > 1) {
      console.warn(
        `WARNING: ${activeSessions.length} ACTIVE sessions for showId=${showId}. ` +
        `Using newest: sessionId=${activeSessions[0].sessionId}, createdAt=${activeSessions[0].createdAt}`
      );
    }

    const session = activeSessions[0];
    const sessionId = session.sessionId;
    console.log(`Resolved showId=${showId} → sessionId=${sessionId}`);

    // ── Validate session has required IVS resources ──
    if (!session.ivs?.programStageArn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Session does not have a PROGRAM stage." }),
      };
    }

    if (!session.ivs?.programChannelArn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Session does not have a PROGRAM channel." }),
      };
    }

    // Guard: composition already running
    if (session.ivs?.compositionArn) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          message: "Composition already running for this session.",
          compositionArn: session.ivs.compositionArn,
        }),
      };
    }

    // ── Start composition on RAW stage (where host + callers publish) ──
    // Compose directly from RAW stage to PROGRAM channel
    // SINGLE = grid with no featured participant, gridGap 0.
    const compositionParams = {
      stageArn: session.ivs.rawStageArn,  // Changed from programStageArn to rawStageArn
      destinations: [
        {
          channel: {
            channelArn: session.ivs.programChannelArn,
            encoderConfigurationArn: process.env.ENCODER_CONFIGURATION_ARN || undefined,
          },
        },
        {
          s3: {
            storageConfigurationArn: STORAGE_CONFIGURATION_ARN,
            encoderConfigurationArns: process.env.ENCODER_CONFIGURATION_ARN
              ? [process.env.ENCODER_CONFIGURATION_ARN]
              : [],
          },
        },
      ],
      layout: {
        grid: {
          gridGap: 0,
          omitStoppedVideo: true,
          videoAspectRatio: "VIDEO",
          videoFillMode: "COVER",
        },
      },
    };

    console.log('Starting PROGRAM composition with params:', JSON.stringify(compositionParams, null, 2));

    const compositionResponse = await ivsClient.send(new StartCompositionCommand(compositionParams));
    const compositionArn = compositionResponse.composition.arn;

    console.log('PROGRAM composition started:', compositionArn);

    // ── Write compositionArn back to LiveSession ──
    const updateParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #ivs.#compositionArn = :compositionArn, #streaming.#isLive = :isLive, #recording.#isRecording = :isRecording, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#ivs': 'ivs',
        '#compositionArn': 'compositionArn',
        '#streaming': 'streaming',
        '#isLive': 'isLive',
        '#recording': 'recording',
        '#isRecording': 'isRecording',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':compositionArn': compositionArn,
        ':isLive': true,
        ':isRecording': true,
        ':updatedAt': new Date().toISOString(),
      }),
    };

    await dynamoDBClient.send(new UpdateItemCommand(updateParams));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        compositionArn,
        programStageArn: session.ivs.programStageArn,
        programChannelArn: session.ivs.programChannelArn,
        programPlaybackUrl: session.ivs.programPlaybackUrl,
        sessionId,
        message: 'PROGRAM composition started successfully',
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

