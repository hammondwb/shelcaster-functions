/**
 * IVS Recording Processor Lambda
 * 
 * Triggered by S3 events when IVS recording files are created.
 * Creates a program entry in DynamoDB and updates recording metadata.
 * Also syncs to Algolia for search.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { algoliasearch } from 'algoliasearch';
import { randomUUID } from 'crypto';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const s3Client = new S3Client({ region: 'us-east-1' });

const TABLE_NAME = 'shelcaster-app';
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || 'KF42QHSMVK';
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const ALGOLIA_INDEX_NAME = 'programs';

// IVS recording path format: ivs/v1/{account}/{channel_id}/{year}/{month}/{day}/{hour}/{recording_id}/media/hls/master.m3u8
// We trigger on the master.m3u8 file which indicates recording is complete

// SAFEGUARDS against recursive invocations:
// 1. Only process files matching IVS path pattern (starts with "ivs/")
// 2. Only process master.m3u8 files
// 3. Check if already processed before creating program entry
// 4. This Lambda does NOT write to S3, only reads - no recursive trigger possible

const IVS_PATH_PREFIX = 'ivs/';
const PROCESSED_CACHE = new Set(); // In-memory cache for this invocation

export const handler = async (event) => {
  console.log('S3 Event received:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    // SAFEGUARD 1: Only process IVS recording paths
    if (!key.startsWith(IVS_PATH_PREFIX)) {
      console.log('Skipping non-IVS path:', key);
      continue;
    }

    // SAFEGUARD 2: Only process master.m3u8 files (indicates complete recording)
    if (!key.endsWith('master.m3u8')) {
      console.log('Skipping non-master file:', key);
      continue;
    }

    // SAFEGUARD 3: Skip if already processed in this invocation (batch events)
    if (PROCESSED_CACHE.has(key)) {
      console.log('Already processed in this invocation:', key);
      continue;
    }
    PROCESSED_CACHE.add(key);

    console.log('Processing IVS recording:', { bucket, key });
    
    try {
      // Parse the IVS path to extract channel info
      // Format: ivs/v1/{account}/{channel_id}/{year}/{month}/{day}/{hour}/{recording_id}/media/hls/master.m3u8
      const pathParts = key.split('/');
      const channelId = pathParts[3]; // IVS channel ID
      const recordingId = pathParts[8]; // IVS recording ID
      
      // Find the show and user associated with this channel
      const showInfo = await findShowByChannel(channelId);
      
      if (!showInfo) {
        console.log('No show found for channel:', channelId);
        continue;
      }
      
      const { showId, showTitle, userId } = showInfo;

      // SAFEGUARD 4: Check if this recording was already processed
      const existingProgram = await findExistingProgramByS3Key(userId, key);
      if (existingProgram) {
        console.log('Recording already processed, skipping:', { key, existingProgramId: existingProgram.programId });
        continue;
      }

      // Get file size from S3
      const fileSize = await getRecordingSize(bucket, key);

      // Build the CloudFront URL for the recording
      const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN || 'd2jyqxlv5zply3.cloudfront.net';
      const playbackUrl = `https://${cloudfrontDomain}/${key}`;

      // Create program entry in DynamoDB
      const programId = randomUUID();
      const now = new Date().toISOString();

      const programItem = {
        pk: `u#${userId}#programs`,
        sk: `program#${programId}`,
        programId,
        title: `Recording: ${showTitle || 'Untitled Show'}`,
        description: `Recorded on ${new Date().toLocaleDateString()}`,
        broadcast_type: 'Video HLS',
        program_url: playbackUrl,
        program_image: null, // Could generate thumbnail later
        groupId: 'Recordings', // Default group for recordings
        premium: false,
        tags: ['recording', 'ivs'],
        created_date: now,
        createdAt: now,
        updatedAt: now,
        // Additional metadata
        sourceType: 'ivs-recording',
        sourceShowId: showId,
        ivsRecordingId: recordingId,
        s3Bucket: bucket,
        s3Key: key,
        fileSize,
      };

      // Save program to DynamoDB (with condition to prevent duplicates)
      await dynamoClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: programItem,
        ConditionExpression: 'attribute_not_exists(pk)', // Only create if doesn't exist
      }));
      
      console.log('Program created:', programId);
      
      // Update recording metadata if it exists
      await updateRecordingMetadata(showId, recordingId, {
        status: 'completed',
        s3Bucket: bucket,
        s3Key: key,
        size: fileSize,
        playbackUrl,
        programId, // Link to the program entry
      });
      
      // Sync to Algolia
      if (ALGOLIA_ADMIN_KEY) {
        await syncProgramToAlgolia(programItem);
      }
      
      console.log('Recording processed successfully:', { programId, showId, userId });
      
    } catch (error) {
      console.error('Error processing recording:', error);
      throw error;
    }
  }
  
  return { statusCode: 200, body: 'OK' };
};

// Find show by IVS channel ID
async function findShowByChannel(channelId) {
  // Query shows GSI to find show with matching channel
  const response = await dynamoClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    FilterExpression: 'contains(channelArn, :channelId)',
    ExpressionAttributeValues: {
      ':gsi1pk': 'SHOW',
      ':channelId': channelId,
    },
  }));
  
  if (response.Items && response.Items.length > 0) {
    const show = response.Items[0];
    // Extract userId from pk (format: producer#{userId})
    const userId = show.pk?.replace('producer#', '') || show.userId;
    return {
      showId: show.showId,
      showTitle: show.title || show.showTitle,
      userId,
      channelArn: show.channelArn,
    };
  }
  
  return null;
}

// Check if a program already exists for this S3 key (prevents duplicate processing)
async function findExistingProgramByS3Key(userId, s3Key) {
  try {
    // Query all programs for this user and filter by s3Key
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 's3Key = :s3Key',
      ExpressionAttributeValues: {
        ':pk': `u#${userId}#programs`,
        ':s3Key': s3Key,
      },
      Limit: 1,
    }));

    if (response.Items && response.Items.length > 0) {
      return response.Items[0];
    }
  } catch (error) {
    console.error('Error checking for existing program:', error);
  }

  return null;
}

// Get total size of recording files
async function getRecordingSize(bucket, masterKey) {
  try {
    // For now, just get the master.m3u8 size as a placeholder
    // In production, you'd list all .ts segments and sum their sizes
    const response = await s3Client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: masterKey,
    }));

    return response.ContentLength || 0;
  } catch (error) {
    console.error('Error getting recording size:', error);
    return 0;
  }
}

// Update recording metadata in DynamoDB
async function updateRecordingMetadata(showId, _ivsRecordingId, updates) {
  try {
    // Find the recording entry by showId
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `show#${showId}`,
        ':sk': 'recording#',
      },
      ScanIndexForward: false, // Get most recent first
      Limit: 1,
    }));

    if (response.Items && response.Items.length > 0) {
      const recording = response.Items[0];

      await dynamoClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: recording.pk, sk: recording.sk },
        UpdateExpression: 'SET #status = :status, s3Bucket = :bucket, s3Key = :key, #size = :size, playbackUrl = :url, programId = :programId, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#size': 'size',
        },
        ExpressionAttributeValues: {
          ':status': updates.status,
          ':bucket': updates.s3Bucket,
          ':key': updates.s3Key,
          ':size': updates.size,
          ':url': updates.playbackUrl,
          ':programId': updates.programId,
          ':now': new Date().toISOString(),
        },
      }));

      console.log('Recording metadata updated:', recording.sk);
    }
  } catch (error) {
    console.error('Error updating recording metadata:', error);
  }
}

// Sync program to Algolia
async function syncProgramToAlgolia(program) {
  try {
    const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);

    const algoliaRecord = {
      objectID: program.programId,
      programId: program.programId,
      title: program.title,
      description: program.description || '',
      broadcast_type: program.broadcast_type,
      premium: program.premium || false,
      tags: program.tags || [],
      created_date: program.created_date,
      groupId: program.groupId,
      groupName: program.groupId, // Will be 'Recordings'
      program_url: program.program_url,
      program_image: program.program_image,
      userId: program.pk.split('#')[1], // Extract userId from pk
      created_timestamp: new Date(program.created_date).getTime(),
    };

    await client.saveObjects({
      indexName: ALGOLIA_INDEX_NAME,
      objects: [algoliaRecord],
    });

    console.log('Synced to Algolia:', program.programId);
  } catch (error) {
    console.error('Error syncing to Algolia:', error);
  }
}

