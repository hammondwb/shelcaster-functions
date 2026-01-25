import { DynamoDBClient, PutItemCommand, UpdateItemCommand, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId, recordingId } = event.pathParameters || {};
    const body = JSON.parse(event.body || '{}');
    const { action, channelArn, s3Key, s3Bucket, duration, size } = body;

    if (!showId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId parameter" }),
      };
    }

    // Start recording
    if (action === 'start') {
      return await startRecording(showId, channelArn, headers);
    }

    // Stop recording
    if (action === 'stop' && recordingId) {
      return await stopRecording(showId, recordingId, { s3Key, s3Bucket, duration, size }, headers);
    }

    // Update recording metadata (called after IVS finishes processing)
    if (action === 'update' && recordingId) {
      return await updateRecording(showId, recordingId, { s3Key, s3Bucket, duration, size }, headers);
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid action or missing parameters" }),
    };
  } catch (error) {
    console.error("Error managing recording:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

async function startRecording(showId, channelArn, headers) {
  try {
    const recordingId = randomUUID();
    const now = new Date().toISOString();

    const recording = {
      pk: `show#${showId}`,
      sk: `recording#${now}#${recordingId}`,
      entityType: 'recording',
      recordingId,
      showId,
      channelArn: channelArn || null,
      status: 'recording',
      startTime: now,
      endTime: null,
      duration: null,
      s3Bucket: null,
      s3Key: null,
      size: null,
      createdAt: now,
      updatedAt: now,
    };

    const params = {
      TableName: "shelcaster-app",
      Item: marshall(recording),
    };

    await dynamoDBClient.send(new PutItemCommand(params));

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ recording }),
    };
  } catch (error) {
    console.error("Error starting recording:", error);
    throw error;
  }
}

async function stopRecording(showId, recordingId, metadata, headers) {
  try {
    const now = new Date().toISOString();

    // First, query to find the recording by recordingId
    const queryParams = {
      TableName: "shelcaster-app",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      FilterExpression: "recordingId = :recordingId",
      ExpressionAttributeValues: marshall({
        ":pk": `show#${showId}`,
        ":sk": "recording#",
        ":recordingId": recordingId
      })
    };

    const queryResult = await dynamoDBClient.send(new QueryCommand(queryParams));

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Recording not found" }),
      };
    }

    // Get the actual SK from the query result
    const recordingItem = unmarshall(queryResult.Items[0]);
    const actualSk = recordingItem.sk;

    // Now update the recording with the correct SK
    const updateParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: actualSk
      }),
      UpdateExpression: 'SET #status = :status, #endTime = :endTime, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#endTime': 'endTime',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':status': 'processing',
        ':endTime': now,
        ':updatedAt': now,
      }),
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(updateParams));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        recording: unmarshall(result.Attributes),
        message: 'Recording stopped. Processing will complete in 2-5 minutes.'
      }),
    };
  } catch (error) {
    console.error("Error stopping recording:", error);
    throw error;
  }
}

async function updateRecording(showId, recordingId, metadata, headers) {
  try {
    const now = new Date().toISOString();
    const { s3Key, s3Bucket, duration, size } = metadata;

    // First, query to find the recording by recordingId
    const queryParams = {
      TableName: "shelcaster-app",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      FilterExpression: "recordingId = :recordingId",
      ExpressionAttributeValues: marshall({
        ":pk": `show#${showId}`,
        ":sk": "recording#",
        ":recordingId": recordingId
      })
    };

    const queryResult = await dynamoDBClient.send(new QueryCommand(queryParams));

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Recording not found" }),
      };
    }

    // Get the actual SK from the query result
    const recordingItem = unmarshall(queryResult.Items[0]);
    const actualSk = recordingItem.sk;

    // Now update the recording with the correct SK
    const updateParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: actualSk
      }),
      UpdateExpression: 'SET #status = :status, #s3Key = :s3Key, #s3Bucket = :s3Bucket, #duration = :duration, #size = :size, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#s3Key': 's3Key',
        '#s3Bucket': 's3Bucket',
        '#duration': 'duration',
        '#size': 'size',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':status': 'completed',
        ':s3Key': s3Key || null,
        ':s3Bucket': s3Bucket || 'shelcaster-media-bucket',
        ':duration': duration || null,
        ':size': size || null,
        ':updatedAt': now,
      }),
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(updateParams));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ recording: unmarshall(result.Attributes) }),
    };
  } catch (error) {
    console.error("Error updating recording:", error);
    throw error;
  }
}

