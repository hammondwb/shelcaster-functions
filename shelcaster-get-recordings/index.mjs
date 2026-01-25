import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const s3Client = new S3Client({ region: "us-east-1" });

const S3_BUCKET = "shelcaster-media-manager";

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId } = event.pathParameters || {};
    const { userId } = event.queryStringParameters || {};

    // If showId is provided, get recordings for that show
    if (showId) {
      return await getShowRecordings(showId, headers);
    }

    // If userId is provided, get all recordings for that user's shows
    if (userId) {
      return await getUserRecordings(userId, headers);
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Missing showId or userId parameter" }),
    };
  } catch (error) {
    console.error("Error getting recordings:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

async function getShowRecordings(showId, headers) {
  try {
    // Query DynamoDB for recording metadata
    const params = {
      TableName: "shelcaster-app",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": { S: `show#${showId}` },
        ":sk": { S: "recording#" }
      }
    };

    const result = await dynamoDBClient.send(new QueryCommand(params));
    let recordings = result.Items ? result.Items.map(item => unmarshall(item)) : [];

    // Enrich recordings with S3 data and playback URLs
    recordings = await Promise.all(recordings.map(async (recording) => {
      // If recording doesn't have S3 info yet, try to find it
      if (!recording.s3Key && recording.channelArn) {
        const channelId = recording.channelArn.split('/').pop();
        const s3Data = await findRecordingInS3(channelId, recording.startTime);
        if (s3Data) {
          recording.s3Key = s3Data.s3Key;
          recording.s3Bucket = s3Data.s3Bucket;
          recording.playbackUrl = s3Data.playbackUrl;
          recording.duration = s3Data.duration;
          recording.size = s3Data.size;
          recording.status = 'completed';
        }
      } else if (recording.s3Key && !recording.playbackUrl) {
        // Construct playback URL from S3 key
        recording.playbackUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${recording.s3Key}`;
      }
      return recording;
    }));

    // If no recordings in DB, check S3 for any recordings
    if (recordings.length === 0) {
      const s3Recordings = await scanS3ForRecordings(showId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          recordings: s3Recordings,
          source: 's3-scan'
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ recordings }),
    };
  } catch (error) {
    console.error("Error getting show recordings:", error);
    throw error;
  }
}

async function getUserRecordings(userId, headers) {
  try {
    // First, get all shows for this user
    const showsParams = {
      TableName: "shelcaster-app",
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": { S: `producer#${userId}` }
      }
    };

    const showsResult = await dynamoDBClient.send(new QueryCommand(showsParams));
    const shows = showsResult.Items ? showsResult.Items.map(item => unmarshall(item)) : [];

    // Get recordings for each show
    const allRecordings = [];
    for (const show of shows) {
      const recordingsParams = {
        TableName: "shelcaster-app",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": { S: `show#${show.showId}` },
          ":sk": { S: "recording#" }
        }
      };

      const recordingsResult = await dynamoDBClient.send(new QueryCommand(recordingsParams));
      const recordings = recordingsResult.Items ? recordingsResult.Items.map(item => unmarshall(item)) : [];
      
      allRecordings.push(...recordings.map(rec => ({
        ...rec,
        showTitle: show.title,
        showId: show.showId
      })));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ recordings: allRecordings }),
    };
  } catch (error) {
    console.error("Error getting user recordings:", error);
    throw error;
  }
}

async function findRecordingInS3(channelId, startTime) {
  try {
    // IVS recordings are stored in: ivs-recordings/{channel-id}/{year}/{month}/{day}/...
    const prefix = `ivs-recordings/${channelId}/`;

    const listParams = {
      Bucket: S3_BUCKET,
      Prefix: prefix,
      MaxKeys: 100
    };

    const result = await s3Client.send(new ListObjectsV2Command(listParams));

    if (!result.Contents || result.Contents.length === 0) {
      return null;
    }

    // Find the master.m3u8 file closest to the start time
    const masterFiles = result.Contents.filter(obj => obj.Key.endsWith('master.m3u8'));

    if (masterFiles.length === 0) {
      return null;
    }

    // Use the most recent master file (IVS creates one per recording session)
    const masterFile = masterFiles[masterFiles.length - 1];

    return {
      s3Key: masterFile.Key,
      s3Bucket: S3_BUCKET,
      playbackUrl: `https://${S3_BUCKET}.s3.amazonaws.com/${masterFile.Key}`,
      size: masterFile.Size || 0,
      duration: null // We don't have duration info from S3
    };
  } catch (error) {
    console.error('Error finding recording in S3:', error);
    return null;
  }
}

async function scanS3ForRecordings(showId) {
  try {
    // IVS recordings are stored in: ivs-recordings/{channel-id}/{year}/{month}/{day}/...
    // We need to scan the bucket for recordings related to this show
    const prefix = `ivs-recordings/`;

    const listParams = {
      Bucket: S3_BUCKET,
      Prefix: prefix,
      MaxKeys: 1000
    };

    const result = await s3Client.send(new ListObjectsV2Command(listParams));

    if (!result.Contents || result.Contents.length === 0) {
      return [];
    }

    // Group recordings by session (find master.m3u8 files)
    const recordings = [];
    const masterFiles = result.Contents.filter(obj => obj.Key.endsWith('master.m3u8'));

    for (const masterFile of masterFiles) {
      const recordingPath = masterFile.Key;
      const pathParts = recordingPath.split('/');
      
      recordings.push({
        recordingId: pathParts.slice(0, -2).join('/'), // Remove /media/hls/master.m3u8
        s3Key: recordingPath,
        s3Bucket: S3_BUCKET,
        size: masterFile.Size,
        lastModified: masterFile.LastModified,
        playbackUrl: `https://${S3_BUCKET}.s3.amazonaws.com/${recordingPath}`
      });
    }

    return recordings;
  } catch (error) {
    console.error("Error scanning S3 for recordings:", error);
    return [];
  }
}

