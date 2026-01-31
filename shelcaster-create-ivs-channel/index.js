/**
 * shelcaster-create-ivs-channel
 *
 * Returns the shared IVS channel for broadcasting.
 * This channel has recording configuration attached.
 *
 * Instead of creating a new channel every time, we reuse a single channel
 * with auto-recording enabled.
 */

const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

// Shared channel configuration (created with recording config attached)
const SHARED_CHANNEL = {
  arn: 'arn:aws:ivs:us-east-1:124355640062:channel/uXMHXvFStNZG',
  name: 'shelcaster-main',
  ingestEndpoint: 'ac3a1332d866.global-contribute.live-video.net',
  playbackUrl: 'https://ac3a1332d866.us-east-1.playback.live-video.net/api/video/v1/us-east-1.124355640062.channel.uXMHXvFStNZG.m3u8',
  streamKey: 'sk_us-east-1_C1m7dnEA5x7z_J9yKAFUZPDx8DFFGvbd2xuJMpVhC2M',
  recordingConfigurationArn: 'arn:aws:ivs:us-east-1:124355640062:recording-configuration/NgV3p8AlWTTF',
};

exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };

  try {
    // Extract showId from path parameters or body
    let showId;

    if (event.pathParameters?.showId) {
      showId = event.pathParameters.showId;
    } else if (event.body) {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      showId = body.showId;
    }

    console.log('Returning shared channel for showId:', showId);

    // Update the show in DynamoDB with the shared channel info
    if (showId) {
      const updateParams = {
        TableName: "shelcaster-app",
        Key: marshall({
          pk: `show#${showId}`,
          sk: 'info',
        }),
        UpdateExpression: 'SET #ivsChannelArn = :channelArn, #ivsPlaybackUrl = :playbackUrl, #ivsIngestEndpoint = :ingestEndpoint, #ivsStreamKey = :streamKey, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#ivsChannelArn': 'ivsChannelArn',
          '#ivsPlaybackUrl': 'ivsPlaybackUrl',
          '#ivsIngestEndpoint': 'ivsIngestEndpoint',
          '#ivsStreamKey': 'ivsStreamKey',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: marshall({
          ':channelArn': SHARED_CHANNEL.arn,
          ':playbackUrl': SHARED_CHANNEL.playbackUrl,
          ':ingestEndpoint': SHARED_CHANNEL.ingestEndpoint,
          ':streamKey': SHARED_CHANNEL.streamKey,
          ':updatedAt': new Date().toISOString(),
        }),
      };

      await dynamoDBClient.send(new UpdateItemCommand(updateParams));
      console.log('Updated show with shared channel info');
    }

    // Return the shared channel info
    const response = {
      channelArn: SHARED_CHANNEL.arn,
      channelName: SHARED_CHANNEL.name,
      ingestEndpoint: SHARED_CHANNEL.ingestEndpoint,
      playbackUrl: SHARED_CHANNEL.playbackUrl,
      streamKey: SHARED_CHANNEL.streamKey,
      recordingEnabled: true,
      recordingConfigurationArn: SHARED_CHANNEL.recordingConfigurationArn,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to get channel info',
        message: error.message
      }),
    };
  }
};

