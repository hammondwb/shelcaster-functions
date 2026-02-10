/**
 * Shelcaster PROGRAM Controller
 *
 * Phase 2: Playlist Media Playback
 *
 * This service:
 * 1. Reads LiveSession from DynamoDB to get RAW stage ARN
 * 2. Creates participant token and joins RAW stage as virtual participant
 * 3. Polls SQS for PLAY_MEDIA, PAUSE_MEDIA, STOP_MEDIA commands
 * 4. Streams audio from S3 media files to IVS stage
 * 5. Updates playlistState in DynamoDB
 */

import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { IVSRealTimeClient, CreateParticipantTokenCommand } from "@aws-sdk/client-ivs-realtime";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const sqsClient = new SQSClient({ region: "us-east-1" });
const s3Client = new S3Client({ region: "us-east-1" });
const ivsClient = new IVSRealTimeClient({ region: "us-east-1" });

const SESSION_ID = process.env.SESSION_ID;
const PROGRAM_COMMANDS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/124355640062/shelcaster-program-commands";

// Global state
let stage = null;
let currentPlayback = null;

if (!SESSION_ID) {
  console.error('ERROR: SESSION_ID environment variable is required');
  process.exit(1);
}

console.log(`Starting PROGRAM controller for session: ${SESSION_ID}`);

/**
 * Get LiveSession from DynamoDB
 */
async function getSession(sessionId) {
  const params = {
    TableName: "shelcaster-app",
    Key: marshall({
      pk: `session#${sessionId}`,
      sk: 'info',
    }),
  };

  const result = await dynamoDBClient.send(new GetItemCommand(params));
  
  if (!result.Item) {
    throw new Error(`LiveSession not found: ${sessionId}`);
  }

  return unmarshall(result.Item);
}

/**
 * Create participant token for playlist virtual participant
 */
async function createPlaylistToken(stageArn) {
  console.log('Creating participant token for playlist...');
  
  const response = await ivsClient.send(new CreateParticipantTokenCommand({
    stageArn,
    userId: 'playlist-virtual-participant',
    attributes: {
      type: 'playlist',
      role: 'publisher'
    },
    capabilities: ['PUBLISH'],
    duration: 3600 // 1 hour
  }));
  
  console.log('✓ Participant token created');
  return response.participantToken.token;
}

/**
 * Update playlistState in DynamoDB
 */
async function updatePlaylistState(sessionId, playbackState) {
  const params = {
    TableName: "shelcaster-app",
    Key: marshall({
      pk: `session#${sessionId}`,
      sk: 'info',
    }),
    UpdateExpression: 'SET playlistState = :state, updatedAt = :now',
    ExpressionAttributeValues: marshall({
      ':state': playbackState,
      ':now': new Date().toISOString(),
    }),
  };

  await dynamoDBClient.send(new UpdateItemCommand(params));
  console.log(`✓ Updated playlistState:`, playbackState);
}

/**
 * Play media file
 * NOTE: Phase 2A logs only - actual IVS stage integration requires WebRTC in Node.js
 */
async function playMedia(programId, mediaUrl, volume = 80) {
  console.log(`▶ Playing media: ${programId}`);
  console.log(`  URL: ${mediaUrl}`);
  console.log(`  Volume: ${volume}`);
  
  // TODO: Implement actual audio streaming to IVS stage
  // This requires WebRTC support in Node.js (wrtc package or headless browser)
  console.log('TODO: Stream audio to IVS stage');
  
  // Update state
  currentPlayback = {
    programId,
    mediaUrl,
    volume,
    isPlaying: true,
    startedAt: Date.now()
  };
  
  await updatePlaylistState(SESSION_ID, currentPlayback);
  console.log('✓ Media playback started (state updated)');
}

/**
 * Pause media playback
 */
async function pauseMedia() {
  console.log('⏸ Pausing media');
  
  if (currentPlayback) {
    currentPlayback.isPlaying = false;
    await updatePlaylistState(SESSION_ID, currentPlayback);
    console.log('✓ Media paused');
  }
}

/**
 * Stop media playback
 */
async function stopMedia() {
  console.log('⏹ Stopping media');
  
  currentPlayback = null;
  await updatePlaylistState(SESSION_ID, { isPlaying: false });
  console.log('✓ Media stopped');
}

/**
 * Adjust volume
 */
async function adjustVolume(volume) {
  console.log(`🔊 Adjusting volume to: ${volume}`);
  
  if (currentPlayback) {
    currentPlayback.volume = volume;
    await updatePlaylistState(SESSION_ID, currentPlayback);
    console.log('✓ Volume adjusted');
  }
}

/**
 * Poll SQS for SWITCH_SOURCE commands
 */
async function pollSQS() {
  const params = {
    QueueUrl: PROGRAM_COMMANDS_QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20, // Long polling
    VisibilityTimeout: 30,
  };

  try {
    const result = await sqsClient.send(new ReceiveMessageCommand(params));

    if (result.Messages && result.Messages.length > 0) {
      for (const message of result.Messages) {
        await processMessage(message);
      }
    }
  } catch (error) {
    console.error('Error polling SQS:', error);
  }
}

/**
 * Process commands from SQS
 */
async function processMessage(message) {
  try {
    const body = JSON.parse(message.Body);
    console.log('Received command:', body);

    switch (body.command) {
      case 'PLAY_MEDIA':
        await playMedia(body.programId, body.mediaUrl, body.volume);
        break;
      
      case 'PAUSE_MEDIA':
        await pauseMedia();
        break;
      
      case 'STOP_MEDIA':
        await stopMedia();
        break;
      
      case 'ADJUST_VOLUME':
        await adjustVolume(body.volume);
        break;
      
      default:
        console.log(`Unknown command: ${body.command}`);
    }

    // Delete message from queue
    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: PROGRAM_COMMANDS_QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle,
    }));

    console.log('✓ Command processed successfully');
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

/**
 * Main initialization
 */
async function initialize() {
  console.log('Initializing PROGRAM controller (Phase 2)...');

  // 1. Get LiveSession from DynamoDB
  const session = await getSession(SESSION_ID);
  console.log('LiveSession loaded:', {
    sessionId: session.sessionId,
    rawStageArn: session.ivs?.rawStageArn,
  });

  if (!session.ivs?.rawStageArn) {
    throw new Error('LiveSession missing RAW stage ARN');
  }

  // 2. Create participant token
  const participantToken = await createPlaylistToken(session.ivs.rawStageArn);
  console.log('✓ Participant token obtained');
  
  // TODO: Join IVS stage (requires WebRTC in Node.js)
  console.log('TODO: Join RAW stage as virtual participant');
  console.log('  Stage ARN:', session.ivs.rawStageArn);
  console.log('  Token:', participantToken.substring(0, 20) + '...');

  console.log('✓ PROGRAM controller initialized');
  console.log('Starting SQS polling loop...');

  // Start polling SQS in a loop
  while (true) {
    await pollSQS();
  }
}

// Start the controller
initialize().catch((error) => {
  console.error('Fatal error in PROGRAM controller:', error);
  process.exit(1);
});

