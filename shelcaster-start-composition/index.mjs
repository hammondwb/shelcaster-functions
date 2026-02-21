/**
 * shelcaster-start-composition
 * POST /sessions/{sessionId}/start-composition
 */

import { IVSRealTimeClient, StartCompositionCommand } from "@aws-sdk/client-ivs-realtime";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ivsClient = new IVSRealTimeClient({ region: "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: "us-east-1" });
const ENCODER_CONFIG_ARN = 'arn:aws:ivs:us-east-1:124355640062:encoder-configuration/FmtFS8AWkrAb';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };

  try {
    const sessionId = event.pathParameters?.sessionId;
    
    // Get session from DynamoDB
    const sessionResult = await dynamoClient.send(new GetItemCommand({
      TableName: 'shelcaster-app',
      Key: marshall({ pk: `session#${sessionId}`, sk: 'info' })
    }));
    
    if (!sessionResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }
    
    const session = unmarshall(sessionResult.Item);
    
    // Start composition with S3 recording
    // Use grid layout with featuredParticipantAttribute to enable source switching
    // When a participant has attribute "featured"="true", they will be shown full-screen
    // Output directly to PERSISTENT channel (permanent channel with static playback URL)
    const composition = await ivsClient.send(new StartCompositionCommand({
      stageArn: session.ivs.rawStageArn,
      destinations: [
        {
          channel: {
            channelArn: session.ivs.persistentChannelArn,
            encoderConfigurationArn: ENCODER_CONFIG_ARN
          }
        },
        {
          s3: {
            storageConfigurationArn: process.env.STORAGE_CONFIGURATION_ARN || 'arn:aws:ivs:us-east-1:124355640062:storage-configuration/M2RhrYnOPLP7',
            encoderConfigurationArns: [ENCODER_CONFIG_ARN]
          }
        }
      ],
      layout: {
        grid: {
          featuredParticipantAttribute: 'featured',
          omitStoppedVideo: false,
          videoFillMode: 'COVER',
          gridGap: 2
        }
      }
    }));
    
    // Update session with composition ARN
    await dynamoClient.send(new UpdateItemCommand({
      TableName: 'shelcaster-app',
      Key: marshall({ pk: `session#${sessionId}`, sk: 'info' }),
      UpdateExpression: 'SET #ivs.#compositionArn = :arn',
      ExpressionAttributeNames: {
        '#ivs': 'ivs',
        '#compositionArn': 'compositionArn'
      },
      ExpressionAttributeValues: marshall({
        ':arn': composition.composition.arn
      })
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        compositionArn: composition.composition.arn,
        message: 'Composition started'
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
