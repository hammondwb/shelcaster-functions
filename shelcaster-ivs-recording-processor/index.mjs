/**
 * IVS Recording Processor Lambda
 *
 * Triggered by S3 events when IVS Real-Time composition recording files are created.
 * Creates a program entry in DynamoDB matching the Media Manager schema
 * (same format as shelcaster-export-recording / shelcaster-create-user-programs).
 * Also updates the recording entity and syncs to Algolia for search.
 *
 * IVS Real-Time composition S3 path format varies — we match by composition ID
 * found in the S3 key against compositionArn stored on LiveSession entities.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { algoliasearch } from 'algoliasearch';
import { randomUUID } from 'crypto';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const s3Client = new S3Client({ region: 'us-east-1' });

const TABLE_NAME = 'shelcaster-app';
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || 'KF42QHSMVK';
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const ALGOLIA_INDEX_NAME = 'programs';

// SAFEGUARDS against recursive invocations:
// 1. Only process master.m3u8 files (indicates recording is complete)
// 2. Check if already processed before creating program entry
// 3. This Lambda does NOT write to S3, only reads — no recursive trigger possible

const PROCESSED_CACHE = new Set(); // In-memory cache for this invocation

export const handler = async (event) => {
  console.log('S3 Event received:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    // SAFEGUARD 1: Only process master.m3u8 or multivariant.m3u8 files (indicates complete recording)
    if (!key.endsWith('master.m3u8') && !key.endsWith('multivariant.m3u8')) {
      console.log('Skipping non-manifest file:', key);
      continue;
    }

    // SAFEGUARD 2: Skip if already processed in this invocation (batch events)
    if (PROCESSED_CACHE.has(key)) {
      console.log('Already processed in this invocation:', key);
      continue;
    }
    PROCESSED_CACHE.add(key);

    console.log('Processing IVS recording:', { bucket, key });

    try {
      // Find the session and show associated with this recording
      // IVS Real-Time composition paths contain the composition ID as a path segment.
      // We match path segments against compositionArn stored on LiveSession entities.
      const pathSegments = key.split('/');
      const sessionInfo = await findSessionForRecording(pathSegments);

      if (!sessionInfo) {
        console.log('No session found for recording path:', key);
        console.log('Path segments tried:', pathSegments);
        continue;
      }

      const { showId, sessionId } = sessionInfo;

      // Get the show for groupId, producerId, title
      const show = await getShow(showId);
      if (!show) {
        console.log('No show found for showId:', showId);
        continue;
      }

      const { producerId, groupId, title: showTitle } = show;

      if (!groupId) {
        console.log('Show does not have a groupId (Media Manager group). Skipping:', showId);
        continue;
      }

      // SAFEGUARD 3: Check if this recording was already processed
      const existingProgram = await findExistingProgramByS3Key(producerId, key);
      if (existingProgram) {
        console.log('Recording already processed, skipping:', { key, existingProgramId: existingProgram.programId });
        continue;
      }

      // Get file size from S3
      const fileSize = await getRecordingSize(bucket, key);

      // Build the CloudFront URL for the recording
      const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN || 'd2kyyx47f0bavc.cloudfront.net';
      const playbackUrl = `https://${cloudfrontDomain}/${key}`;

      // Create program entry matching Media Manager schema exactly
      // (same structure as shelcaster-export-recording / shelcaster-create-user-programs)
      const programId = randomUUID();
      const now = new Date().toISOString();

      const programItem = {
        pk: `u#${producerId}#programs`,
        sk: `p#${programId}`,
        entityType: 'program',
        GSI1PK: `u#${producerId}#g#${groupId}`,
        GSI1SK: `p#${programId}`,
        groupId,
        ownerId: producerId,
        programId,
        title: `${showTitle || 'Untitled Show'} - Recording`,
        description: `Recorded on ${new Date().toLocaleDateString()}`,
        broadcast_type: 'Video HLS',
        program_url: playbackUrl,
        program_image: null,
        premium: false,
        duration: 0,
        tags: ['recording', 'ivs'],
        created_date: now,
        createdAt: now,
        updatedAt: now,
        sourceType: 'ivs-recording',
        sourceShowId: showId,
        s3Bucket: bucket,
        s3Key: key,
        fileSize,
      };

      // Save program to DynamoDB
      await dynamoClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: programItem,
      }));

      console.log('Program created:', programId);

      // Increment programsCount on the group (matches shelcaster-export-recording)
      await dynamoClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: `u#${producerId}#groups`, sk: `g#${groupId}` },
        UpdateExpression: 'SET programsCount = if_not_exists(programsCount, :zero) + :one, updatedAt = :now',
        ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': now },
      }));

      // Update recording metadata if it exists
      await updateRecordingMetadata(showId, {
        status: 'completed',
        s3Bucket: bucket,
        s3Key: key,
        size: fileSize,
        playbackUrl,
        programId,
      });

      // Sync to Algolia
      if (ALGOLIA_ADMIN_KEY) {
        await syncProgramToAlgolia(programItem);
      }

      console.log('Recording processed successfully:', { programId, showId, producerId, groupId });

    } catch (error) {
      console.error('Error processing recording:', error);
      throw error;
    }
  }

  return { statusCode: 200, body: 'OK' };
};

/**
 * Find the LiveSession that owns this recording by matching path segments
 * against compositionArn or channelArn stored on sessions.
 *
 * IVS Real-Time composition S3 paths contain the composition ID as a segment.
 * We query all live sessions and check if any compositionArn or channelArn
 * matches a segment in the S3 key.
 */
async function findSessionForRecording(pathSegments) {
  try {
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'entityType-index',
      KeyConditionExpression: 'entityType = :et',
      ExpressionAttributeValues: { ':et': 'liveSession' },
    }));

    if (!response.Items || response.Items.length === 0) return null;

    for (const session of response.Items) {
      const ivs = session.ivs || {};

      // Try matching by compositionArn (extract ID after last '/')
      if (ivs.compositionArn) {
        const compId = ivs.compositionArn.split('/').pop();
        if (compId && pathSegments.includes(compId)) {
          console.log('Matched session by compositionArn:', session.sessionId);
          return { showId: session.showId, sessionId: session.sessionId };
        }
      }

      // Fallback: try matching by programChannelArn
      const channelArn = ivs.programChannelArn || ivs.channelArn;
      if (channelArn) {
        const channelId = channelArn.split('/').pop();
        if (channelId && pathSegments.includes(channelId)) {
          console.log('Matched session by channelArn:', session.sessionId);
          return { showId: session.showId, sessionId: session.sessionId };
        }
      }
    }
  } catch (error) {
    console.error('Error finding session for recording:', error);
  }

  return null;
}

// Get show details by showId
async function getShow(showId) {
  try {
    const response = await dynamoClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `show#${showId}`, sk: 'info' },
    }));
    return response.Item || null;
  } catch (error) {
    console.error('Error getting show:', error);
    return null;
  }
}

// Check if a program already exists for this S3 key (prevents duplicate processing)
async function findExistingProgramByS3Key(producerId, s3Key) {
  try {
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 's3Key = :s3Key',
      ExpressionAttributeValues: {
        ':pk': `u#${producerId}#programs`,
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
async function updateRecordingMetadata(showId, updates) {
  try {
    // Find the most recent recording entry for this show
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `show#${showId}`,
        ':sk': 'recording#',
      },
      ScanIndexForward: false, // Most recent first
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
      program_url: program.program_url,
      program_image: program.program_image,
      ownerId: program.ownerId,
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

