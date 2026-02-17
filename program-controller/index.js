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
import { IVSRealTimeClient, CreateParticipantTokenCommand } from "@aws-sdk/client-ivs-realtime";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const sqsClient = new SQSClient({ region: "us-east-1" });
const ivsClient = new IVSRealTimeClient({ region: "us-east-1" });

const SESSION_ID = process.env.SESSION_ID;
const PROGRAM_COMMANDS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/124355640062/shelcaster-program-commands";

// Global state
let browser = null;
let page = null;
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
  console.log('[TOKEN] Creating participant token for playlist...');
  console.log('[TOKEN] Stage ARN:', stageArn);

  try {
    console.log('[TOKEN] Sending CreateParticipantTokenCommand...');
    const response = await ivsClient.send(new CreateParticipantTokenCommand({
      stageArn,
      userId: 'playlist-virtual-participant',
      attributes: {
        type: 'playlist',
        role: 'publisher',
        featured: 'true'  // Mark as featured so it appears full-screen in composition
      },
      capabilities: ['PUBLISH'],
      duration: 3600 // 1 hour
    }));
    
    console.log('[TOKEN] Response received');
    console.log('[TOKEN] Token length:', response.participantToken.token.length);
    console.log('[TOKEN] ✓ Participant token created successfully');
    return response.participantToken.token;
  } catch (error) {
    console.error('[TOKEN] ERROR creating token:', error.message);
    console.error('[TOKEN] Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * Initialize headless browser with IVS SDK
 */
async function initBrowser() {
  console.log('Launching headless browser...');
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });
    console.log('[BROWSER] Puppeteer launched');
    
    page = await browser.newPage();
    console.log('[BROWSER] New page created');
    
    // Enable console logging from browser
    page.on('console', msg => console.log('Browser:', msg.text()));
    page.on('pageerror', error => console.error('Browser error:', error));
    
    // Load the browser client HTML
    const htmlPath = `file://${join(__dirname, 'browser-client.html')}`;
    console.log('[BROWSER] Loading HTML from:', htmlPath);
    await page.goto(htmlPath, { waitUntil: 'networkidle0' });
    console.log('[BROWSER] HTML loaded successfully');
    
    console.log('[BROWSER] Browser initialization complete');
  } catch (error) {
    console.error('[BROWSER] Error during browser init:', error);
    throw error;
  }
}

/**
 * Join IVS stage via browser
 */
async function joinStage(participantToken) {
  console.log('[STAGE] Joining IVS stage via browser...');
  console.log('[STAGE] Token length:', participantToken?.length);
  
  try {
    const result = await page.evaluate(async (token) => {
      return await window.programController.joinStage(token);
    }, participantToken);
    
    console.log('[STAGE] Join result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      console.error('[STAGE] Join failed with error:', result.error);
      console.error('[STAGE] Stack trace:', result.stack);
      throw new Error(`Failed to join stage: ${result.error}`);
    }
    
    console.log('[STAGE] ✓ Successfully joined IVS stage');
  } catch (error) {
    console.error('[STAGE] Exception during joinStage:', error.message);
    console.error('[STAGE] Full error:', error);
    throw error;
  }
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
 */
async function playMedia(programId, mediaUrl, volume = 80) {
  console.log(`▶ Playing media: ${programId}`);
  console.log(`  URL: ${mediaUrl}`);
  console.log(`  Volume: ${volume}`);
  
  const volumeDecimal = volume / 100;
  
  const result = await page.evaluate(async (url, vol) => {
    return await window.programController.playMedia(url, vol);
  }, mediaUrl, volumeDecimal);
  
  if (!result.success) {
    throw new Error(`Failed to play media: ${result.error}`);
  }
  
  // Update state
  currentPlayback = {
    programId,
    mediaUrl,
    volume,
    isPlaying: true,
    startedAt: Date.now()
  };
  
  await updatePlaylistState(SESSION_ID, currentPlayback);
  console.log('✓ Media playback started');
}

/**
 * Pause media playback
 */
async function pauseMedia() {
  console.log('⏸ Pausing media');
  
  await page.evaluate(async () => {
    return await window.programController.pauseMedia();
  });
  
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
  
  await page.evaluate(async () => {
    return await window.programController.stopMedia();
  });
  
  currentPlayback = null;
  await updatePlaylistState(SESSION_ID, { isPlaying: false });
  console.log('✓ Media stopped');
}

/**
 * Adjust volume
 */
async function adjustVolume(volume) {
  console.log(`🔊 Adjusting volume to: ${volume}`);
  
  const volumeDecimal = volume / 100;
  
  await page.evaluate(async (vol) => {
    return await window.programController.adjustVolume(vol);
  }, volumeDecimal);
  
  if (currentPlayback) {
    currentPlayback.volume = volume;
    await updatePlaylistState(SESSION_ID, currentPlayback);
    console.log('✓ Volume adjusted');
  }
}

/**
 * Poll SQS for commands
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
        await playMedia(body.programId, body.mediaUrl, body.volume || 80);
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
 * Cleanup on exit
 */
async function cleanup() {
  console.log('Cleaning up...');
  
  if (page) {
    await page.evaluate(async () => {
      return await window.programController.leaveStage();
    });
  }
  
  if (browser) {
    await browser.close();
  }
  
  console.log('✓ Cleanup complete');
}

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

/**
 * Main initialization
 */
async function initialize() {
  try {
    console.log('[INIT] Step 1: Starting initialization...');
    
    // 1. Get LiveSession from DynamoDB
    console.log('[INIT] Step 2: Fetching session from DynamoDB...');
    const session = await getSession(SESSION_ID);
    console.log('[INIT] Step 3: Session fetched:', JSON.stringify(session, null, 2));

    if (!session.ivs?.rawStageArn) {
      throw new Error('LiveSession missing RAW stage ARN');
    }
    console.log('[INIT] Step 4: RAW stage ARN confirmed:', session.ivs.rawStageArn);

    // 2. Initialize headless browser
    console.log('[INIT] Step 5: Initializing browser...');
    await initBrowser();
    console.log('[INIT] Step 6: Browser initialized successfully');

    // 3. Create participant token
    console.log('[INIT] Step 7: Creating participant token...');
    const participantToken = await createPlaylistToken(session.ivs.rawStageArn);
    console.log('[INIT] Step 8: Participant token created');
    
    // 4. Join IVS stage
    console.log('[INIT] Step 9: Joining IVS stage...');
    await joinStage(participantToken);
    console.log('[INIT] Step 10: Successfully joined IVS stage');

    console.log('[INIT] Step 11: PROGRAM controller fully initialized');
    console.log('[INIT] Step 12: Starting SQS polling loop...');

    // Start polling SQS in a loop
    while (true) {
      await pollSQS();
    }
  } catch (error) {
    console.error('[INIT] FATAL ERROR at initialization:');
    console.error('[INIT] Error message:', error.message);
    console.error('[INIT] Error stack:', error.stack);
    console.error('[INIT] Full error object:', JSON.stringify(error, null, 2));
    throw error;
  }
}

// Start the controller
initialize().catch(async (error) => {
  console.error('Fatal error in PROGRAM controller:', error);
  await cleanup();
  process.exit(1);
});

