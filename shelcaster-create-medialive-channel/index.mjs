import { 
  MediaLiveClient, 
  CreateChannelCommand,
  CreateInputCommand
} from "@aws-sdk/client-medialive";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const mediaLiveClient = new MediaLiveClient({ region: "us-east-1" });
const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

const TABLE_NAME = "shelcaster-app";
const MEDIALIVE_ROLE_ARN = process.env.MEDIALIVE_ROLE_ARN;

async function createHLSInput(name, sourceUrl) {
  const response = await mediaLiveClient.send(new CreateInputCommand({
    Name: name,
    Type: "URL_PULL",
    Sources: [{ Url: sourceUrl }],
    InputSettings: {
      HlsInputSettings: {
        BufferSegments: 10
      }
    }
  }));
  
  return {
    inputId: response.Input.Id,
    inputArn: response.Input.Arn
  };
}

async function createMediaLiveChannel(sessionId, inputs, ivsIngestEndpoint) {
  const response = await mediaLiveClient.send(new CreateChannelCommand({
    Name: `shelcaster-${sessionId}`,
    RoleArn: MEDIALIVE_ROLE_ARN,
    ChannelClass: "SINGLE_PIPELINE",
    InputSpecification: {
      Codec: "AVC",
      Resolution: "HD",
      MaximumBitrate: "MAX_10_MBPS"
    },
    InputAttachments: [
      {
        InputAttachmentName: "participants",
        InputId: inputs.participants.inputId
      },
      {
        InputAttachmentName: "tracklist",
        InputId: inputs.tracklist.inputId,
        InputSettings: {
          AudioSelectors: [{
            Name: "tracklist-audio",
            SelectorSettings: {
              AudioHlsRenditionSelection: {
                Name: "default"
              }
            }
          }]
        }
      }
    ],
    EncoderSettings: {
      AudioDescriptions: [{
        Name: "audio",
        CodecSettings: {
          AacSettings: {
            Bitrate: 128000,
            SampleRate: 48000
          }
        }
      }],
      VideoDescriptions: [{
        Name: "video",
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
          Name: "ivs-output",
          OutputGroupSettings: {
            RtmpGroupSettings: {}
          },
          Outputs: [{
            OutputName: "stream",
            OutputSettings: {
              RtmpOutputSettings: {
                Destination: { DestinationRefId: "ivs" }
              }
            },
            VideoDescriptionName: "video",
            AudioDescriptionNames: ["audio"]
          }]
        },
        {
          Name: "s3-output",
          OutputGroupSettings: {
            HlsGroupSettings: {
              Destination: { DestinationRefId: "s3" },
              SegmentLength: 6
            }
          },
          Outputs: [{
            OutputName: "recording",
            OutputSettings: {
              HlsOutputSettings: {
                HlsSettings: {
                  StandardHlsSettings: {
                    M3u8Settings: {
                      AudioFramesPerPes: 4,
                      PcrControl: "PCR_EVERY_PES_PACKET"
                    }
                  }
                },
                NameModifier: "_rec"
              }
            },
            VideoDescriptionName: "video",
            AudioDescriptionNames: ["audio"]
          }]
        }
      ],
      TimecodeConfig: { Source: "SYSTEMCLOCK" }
    },
    Destinations: [
      {
        Id: "ivs",
        Settings: [{ Url: ivsIngestEndpoint, StreamName: "stream" }]
      },
      {
        Id: "s3",
        Settings: [{ Url: `s3://shelcaster-media-manager/sessions/${sessionId}/recording/index` }]
      }
    ]
  }));
  
  return {
    channelId: response.Channel.Id,
    channelArn: response.Channel.Arn
  };
}

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*'
  };
  
  try {
    const sessionId = event.pathParameters?.sessionId;
    const body = JSON.parse(event.body || '{}');
    const ivsIngestEndpoint = body.ivsIngestEndpoint;
    const relayPlaybackUrl = body.relayPlaybackUrl;

    if (!sessionId || !ivsIngestEndpoint || !relayPlaybackUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing sessionId, ivsIngestEndpoint, or relayPlaybackUrl' })
      };
    }

    // Create URL_PULL input for participants (IVS Composition tiled grid)
    const participantsInput = await createHLSInput(
      `shelcaster-participants-${sessionId}`,
      relayPlaybackUrl
    );
    const tracklistInput = await createHLSInput(
      `shelcaster-tracklist-${sessionId}`,
      `https://shelcaster-media-manager.s3.amazonaws.com/tracklists/${sessionId}/playlist.m3u8`
    );

    const channel = await createMediaLiveChannel(sessionId, {
      participants: participantsInput,
      tracklist: tracklistInput
    }, ivsIngestEndpoint);

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
          channelId: channel.channelId,
          channelArn: channel.channelArn,
          inputIds: {
            participants: participantsInput.inputId,
            tracklist: tracklistInput.inputId
          }
        },
        ':now': new Date().toISOString()
      }, { removeUndefinedValues: true })
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        channelId: channel.channelId
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
