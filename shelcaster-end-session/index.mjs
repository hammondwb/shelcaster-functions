import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ECSClient, StopTaskCommand } from "@aws-sdk/client-ecs";
import { IVSRealTimeClient, DeleteStageCommand, StopCompositionCommand } from "@aws-sdk/client-ivs-realtime";
import { IvsClient, DeleteChannelCommand as DeleteIvsChannelCommand } from "@aws-sdk/client-ivs";
import { MediaLiveClient, StopChannelCommand, DeleteChannelCommand, DeleteInputCommand } from "@aws-sdk/client-medialive";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const ecsClient = new ECSClient({ region: "us-east-1" });
const ivsRealtimeClient = new IVSRealTimeClient({ region: "us-east-1" });
const ivsClient = new IvsClient({ region: "us-east-1" });
const mediaLiveClient = new MediaLiveClient({ region: "us-east-1" });

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
    const { sessionId } = event.pathParameters;

    // Get session from DynamoDB
    const getParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info',
      }),
    };

    const result = await dynamoDBClient.send(new GetItemCommand(getParams));
    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Session not found" }),
      };
    }

    const session = unmarshall(result.Item);

    // Stop ECS task if it exists
    if (session.ivs?.programControllerTaskArn) {
      try {
        const taskArn = session.ivs.programControllerTaskArn;
        const taskId = taskArn.split('/').pop();
        
        await ecsClient.send(new StopTaskCommand({
          cluster: 'shelcaster-vp-cluster',
          task: taskId,
          reason: 'Session ended by user'
        }));
        
        console.log('Stopped ECS task:', taskArn);
      } catch (ecsError) {
        console.error('Failed to stop ECS task:', ecsError.message);
      }
    }

    // Stop IVS Composition if running
    if (session.ivs?.compositionArn) {
      try {
        await ivsRealtimeClient.send(new StopCompositionCommand({
          arn: session.ivs.compositionArn
        }));
        console.log('Stopped IVS Composition:', session.ivs.compositionArn);
      } catch (compError) {
        console.error('Failed to stop composition:', compError.message);
      }
    }

    // Delete composition relay IVS channel
    if (session.ivs?.relayChannelArn) {
      try {
        await ivsClient.send(new DeleteIvsChannelCommand({
          arn: session.ivs.relayChannelArn
        }));
        console.log('Deleted relay channel:', session.ivs.relayChannelArn);
      } catch (relayError) {
        console.error('Failed to delete relay channel:', relayError.message);
      }
    }

    // Delete RAW stage if it exists (this disconnects all participants)
    if (session.ivs?.rawStageArn) {
      try {
        // Deleting the stage immediately disconnects all participants
        await ivsRealtimeClient.send(new DeleteStageCommand({
          arn: session.ivs.rawStageArn
        }));
        console.log('Deleted RAW stage (all participants disconnected):', session.ivs.rawStageArn);
      } catch (stageError) {
        console.error('Failed to delete RAW stage:', stageError.message);
      }
    }

    // Delete PROGRAM stage if it exists
    if (session.ivs?.programStageArn) {
      try {
        await ivsRealtimeClient.send(new DeleteStageCommand({
          arn: session.ivs.programStageArn
        }));
        console.log('Deleted PROGRAM stage:', session.ivs.programStageArn);
      } catch (stageError) {
        console.error('Failed to delete PROGRAM stage:', stageError.message);
      }
    }

    // Cleanup MediaLive resources
    if (session.mediaLive?.channelId) {
      try {
        const channelId = session.mediaLive.channelId;

        // Stop channel first
        try {
          await mediaLiveClient.send(new StopChannelCommand({ ChannelId: channelId }));
          console.log('Stopped MediaLive channel:', channelId);

          // Wait for channel to stop (max 30 seconds)
          let attempts = 0;
          while (attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        } catch (stopError) {
          console.log('Channel stop warning:', stopError.message);
        }

        // Delete channel
        try {
          await mediaLiveClient.send(new DeleteChannelCommand({ ChannelId: channelId }));
          console.log('Deleted MediaLive channel:', channelId);
        } catch (deleteError) {
          console.error('Failed to delete channel:', deleteError.message);
        }

        // Delete all inputs (participants, tracklist)
        if (session.mediaLive.inputIds && typeof session.mediaLive.inputIds === 'object') {
          for (const [sourceName, inputId] of Object.entries(session.mediaLive.inputIds)) {
            try {
              await mediaLiveClient.send(new DeleteInputCommand({ InputId: inputId }));
              console.log(`Deleted MediaLive input ${sourceName}:`, inputId);
            } catch (inputError) {
              console.error(`Failed to delete input ${sourceName}:`, inputError.message);
            }
          }
        }
      } catch (mlError) {
        console.error('MediaLive cleanup error:', mlError.message);
      }
    }

    // Update session status
    const updateParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':status': 'ENDED',
        ':now': new Date().toISOString()
      })
    };

    await dynamoDBClient.send(new UpdateItemCommand(updateParams));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Session ended successfully',
        sessionId
      }),
    };
  } catch (error) {
    console.error('Error ending session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to end session",
        error: error.message,
      }),
    };
  }
};
