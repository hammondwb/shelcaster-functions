const { MediaLiveClient, StartChannelCommand: StartMLChannelCommand, CreateChannelCommand, CreateInputCommand } = require('@aws-sdk/client-medialive');
const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const mediaLiveClient = new MediaLiveClient({ region: 'us-east-1' });
const dynamoDBClient = new DynamoDBClient({ region: 'us-east-1' });

const TABLE_NAME = 'shelcaster-app';
const MEDIALIVE_ROLE_ARN = process.env.MEDIALIVE_ROLE_ARN;

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*'
  };
  
  try {
    const sessionId = event.pathParameters?.sessionId;
    
    if (!sessionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing sessionId' })
      };
    }
    
    // Get session from DynamoDB
    const sessionResult = await dynamoDBClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info'
      })
    }));
    
    if (!sessionResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }
    
    const session = unmarshall(sessionResult.Item);
    console.log('Session:', JSON.stringify(session, null, 2));
    
    let channelId = session.mediaLive?.channelId;
    
    // Auto-create MediaLive channel if it doesn't exist
    if (!channelId) {
      console.log('MediaLive channel not found, creating...');
      
      const ivsIngestEndpoint = session.ivs?.programIngestEndpoint;
      if (!ivsIngestEndpoint) {
        throw new Error('IVS ingest endpoint not found in session');
      }

      // Composition relay playback URL (set by start-composition Lambda)
      const relayPlaybackUrl = session.ivs?.relayPlaybackUrl;
      if (!relayPlaybackUrl) {
        throw new Error('Composition relay playback URL not found — start composition first');
      }

      // Create URL_PULL input for participants (IVS Composition tiled grid)
      const participantsInput = await mediaLiveClient.send(new CreateInputCommand({
        Name: `shelcaster-participants-${sessionId}`,
        Type: 'URL_PULL',
        Sources: [
          { Url: relayPlaybackUrl }
        ]
      }));

      // Create URL_PULL input for tracklist (HLS from S3)
      const tracklistInput = await mediaLiveClient.send(new CreateInputCommand({
        Name: `shelcaster-tracklist-${sessionId}`,
        Type: 'URL_PULL',
        Sources: [
          { Url: `https://shelcaster-media-manager.s3.amazonaws.com/tracklists/${sessionId}/playlist.m3u8` }
        ]
      }));

      // Create MediaLive channel with both URL_PULL inputs
      const channelResponse = await mediaLiveClient.send(new CreateChannelCommand({
        Name: `shelcaster-${sessionId}`,
        RoleArn: MEDIALIVE_ROLE_ARN,
        ChannelClass: 'SINGLE_PIPELINE',
        InputSpecification: {
          Codec: 'AVC',
          Resolution: 'HD',
          MaximumBitrate: 'MAX_10_MBPS'
        },
        InputAttachments: [
          {
            InputAttachmentName: 'participants',
            InputId: participantsInput.Input.Id
          },
          {
            InputAttachmentName: 'tracklist',
            InputId: tracklistInput.Input.Id,
            InputSettings: {
              AudioSelectors: [{
                Name: 'tracklist-audio',
                SelectorSettings: {
                  AudioHlsRenditionSelection: {
                    Name: 'default'
                  }
                }
              }]
            }
          }
        ],
        EncoderSettings: {
          AudioDescriptions: [{
            Name: 'audio',
            CodecSettings: {
              AacSettings: {
                Bitrate: 128000,
                SampleRate: 48000
              }
            }
          }],
          VideoDescriptions: [{
            Name: 'video',
            CodecSettings: {
              H264Settings: {
                Bitrate: 4500000,
                FramerateNumerator: 30,
                FramerateDenominator: 1
              }
            },
            Height: 1080,
            Width: 1920
          }],
          OutputGroups: [
            {
              Name: 'ivs-output',
              OutputGroupSettings: {
                RtmpGroupSettings: {}
              },
              Outputs: [{
                OutputName: 'stream',
                OutputSettings: {
                  RtmpOutputSettings: {
                    Destination: { DestinationRefId: 'ivs' }
                  }
                },
                VideoDescriptionName: 'video',
                AudioDescriptionNames: ['audio']
              }]
            },
            {
              Name: 's3-output',
              OutputGroupSettings: {
                HlsGroupSettings: {
                  Destination: { DestinationRefId: 's3' },
                  SegmentLength: 6
                }
              },
              Outputs: [{
                OutputName: 'recording',
                OutputSettings: {
                  HlsOutputSettings: {
                    HlsSettings: {
                      StandardHlsSettings: {
                        M3u8Settings: {
                          AudioFramesPerPes: 4,
                          PcrControl: 'PCR_EVERY_PES_PACKET'
                        }
                      }
                    },
                    NameModifier: '_rec'
                  }
                },
                VideoDescriptionName: 'video',
                AudioDescriptionNames: ['audio']
              }]
            }
          ],
          TimecodeConfig: { Source: 'SYSTEMCLOCK' }
        },
        Destinations: [
          {
            Id: 'ivs',
            Settings: [{ Url: ivsIngestEndpoint, StreamName: 'stream' }]
          },
          {
            Id: 's3',
            Settings: [{ Url: `s3://shelcaster-media-manager/sessions/${sessionId}/recording/index` }]
          }
        ]
      }));

      channelId = channelResponse.Channel.Id;

      // Save MediaLive info to DynamoDB (no RTMP endpoints — both inputs are URL_PULL)
      await dynamoDBClient.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          pk: `session#${sessionId}`,
          sk: 'info'
        }),
        UpdateExpression: 'SET mediaLive = :ml, updatedAt = :now',
        ExpressionAttributeValues: marshall({
          ':ml': {
            channelId: channelResponse.Channel.Id,
            channelArn: channelResponse.Channel.Arn,
            inputIds: {
              participants: participantsInput.Input.Id,
              tracklist: tracklistInput.Input.Id
            }
          },
          ':now': new Date().toISOString()
        }, { removeUndefinedValues: true })
      }));

      console.log('MediaLive channel created:', channelId);
    }
    
    // Start MediaLive channel
    try {
      await mediaLiveClient.send(new StartMLChannelCommand({
        ChannelId: channelId
      }));
      console.log('MediaLive channel started:', channelId);
    } catch (error) {
      if (error.name !== 'ConflictException') {
        throw error;
      }
      console.log('MediaLive channel already running');
    }
    
    // Note: IVS PROGRAM channel auto-starts when MediaLive begins pushing RTMP to it.
    // No need to manually start the IVS channel.

    // Update DynamoDB
    await dynamoDBClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info'
      }),
      UpdateExpression: 'SET streaming.isLive = :live, streaming.startedAt = :now, updatedAt = :now',
      ExpressionAttributeValues: marshall({
        ':live': true,
        ':now': new Date().toISOString()
      })
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Streaming started',
        playbackUrl: session.ivs?.programPlaybackUrl
      })
    };
    
  } catch (error) {
    console.error('Error starting streaming:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
