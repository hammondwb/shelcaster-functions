import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { IVSRealTimeClient, CreateStageCommand, CreateParticipantTokenCommand } from "@aws-sdk/client-ivs-realtime";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { randomUUID } from "crypto";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const ivsRealTimeClient = new IVSRealTimeClient({ region: "us-east-1" });
const ecsClient = new ECSClient({ region: "us-east-1" });

// Lazy load IVS client to avoid import issues
let ivsClient = null;
let IVSClient = null;
let CreateChannelCommand = null;

async function getIVSClient() {
  if (!ivsClient) {
    const ivsModule = await import("@aws-sdk/client-ivs");
    // Handle both ESM and CommonJS exports
    // Note: SDK v3 exports as IvsClient (not IVSClient)
    const IVSClientClass = ivsModule.IvsClient || ivsModule.IVSClient || ivsModule.default?.IvsClient;
    const CreateChannelCommandClass = ivsModule.CreateChannelCommand || ivsModule.default?.CreateChannelCommand;

    if (!IVSClientClass || !CreateChannelCommandClass) {
      throw new Error('Failed to load IVS SDK classes');
    }

    IVSClient = IVSClientClass;
    CreateChannelCommand = CreateChannelCommandClass;
    ivsClient = new IVSClient({ region: "us-east-1" });
  }
  return { ivsClient, CreateChannelCommand };
}

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const body = JSON.parse(event.body);
    const { showId, episodeId } = body;

    // Get authenticated user ID from Cognito authorizer
    // API Gateway JWT authorizer puts claims in event.requestContext.authorizer.jwt.claims
    const hostUserId = event.requestContext?.authorizer?.jwt?.claims?.sub ||
                       event.requestContext?.authorizer?.claims?.sub;

    console.log('Event requestContext:', JSON.stringify(event.requestContext, null, 2));
    console.log('Extracted hostUserId:', hostUserId);

    if (!showId || !hostUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "Missing required fields: showId, hostUserId",
          debug: {
            showId,
            hostUserId,
            authorizerPath: event.requestContext?.authorizer ? 'exists' : 'missing'
          }
        }),
      };
    }

    // Verify show exists
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

    const sessionId = randomUUID();
    const now = new Date().toISOString();

    // Create RAW stage (where host + callers publish)
    console.log('Creating RAW stage...');
    const rawStageParams = {
      name: `shelcaster-raw-${sessionId}`
    };
    const rawStageResponse = await ivsRealTimeClient.send(new CreateStageCommand(rawStageParams));
    const rawStageArn = rawStageResponse.stage.arn;
    console.log('RAW stage created:', rawStageArn);

    // Generate host participant token for RAW stage
    console.log('Generating host token for RAW stage...');
    const hostTokenResponse = await ivsRealTimeClient.send(new CreateParticipantTokenCommand({
      stageArn: rawStageArn,
      duration: 7200, // 2 hours
      capabilities: ['PUBLISH', 'SUBSCRIBE'],
      userId: `host-${hostUserId}`,
      attributes: {
        username: 'Host',
        role: 'host',
      },
    }));
    const hostToken = hostTokenResponse.participantToken.token;
    const hostParticipantId = hostTokenResponse.participantToken.participantId;
    console.log('Host token generated, participantId:', hostParticipantId);

    // Create PROGRAM stage (where virtual participant publishes program feed)
    console.log('Creating PROGRAM stage...');
    const programStageParams = {
      name: `shelcaster-program-${sessionId}`
    };
    const programStageResponse = await ivsRealTimeClient.send(new CreateStageCommand(programStageParams));
    const programStageArn = programStageResponse.stage.arn;
    console.log('PROGRAM stage created:', programStageArn);

    // Create PROGRAM channel (what viewers watch)
    console.log('Creating PROGRAM channel...');
    const { ivsClient: ivsChannelClient, CreateChannelCommand: CreateChannelCmd } = await getIVSClient();
    const channelResponse = await ivsChannelClient.send(new CreateChannelCmd({
      name: `shelcaster-program-${sessionId}`,
      type: 'STANDARD',
      latencyMode: 'LOW',
    }));
    const programChannelArn = channelResponse.channel.arn;
    const programPlaybackUrl = channelResponse.channel.playbackUrl;
    const programIngestEndpoint = channelResponse.channel.ingestEndpoint;
    console.log('PROGRAM channel created:', programChannelArn);
    console.log('PROGRAM playback URL:', programPlaybackUrl);

    // Start PROGRAM controller ECS task
    console.log('Starting PROGRAM controller ECS task...');
    const runTaskParams = {
      cluster: 'shelcaster-vp-cluster',
      taskDefinition: 'shelcaster-program-controller',
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ['subnet-0d18ba700259e4ef4', 'subnet-05734641b88638309'],
          assignPublicIp: 'ENABLED'
        }
      },
      overrides: {
        containerOverrides: [
          {
            name: 'program-controller',
            environment: [
              { name: 'SESSION_ID', value: sessionId },
              { name: 'RAW_STAGE_ARN', value: rawStageArn },
              { name: 'PROGRAM_STAGE_ARN', value: programStageArn },
              { name: 'COMMAND_QUEUE_URL', value: 'https://sqs.us-east-1.amazonaws.com/124355640062/shelcaster-program-commands' },
              { name: 'DDB_TABLE', value: 'shelcaster-app' },
              { name: 'REGION', value: 'us-east-1' }
            ]
          }
        ]
      }
    };

    let programControllerTaskArn = null;
    try {
      const runTaskResponse = await ecsClient.send(new RunTaskCommand(runTaskParams));
      programControllerTaskArn = runTaskResponse.tasks?.[0]?.taskArn || null;
      console.log('PROGRAM controller task started:', programControllerTaskArn);
    } catch (ecsError) {
      console.error('WARNING: Failed to start PROGRAM controller ECS task (session will still be created):', ecsError.message);
    }

    // Create LiveSession entity
    const liveSession = {
      pk: `session#${sessionId}`,
      sk: 'info',
      entityType: 'liveSession',
      sessionId,
      hostUserId,
      showId,
      episodeId: episodeId || null,
      ivs: {
        // RAW stage (host + callers publish here)
        rawStageArn,

        // PROGRAM stage (virtual participant publishes program feed here)
        programStageArn,

        // PROGRAM channel (viewers watch this)
        programChannelArn,
        programPlaybackUrl,

        // Composition ARN (will be set when composition starts)
        compositionArn: null,

        // Virtual participant ID on PROGRAM stage
        programParticipantId: `program-virtual-${sessionId}`,

        // PROGRAM controller ECS task ARN
        programControllerTaskArn,

        // Legacy fields (for backward compatibility with existing Show)
        stageArn: show.stageArn || null,
        channelArn: show.ivsChannelArn || null,
      },
      participants: {
        host: { participantId: null },
        callers: [],
      },
      programState: {
        activeVideoSource: "host",
        audioLevels: {
          host: 1.0,
        },
        overlayImageS3Key: null,
      },
      tracklist: {
        playlistId: show.tracklistId || null,
        currentIndex: 0,
      },
      streaming: {
        isLive: false,
        startedAt: null,
      },
      recording: {
        isRecording: false,
        s3Prefix: `sessions/${sessionId}/program/`,
      },
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };

    const params = {
      TableName: "shelcaster-app",
      Item: marshall(liveSession),
    };

    await dynamoDBClient.send(new PutItemCommand(params));

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'LiveSession created successfully',
        session: liveSession,
        // Host token for joining RAW stage (not persisted in DDB for security)
        hostToken,
        hostParticipantId,
      }),
    };
  } catch (error) {
    console.error('Error creating LiveSession:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to create LiveSession",
        error: error.message,
      }),
    };
  }
};

