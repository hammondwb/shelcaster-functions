// Simple Virtual Participant that joins IVS stage and updates status
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

const VP_ID = process.env.VP_ID;
const SHOW_ID = process.env.SHOW_ID;
const STAGE_TOKEN = process.env.STAGE_TOKEN;
const TRACKLIST_URL = process.env.TRACKLIST_URL;

console.log('Starting Shelcaster Virtual Participant...');
console.log('VP_ID:', VP_ID);
console.log('SHOW_ID:', SHOW_ID);
console.log('Has Stage Token:', !!STAGE_TOKEN);
console.log('Tracklist URL:', TRACKLIST_URL);

async function updateStatus(status, additionalData = {}) {
  try {
    const params = {
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `show#${SHOW_ID}`,
        sk: 'vp#info',
      }),
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: marshall({
        ':status': status,
        ':updatedAt': new Date().toISOString(),
      }),
    };

    // Add additional data to update
    if (Object.keys(additionalData).length > 0) {
      Object.entries(additionalData).forEach(([key, value], index) => {
        params.UpdateExpression += `, #attr${index} = :val${index}`;
        params.ExpressionAttributeNames[`#attr${index}`] = key;
        params.ExpressionAttributeValues[`:val${index}`] = { S: value };
      });
    }

    await dynamoDBClient.send(new UpdateItemCommand(params));
    console.log(`Status updated to: ${status}`);
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

async function main() {
  try {
    // Update status to ACTIVE
    await updateStatus('ACTIVE');

    console.log('Virtual participant is now ACTIVE');
    console.log('Note: Full IVS stage integration requires WebRTC implementation');
    console.log('This is a simplified version that updates status only');

    // Keep the container running
    setInterval(() => {
      console.log('VP still running...');
    }, 30000); // Log every 30 seconds

    // Handle shutdown
    ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, shutting down...`);
        await updateStatus('STOPPED');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Error in main:', error);
    await updateStatus('ERROR', { error: error.message });
    process.exit(1);
  }
}

main();

