const { Ivs, CreateChannelCommand, GetChannelCommand } = require("@aws-sdk/client-ivs");
const { DynamoDBClient, UpdateItemCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const ivsClient = new Ivs({ region: "us-east-1" });
const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
  console.log('=== CREATE IVS CHANNEL LAMBDA START ===');
  console.log('Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId } = event.pathParameters;
    const { userId } = JSON.parse(event.body || '{}');

    console.log('ShowId:', showId, 'UserId:', userId);

    if (!showId || !userId) {
      console.log('ERROR: Missing showId or userId');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId or userId parameter" }),
      };
    }

    // Get the show to check if it already has an IVS channel
    const getShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
    };

    const showResult = await dynamoDBClient.send(new GetItemCommand(getShowParams));
    const show = showResult.Item ? unmarshall(showResult.Item) : null;

    if (!show) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Show not found" }),
      };
    }

    // If show already has an IVS channel, return it
    if (show.ivsChannelArn) {
      try {
        const channelData = await ivsClient.send(new GetChannelCommand({
          arn: show.ivsChannelArn
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            channel: channelData.channel,
            streamKey: show.ivsStreamKey,
            playbackUrl: channelData.channel.playbackUrl,
            ingestEndpoint: channelData.channel.ingestEndpoint,
          }),
        };
      } catch (error) {
        console.log('Existing channel not found, creating new one');
      }
    }

    // Create new IVS channel with recording enabled (if configured)
    const createChannelParams = {
      name: `shelcaster-${showId}`,
      latencyMode: 'LOW', // LOW for interactive streaming, NORMAL for standard
      type: 'STANDARD', // STANDARD or BASIC
      authorized: false, // Set to true if you want to restrict playback
    };

    // Add recording configuration if available
    if (process.env.IVS_RECORDING_CONFIG_ARN) {
      console.log('Adding recording config:', process.env.IVS_RECORDING_CONFIG_ARN);
      createChannelParams.recordingConfigurationArn = process.env.IVS_RECORDING_CONFIG_ARN;
    } else {
      console.log('WARNING: No IVS_RECORDING_CONFIG_ARN environment variable set');
    }

    console.log('Creating IVS channel with params:', JSON.stringify(createChannelParams, null, 2));
    const channelResponse = await ivsClient.send(new CreateChannelCommand(createChannelParams));
    const { channel, streamKey } = channelResponse;
    console.log('Channel created successfully:', channel.arn);

    // Update the show with IVS channel information
    const updateShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #channelArn = :channelArn, #ivsChannelArn = :channelArn, #ivsStreamKey = :streamKey, #ivsIngestEndpoint = :ingestEndpoint, #ivsPlaybackUrl = :playbackUrl, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#channelArn': 'channelArn',
        '#ivsChannelArn': 'ivsChannelArn',
        '#ivsStreamKey': 'ivsStreamKey',
        '#ivsIngestEndpoint': 'ivsIngestEndpoint',
        '#ivsPlaybackUrl': 'ivsPlaybackUrl',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':channelArn': channel.arn,
        ':streamKey': streamKey.value,
        ':ingestEndpoint': channel.ingestEndpoint,
        ':playbackUrl': channel.playbackUrl,
        ':updatedAt': new Date().toISOString(),
      }),
      ReturnValues: 'ALL_NEW',
    };

    console.log('Updating DynamoDB with channel info...');
    const updateResult = await dynamoDBClient.send(new UpdateItemCommand(updateShowParams));
    console.log('DynamoDB updated successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        channelArn: channel.arn,
        streamKey: streamKey.value,
        ingestEndpoint: channel.ingestEndpoint,
        playbackUrl: channel.playbackUrl,
      }),
    };
  } catch (error) {
    console.error('Error creating IVS channel:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to create IVS channel",
        error: error.message 
      }),
    };
  }
};

