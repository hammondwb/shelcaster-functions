/**
 * shelcaster-create-medialive-dynamic
 * Creates MediaLive channel with URL_PULL inputs from IVS compositions
 */

import { MediaLiveClient, CreateInputCommand, CreateChannelCommand } from '@aws-sdk/client-medialive'
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'

const mediaLiveClient = new MediaLiveClient({ region: 'us-east-1' })
const dynamoDBClient = new DynamoDBClient({ region: 'us-east-1' })

const TABLE_NAME = 'shelcaster-app'
const MEDIALIVE_ROLE_ARN = process.env.MEDIALIVE_ROLE_ARN || 'arn:aws:iam::124355640062:role/MediaLiveAccessRole'

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*'
  }
  
  try {
    const { sessionId, compositions, ivsIngestEndpoint } = JSON.parse(event.body)
    
    if (!sessionId || !compositions?.length || !ivsIngestEndpoint) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      }
    }
    
    // Create URL_PULL input for each composition
    const inputs = []
    for (const comp of compositions) {
      const input = await mediaLiveClient.send(new CreateInputCommand({
        Name: `${sessionId}-${comp.participantId}`,
        Type: 'URL_PULL',
        Sources: [{ Url: comp.hlsUrl }]
      }))
      inputs.push({
        participantId: comp.participantId,
        inputId: input.Input.Id,
        hlsUrl: comp.hlsUrl
      })
    }
    
    // Create MediaLive channel
    const channel = await mediaLiveClient.send(new CreateChannelCommand({
      Name: `shelcaster-${sessionId}`,
      RoleArn: MEDIALIVE_ROLE_ARN,
      ChannelClass: 'SINGLE_PIPELINE',
      InputSpecification: {
        Codec: 'AVC',
        Resolution: 'HD',
        MaximumBitrate: 'MAX_10_MBPS'
      },
      InputAttachments: inputs.map((input, index) => ({
        InputAttachmentName: `participant-${index}`,
        InputId: input.inputId,
        InputSettings: {
          HlsInputSettings: {
            BufferSegments: 3
          }
        }
      })),
      EncoderSettings: {
        AudioDescriptions: [{
          Name: 'mixed-audio',
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
          Height: 720,
          Width: 1280
        }],
        OutputGroups: [{
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
            AudioDescriptionNames: ['mixed-audio']
          }]
        }],
        TimecodeConfig: { Source: 'SYSTEMCLOCK' }
      },
      Destinations: [{
        Id: 'ivs',
        Settings: [{ Url: `rtmps://${ivsIngestEndpoint}:443/app/`, StreamName: 'stream' }]
      }]
    }))
    
    // Save to DynamoDB
    await dynamoDBClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ pk: `session#${sessionId}`, sk: 'info' }),
      UpdateExpression: 'SET mediaLive = :ml, updatedAt = :now',
      ExpressionAttributeValues: marshall({
        ':ml': {
          channelId: channel.Channel.Id,
          channelArn: channel.Channel.Arn,
          inputIds: inputs.reduce((acc, inp) => {
            acc[inp.participantId] = inp.inputId
            return acc
          }, {})
        },
        ':now': new Date().toISOString()
      })
    }))
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        channelId: channel.Channel.Id,
        channelArn: channel.Channel.Arn
      })
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    }
  }
}
