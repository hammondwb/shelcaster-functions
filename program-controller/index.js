/**
 * Shelcaster PROGRAM Controller
 *
 * Phase A: Polls SQS for SWITCH_SOURCE commands and updates DynamoDB
 *
 * This service:
 * 1. Reads LiveSession from DynamoDB to get RAW and PROGRAM stage ARNs
 * 2. Polls SQS for SWITCH_SOURCE commands
 * 3. Updates programState.activeVideoSource in DynamoDB
 * 4. Logs switching actions (actual video forwarding in Phase B)
 *
 * Note: Server-side video forwarding requires headless browser (Puppeteer)
 * which will be added in Phase B. For now, we update state only.
 */

import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const sqsClient = new SQSClient({ region: "us-east-1" });

const SESSION_ID = process.env.SESSION_ID;
const PROGRAM_COMMANDS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/124355640062/shelcaster-program-commands";

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
 * Update activeVideoSource in DynamoDB
 */
async function updateActiveVideoSource(sessionId, sourceId) {
  const params = {
    TableName: "shelcaster-app",
    Key: marshall({
      pk: `session#${sessionId}`,
      sk: 'info',
    }),
    UpdateExpression: 'SET programState.activeVideoSource = :source, updatedAt = :now',
    ExpressionAttributeValues: marshall({
      ':source': sourceId,
      ':now': new Date().toISOString(),
    }),
  };

  await dynamoDBClient.send(new UpdateItemCommand(params));
  console.log(`✓ Updated activeVideoSource to: ${sourceId}`);
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
 * Process a SWITCH_SOURCE command from SQS
 */
async function processMessage(message) {
  try {
    const body = JSON.parse(message.Body);
    console.log('Received command:', body);

    if (body.command === 'SWITCH_SOURCE') {
      console.log(`Switching video source to: ${body.sourceId}`);

      // Update DynamoDB
      await updateActiveVideoSource(body.sessionId, body.sourceId);

      // TODO Phase B: Actually switch video using headless browser
      console.log('TODO: Forward video from RAW stage to PROGRAM stage');

      // Delete message from queue
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: PROGRAM_COMMANDS_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }));

      console.log('✓ Command processed successfully');
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

/**
 * Main initialization
 */
async function initialize() {
  console.log('Initializing PROGRAM controller...');

  // 1. Get LiveSession from DynamoDB
  const session = await getSession(SESSION_ID);
  console.log('LiveSession loaded:', {
    sessionId: session.sessionId,
    rawStageArn: session.ivs?.rawStageArn,
    programStageArn: session.ivs?.programStageArn,
    activeVideoSource: session.programState?.activeVideoSource,
  });

  if (!session.ivs?.rawStageArn || !session.ivs?.programStageArn) {
    throw new Error('LiveSession missing RAW or PROGRAM stage ARNs');
  }

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

