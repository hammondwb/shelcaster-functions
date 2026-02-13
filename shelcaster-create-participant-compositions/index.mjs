/**
 * shelcaster-create-participant-compositions
 * Creates individual IVS composition for each participant
 */

import { 
  IVSRealTimeClient, 
  CreateEncoderConfigurationCommand, 
  StartCompositionCommand 
} from '@aws-sdk/client-ivs-realtime'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { IVSClient, CreateChannelCommand } = require('@aws-sdk/client-ivs')
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'

const ivsRealTimeClient = new IVSRealTimeClient({ region: 'us-east-1' })
const ivsClient = new IVSClient({ region: 'us-east-1' })
const dynamoDBClient = new DynamoDBClient({ region: 'us-east-1' })

const TABLE_NAME = process.env.TABLE_NAME || 'shelcaster-app'

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*'
  }
  
  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }
  
  try {
    const sessionId = event.pathParameters?.sessionId
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    const { stageArn, participants } = body || {}
    
    console.log('SessionId from path:', sessionId)
    console.log('Body:', { stageArn, participants })
    
    if (!sessionId || !stageArn || !participants?.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields', 
          received: { sessionId, stageArn, participantsLength: participants?.length } 
        })
      }
    }
    
    const compositions = []
    
    for (const participant of participants) {
      console.log('Creating IVS channel for participant:', participant.participantId)
      const channelResult = await ivsClient.send(new CreateChannelCommand({
        name: `${sessionId}-${participant.participantId}`,
        type: 'STANDARD',
        latencyMode: 'LOW'
      }))
      
      const channelArn = channelResult.channel.arn
      console.log('Channel created:', channelArn)
      
      console.log('Creating encoder config for participant:', participant.participantId)
      const encoderConfigResult = await ivsRealTimeClient.send(new CreateEncoderConfigurationCommand({
        Name: `${sessionId}-${participant.participantId}`,
        Video: {
          Bitrate: 2500000,
          Framerate: 30,
          Height: 720,
          Width: 1280
        }
      }))
      
      console.log('Encoder config result:', encoderConfigResult)
      const encoderArn = encoderConfigResult.encoderConfiguration?.arn
      
      if (!encoderArn) {
        throw new Error('Failed to create encoder configuration - no ARN returned')
      }
      
      console.log('Starting composition with encoder ARN:', encoderArn)
      const compositionResult = await ivsRealTimeClient.send(new StartCompositionCommand({
        stageArn: stageArn,
        destinations: [{
          name: `${sessionId}-${participant.participantId}`,
          configuration: {
            name: `${sessionId}-${participant.participantId}`,
            channel: {
              channelArn: channelArn,
              encoderConfigurationArn: encoderArn
            }
          }
        }],
        layout: {
          grid: {
            gridGap: 0,
            omitStoppedVideo: false,
            videoAspectRatio: 'VIDEO',
            videoFillMode: 'COVER',
            featuredParticipantAttribute: participant.participantId
          }
        }
      }))
      
      console.log('Composition result:', compositionResult)
      
      compositions.push({
        participantId: participant.participantId,
        compositionArn: compositionResult.composition?.arn,
        channelArn: channelArn,
        playbackUrl: channelResult.channel.playbackUrl
      })
    }
    
    await dynamoDBClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ pk: `session#${sessionId}`, sk: 'info' }),
      UpdateExpression: 'SET compositions = :comps, updatedAt = :now',
      ExpressionAttributeValues: marshall({
        ':comps': compositions,
        ':now': new Date().toISOString()
      })
    }))
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ compositions })
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
