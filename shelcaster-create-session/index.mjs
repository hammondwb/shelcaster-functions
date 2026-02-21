import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
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

    // Look up host's persistent channel
    console.log('Looking up persistent channel for host:', hostUserId);
    const getChannelParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `host#${hostUserId}`,
        sk: 'channel#assignment',
      }),
    };

    const channelResult = await dynamoDBClient.send(new GetItemCommand(getChannelParams));
    
    if (!channelResult.Item) {
      console.error('No channel assigned to host:', hostUserId);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          message: "No channel assigned to your account. Please contact support.",
          hostUserId 
        }),
      };
    }

    const channelAssignment = unmarshall(channelResult.Item);
    const persistentChannelId = channelAssignment.channelId;
    console.log('Found persistent channel:', persistentChannelId);

    // Get full channel details to check state
    const getChannelInfoParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `channel#${persistentChannelId}`,
        sk: 'info',
      }),
    };

    const channelInfoResult = await dynamoDBClient.send(new GetItemCommand(getChannelInfoParams));
    
    if (!channelInfoResult.Item) {
      console.error('Channel record not found:', persistentChannelId);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          message: "Channel configuration error. Please contact support.",
          channelId: persistentChannelId
        }),
      };
    }

    const persistentChannel = unmarshall(channelInfoResult.Item);
    console.log('Persistent channel state:', persistentChannel.state);

    // Validate channel is available
    if (persistentChannel.state === 'LIVE') {
      console.error('Channel already in use:', persistentChannelId);
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ 
          message: "Channel is currently in use. Please try again later.",
          channelId: persistentChannelId,
          currentSessionId: persistentChannel.currentSessionId
        }),
      };
    }

    if (persistentChannel.state === 'OFFLINE') {
      console.error('Channel is offline:', persistentChannelId);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ 
          message: "Channel is temporarily unavailable. Please contact support.",
          channelId: persistentChannelId
        }),
      };
    }

    // Update channel state to LIVE
    console.log('Updating channel state to LIVE');
    const updateChannelParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `channel#${persistentChannelId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #state = :state, currentSessionId = :sessionId, updatedAt = :now',
      ExpressionAttributeNames: {
        '#state': 'state'
      },
      ExpressionAttributeValues: marshall({
        ':state': 'LIVE',
        ':sessionId': sessionId,
        ':now': now
      })
    };

    await dynamoDBClient.send(new UpdateItemCommand(updateChannelParams));
    console.log('Channel state updated to LIVE');

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

    // Create RELAY channel (temporary channel for composition output)
    console.log('Creating RELAY channel for composition...');
    const { ivsClient: ivsChannelClient, CreateChannelCommand: CreateChannelCmd } = await getIVSClient();
    const relayChannelResponse = await ivsChannelClient.send(new CreateChannelCmd({
      name: `shelcaster-relay-${sessionId}`,
      type: 'STANDARD',
      latencyMode: 'LOW',
    }));
    const relayChannelArn = relayChannelResponse.channel.arn;
    const relayPlaybackUrl = relayChannelResponse.channel.playbackUrl;
    const relayIngestEndpoint = relayChannelResponse.channel.ingestEndpoint;
    console.log('RELAY channel created:', relayChannelArn);
    console.log('RELAY playback URL:', relayPlaybackUrl);

    // Start PROGRAM controller ECS task
    console.log('Starting PROGRAM controller ECS task...');
    const runTaskParams = {
      cluster: 'shelcaster-cluster',
      taskDefinition: 'shelcaster-program-controller:12',
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
              { name: 'SESSION_ID', value: sessionId }
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
        // Persistent channel (what viewers watch - static playback URL)
        persistentChannelId,
        persistentChannelArn: persistentChannel.channelArn,
        persistentPlaybackUrl: persistentChannel.playbackUrl,
        persistentIngestEndpoint: persistentChannel.ingestEndpoint,

        // RAW stage (host + callers publish here)
        rawStageArn,

        // PROGRAM stage (virtual participant publishes program feed here)
        programStageArn,

        // RELAY channel (temporary channel for composition output)
        relayChannelArn,
        relayPlaybackUrl,
        relayIngestEndpoint,

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
        // Persistent channel info for frontend
        persistentChannel: {
          channelId: persistentChannelId,
          channelArn: persistentChannel.channelArn,
          playbackUrl: persistentChannel.playbackUrl,
          ingestEndpoint: persistentChannel.ingestEndpoint,
        },
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

