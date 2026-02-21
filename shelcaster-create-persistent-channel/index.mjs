import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { IvsClient, CreateChannelCommand } from "@aws-sdk/client-ivs";
import { randomUUID } from "crypto";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const ivsClient = new IvsClient({ region: "us-east-1" });

const RECORDING_CONFIGURATION_ARN = "arn:aws:ivs:us-east-1:124355640062:recording-configuration/NgV3p8AlWTTF";
const MAX_CHANNELS_PER_ACCOUNT = 20; // AWS default limit

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle OPTIONS preflight
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { name, recordingEnabled = true } = body;

    if (!name || !name.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required field: name" }),
      };
    }

    // Store the user-friendly name as-is
    const displayName = name.trim();
    
    // Generate IVS-compatible name: lowercase, replace spaces and special chars with hyphens
    const ivsName = displayName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')  // Replace invalid chars with hyphens
      .replace(/-+/g, '-')            // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
    
    // Add channel ID suffix to ensure uniqueness
    const channelId = randomUUID();
    const uniqueIvsName = `persistent-${ivsName}-${channelId.split('-')[0]}`;

    // Check current channel count against limit
    const countParams = {
      TableName: "shelcaster-app",
      IndexName: "entityType-index",
      KeyConditionExpression: "entityType = :type",
      ExpressionAttributeValues: marshall({
        ":type": "persistentChannel"
      }),
      Select: "COUNT"
    };

    const countResult = await dynamoDBClient.send(new QueryCommand(countParams));
    const currentChannelCount = countResult.Count || 0;

    if (currentChannelCount >= MAX_CHANNELS_PER_ACCOUNT) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          message: "Maximum channel limit reached",
          currentCount: currentChannelCount,
          maxLimit: MAX_CHANNELS_PER_ACCOUNT
        }),
      };
    }

    // Create IVS channel with recording configuration
    console.log(`Creating IVS channel with name: ${uniqueIvsName}`);
    const createChannelParams = {
      name: uniqueIvsName,
      type: 'STANDARD',
      latencyMode: 'LOW',
    };

    // Add recording configuration if enabled
    if (recordingEnabled) {
      createChannelParams.recordingConfigurationArn = RECORDING_CONFIGURATION_ARN;
    }

    let channelResponse;
    try {
      channelResponse = await ivsClient.send(new CreateChannelCommand(createChannelParams));
    } catch (ivsError) {
      console.error('Failed to create IVS channel:', ivsError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          message: "Failed to create IVS channel",
          error: ivsError.message
        }),
      };
    }

    const channelArn = channelResponse.channel.arn;
    const playbackUrl = channelResponse.channel.playbackUrl;
    const ingestEndpoint = channelResponse.channel.ingestEndpoint;
    const streamKey = channelResponse.streamKey.value;
    const now = new Date().toISOString();

    console.log(`IVS channel created: ${channelArn}`);
    console.log(`Playback URL: ${playbackUrl}`);

    // Store channel record in DynamoDB with user-friendly display name
    const channelRecord = {
      pk: `channel#${channelId}`,
      sk: 'info',
      entityType: 'persistentChannel',
      channelId,
      channelArn,
      channelName: displayName,  // Store user-friendly name
      playbackUrl,
      ingestEndpoint,
      streamKey, // Note: In production, this should be encrypted
      state: 'IDLE',
      recordingConfigurationArn: recordingEnabled ? RECORDING_CONFIGURATION_ARN : null,
      currentSessionId: null,
      createdAt: now,
      updatedAt: now,
      // Statistics
      totalBroadcasts: 0,
      totalStreamingMinutes: 0,
      lastBroadcastAt: null,
    };

    const putParams = {
      TableName: "shelcaster-app",
      Item: marshall(channelRecord),
    };

    await dynamoDBClient.send(new PutItemCommand(putParams));

    console.log(`Channel record stored in DynamoDB: ${channelId}`);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Persistent channel created successfully',
        channel: {
          channelId,
          channelArn,
          channelName: name,
          playbackUrl,
          ingestEndpoint,
          state: 'IDLE',
          createdAt: now,
        }
      }),
    };
  } catch (error) {
    console.error('Error creating persistent channel:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to create persistent channel",
        error: error.message,
      }),
    };
  }
};
