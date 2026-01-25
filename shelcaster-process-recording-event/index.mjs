import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const s3Client = new S3Client({ region: "us-east-1" });

const TABLE_NAME = "shelcaster-app";
const S3_BUCKET = "shelcaster-media-manager";

export const handler = async (event) => {
  console.log("Received IVS Recording Event:", JSON.stringify(event, null, 2));

  try {
    const detail = event.detail;
    const recordingStatus = detail.recording_status; // "Recording Start", "Recording End", "Recording Upload Complete"
    const channelArn = detail.channel_arn;
    const recordingS3KeyPrefix = detail.recording_s3_key_prefix;
    const recordingS3BucketName = detail.recording_s3_bucket_name;
    const recordingDurationMs = detail.recording_duration_ms;

    console.log(`Recording Status: ${recordingStatus}`);
    console.log(`Channel ARN: ${channelArn}`);
    console.log(`S3 Key Prefix: ${recordingS3KeyPrefix}`);

    // Only process when recording is complete
    if (recordingStatus !== "Recording End") {
      console.log("Ignoring event - not a Recording End event");
      return { statusCode: 200, body: "Event ignored" };
    }

    // Extract channel ID from ARN
    const channelId = channelArn.split('/').pop();

    // Find all recordings for this channel that are in "recording" status
    const recordings = await findActiveRecordingsForChannel(channelArn);

    if (recordings.length === 0) {
      console.log("No active recordings found for this channel");
      return { statusCode: 200, body: "No recordings to update" };
    }

    // Find the recording file in S3
    const s3Data = await findRecordingInS3(recordingS3KeyPrefix || `ivs-recordings/${channelId}`);

    if (!s3Data) {
      console.log("Recording file not found in S3 yet, setting status to processing");
      // Update all active recordings to "processing" status
      for (const recording of recordings) {
        await updateRecordingStatus(recording, "processing", null);
      }
      return { statusCode: 200, body: "Recording set to processing" };
    }

    // Update all active recordings with S3 data and set to "completed"
    for (const recording of recordings) {
      await updateRecordingStatus(recording, "completed", s3Data);
    }

    console.log(`Updated ${recordings.length} recording(s) to completed status`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Recording processed successfully", count: recordings.length })
    };

  } catch (error) {
    console.error("Error processing recording event:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error processing recording event", error: error.message })
    };
  }
};

async function findActiveRecordingsForChannel(channelArn) {
  // Scan all recordings to find ones with this channelArn and status "recording"
  // This is not ideal but necessary since we don't have a GSI on channelArn
  const recordings = [];
  
  // We need to query all shows and their recordings
  // For now, let's use a scan with filter (not ideal for production)
  const scanParams = {
    TableName: TABLE_NAME,
    FilterExpression: "channelArn = :channelArn AND #status = :status",
    ExpressionAttributeNames: {
      "#status": "status"
    },
    ExpressionAttributeValues: marshall({
      ":channelArn": channelArn,
      ":status": "recording"
    })
  };

  // Note: In production, you'd want to add a GSI on channelArn for better performance
  const { ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const result = await dynamoDBClient.send(new ScanCommand(scanParams));
  
  if (result.Items) {
    recordings.push(...result.Items.map(item => unmarshall(item)));
  }

  return recordings;
}

async function findRecordingInS3(prefix) {
  try {
    const listParams = {
      Bucket: S3_BUCKET,
      Prefix: prefix,
      MaxKeys: 100
    };

    const result = await s3Client.send(new ListObjectsV2Command(listParams));

    if (!result.Contents || result.Contents.length === 0) {
      return null;
    }

    // Find the master.m3u8 file
    const masterFiles = result.Contents.filter(obj => obj.Key.endsWith('master.m3u8'));
    
    if (masterFiles.length === 0) {
      return null;
    }

    // Use the most recent master file
    const masterFile = masterFiles[masterFiles.length - 1];

    return {
      s3Key: masterFile.Key,
      s3Bucket: S3_BUCKET,
      playbackUrl: `https://${S3_BUCKET}.s3.amazonaws.com/${masterFile.Key}`,
      size: masterFile.Size || 0
    };
  } catch (error) {
    console.error("Error finding recording in S3:", error);
    return null;
  }
}

async function updateRecordingStatus(recording, status, s3Data) {
  const now = new Date().toISOString();
  
  let updateExpression = 'SET #status = :status, #updatedAt = :updatedAt';
  const expressionAttributeNames = {
    '#status': 'status',
    '#updatedAt': 'updatedAt'
  };
  const expressionAttributeValues = {
    ':status': status,
    ':updatedAt': now
  };

  if (s3Data) {
    updateExpression += ', #s3Key = :s3Key, #s3Bucket = :s3Bucket, #playbackUrl = :playbackUrl, #size = :size';
    expressionAttributeNames['#s3Key'] = 's3Key';
    expressionAttributeNames['#s3Bucket'] = 's3Bucket';
    expressionAttributeNames['#playbackUrl'] = 'playbackUrl';
    expressionAttributeNames['#size'] = 'size';
    expressionAttributeValues[':s3Key'] = s3Data.s3Key;
    expressionAttributeValues[':s3Bucket'] = s3Data.s3Bucket;
    expressionAttributeValues[':playbackUrl'] = s3Data.playbackUrl;
    expressionAttributeValues[':size'] = s3Data.size;
  }

  const updateParams = {
    TableName: TABLE_NAME,
    Key: marshall({
      pk: recording.pk,
      sk: recording.sk
    }),
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: marshall(expressionAttributeValues),
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamoDBClient.send(new UpdateItemCommand(updateParams));
  console.log("Updated recording:", unmarshall(result.Attributes));
  
  return unmarshall(result.Attributes);
}

