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

  const cleanupResults = {
    ecsTask: { attempted: false, success: false, error: null },
    composition: { attempted: false, success: false, error: null },
    relayChannel: { attempted: false, success: false, error: null },
    rawStage: { attempted: false, success: false, error: null },
    programStage: { attempted: false, success: false, error: null },
    mediaLiveChannel: { attempted: false, success: false, error: null },
    mediaLiveInputs: { attempted: false, success: false, error: null, deletedCount: 0 }
  };

  try {
    const { sessionId } = event.pathParameters;
    console.log(`[END SESSION] Starting cleanup for session: ${sessionId}`);

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
      console.error(`[END SESSION] Session not found: ${sessionId}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Session not found" }),
      };
    }

    const session = unmarshall(result.Item);
    console.log(`[END SESSION] Session data:`, JSON.stringify(session, null, 2));

    // Stop ECS task if it exists
    if (session.ivs?.programControllerTaskArn) {
      cleanupResults.ecsTask.attempted = true;
      try {
        const taskArn = session.ivs.programControllerTaskArn;
        const taskId = taskArn.split('/').pop();
        
        console.log(`[END SESSION] Stopping ECS task: ${taskArn}`);
        await ecsClient.send(new StopTaskCommand({
          cluster: 'shelcaster-vp-cluster',
          task: taskId,
          reason: 'Session ended by user'
        }));
        
        cleanupResults.ecsTask.success = true;
        console.log(`[END SESSION] ✓ Successfully stopped ECS task: ${taskArn}`);
      } catch (ecsError) {
        cleanupResults.ecsTask.error = ecsError.message;
        console.error(`[END SESSION] ✗ Failed to stop ECS task:`, ecsError);
      }
    } else {
      console.log('[END SESSION] No ECS task to stop');
    }

    // Stop IVS Composition if running
    if (session.ivs?.compositionArn) {
      cleanupResults.composition.attempted = true;
      try {
        console.log(`[END SESSION] Stopping IVS Composition: ${session.ivs.compositionArn}`);
        await ivsRealtimeClient.send(new StopCompositionCommand({
          arn: session.ivs.compositionArn
        }));
        cleanupResults.composition.success = true;
        console.log(`[END SESSION] ✓ Successfully stopped IVS Composition: ${session.ivs.compositionArn}`);
      } catch (compError) {
        cleanupResults.composition.error = compError.message;
        console.error(`[END SESSION] ✗ Failed to stop composition:`, compError);
      }
    } else {
      console.log('[END SESSION] No composition to stop');
    }

    // Delete composition relay IVS channel (temporary channel)
    if (session.ivs?.relayChannelArn) {
      cleanupResults.relayChannel.attempted = true;
      try {
        console.log(`[END SESSION] Deleting relay IVS channel: ${session.ivs.relayChannelArn}`);
        await ivsClient.send(new DeleteIvsChannelCommand({
          arn: session.ivs.relayChannelArn
        }));
        cleanupResults.relayChannel.success = true;
        console.log(`[END SESSION] ✓ Successfully deleted relay channel: ${session.ivs.relayChannelArn}`);
      } catch (relayError) {
        cleanupResults.relayChannel.error = relayError.message;
        console.error(`[END SESSION] ✗ Failed to delete relay channel:`, relayError);
      }
    } else {
      console.log('[END SESSION] No relay channel to delete');
    }

    // Update persistent channel state to IDLE (do NOT delete)
    if (session.ivs?.persistentChannelId) {
      cleanupResults.persistentChannel = { attempted: true, success: false, error: null };
      try {
        const persistentChannelId = session.ivs.persistentChannelId;
        console.log(`[END SESSION] Updating persistent channel ${persistentChannelId} state to IDLE`);
        
        // Get current channel stats for update
        const getChannelParams = {
          TableName: "shelcaster-app",
          Key: marshall({
            pk: `channel#${persistentChannelId}`,
            sk: 'info',
          }),
        };
        
        const channelResult = await dynamoDBClient.send(new GetItemCommand(getChannelParams));
        const channel = channelResult.Item ? unmarshall(channelResult.Item) : null;
        
        if (channel) {
          // Calculate streaming duration (if streaming started)
          let streamingMinutes = 0;
          if (session.streaming?.startedAt) {
            const startTime = new Date(session.streaming.startedAt);
            const endTime = new Date();
            streamingMinutes = Math.floor((endTime - startTime) / 60000); // Convert ms to minutes
          }
          
          // Update channel: state to IDLE, increment stats, clear session
          const updateChannelParams = {
            TableName: "shelcaster-app",
            Key: marshall({
              pk: `channel#${persistentChannelId}`,
              sk: 'info',
            }),
            UpdateExpression: 'SET #state = :state, currentSessionId = :nullValue, updatedAt = :now, totalBroadcasts = totalBroadcasts + :one, totalStreamingMinutes = totalStreamingMinutes + :minutes, lastBroadcastAt = :now',
            ExpressionAttributeNames: {
              '#state': 'state'
            },
            ExpressionAttributeValues: marshall({
              ':state': 'IDLE',
              ':nullValue': null,
              ':now': new Date().toISOString(),
              ':one': 1,
              ':minutes': streamingMinutes
            })
          };
          
          await dynamoDBClient.send(new UpdateItemCommand(updateChannelParams));
          cleanupResults.persistentChannel.success = true;
          console.log(`[END SESSION] ✓ Persistent channel ${persistentChannelId} updated to IDLE (preserved for reuse)`);
          console.log(`[END SESSION] ✓ Channel stats updated: +1 broadcast, +${streamingMinutes} minutes`);
        } else {
          console.warn(`[END SESSION] ⚠️ Persistent channel ${persistentChannelId} not found in DynamoDB`);
          cleanupResults.persistentChannel.error = 'Channel not found';
        }
      } catch (channelError) {
        cleanupResults.persistentChannel.error = channelError.message;
        console.error(`[END SESSION] ✗ Failed to update persistent channel:`, channelError);
      }
    } else {
      console.log('[END SESSION] No persistent channel to update (legacy session)');
    }

    // Delete RAW stage if it exists (this disconnects all participants)
    if (session.ivs?.rawStageArn) {
      cleanupResults.rawStage.attempted = true;
      try {
        console.log(`[END SESSION] Deleting RAW stage: ${session.ivs.rawStageArn}`);
        // Deleting the stage immediately disconnects all participants
        await ivsRealtimeClient.send(new DeleteStageCommand({
          arn: session.ivs.rawStageArn
        }));
        cleanupResults.rawStage.success = true;
        console.log(`[END SESSION] ✓ Successfully deleted RAW stage (all participants disconnected): ${session.ivs.rawStageArn}`);
      } catch (stageError) {
        cleanupResults.rawStage.error = stageError.message;
        console.error(`[END SESSION] ✗ Failed to delete RAW stage:`, stageError);
      }
    } else {
      console.log('[END SESSION] No RAW stage to delete');
    }

    // Delete PROGRAM stage if it exists
    if (session.ivs?.programStageArn) {
      cleanupResults.programStage.attempted = true;
      try {
        console.log(`[END SESSION] Deleting PROGRAM stage: ${session.ivs.programStageArn}`);
        await ivsRealtimeClient.send(new DeleteStageCommand({
          arn: session.ivs.programStageArn
        }));
        cleanupResults.programStage.success = true;
        console.log(`[END SESSION] ✓ Successfully deleted PROGRAM stage: ${session.ivs.programStageArn}`);
      } catch (stageError) {
        cleanupResults.programStage.error = stageError.message;
        console.error(`[END SESSION] ✗ Failed to delete PROGRAM stage:`, stageError);
      }
    } else {
      console.log('[END SESSION] No PROGRAM stage to delete');
    }

    // Cleanup MediaLive resources
    if (session.mediaLive?.channelId) {
      cleanupResults.mediaLiveChannel.attempted = true;
      try {
        const channelId = session.mediaLive.channelId;
        console.log(`[END SESSION] Cleaning up MediaLive channel: ${channelId}`);

        // Stop channel first
        try {
          console.log(`[END SESSION] Stopping MediaLive channel: ${channelId}`);
          await mediaLiveClient.send(new StopChannelCommand({ ChannelId: channelId }));
          console.log(`[END SESSION] ✓ MediaLive channel stopped: ${channelId}`);

          // Wait for channel to stop (max 30 seconds)
          console.log('[END SESSION] Waiting for channel to stop...');
          let attempts = 0;
          while (attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
          console.log('[END SESSION] Wait complete');
        } catch (stopError) {
          console.log(`[END SESSION] Channel stop warning (may already be stopped): ${stopError.message}`);
        }

        // Delete channel
        try {
          console.log(`[END SESSION] Deleting MediaLive channel: ${channelId}`);
          await mediaLiveClient.send(new DeleteChannelCommand({ ChannelId: channelId }));
          cleanupResults.mediaLiveChannel.success = true;
          console.log(`[END SESSION] ✓ Successfully deleted MediaLive channel: ${channelId}`);
        } catch (deleteError) {
          cleanupResults.mediaLiveChannel.error = deleteError.message;
          console.error(`[END SESSION] ✗ Failed to delete MediaLive channel:`, deleteError);
        }

        // Delete all inputs (participants, tracklist)
        if (session.mediaLive.inputIds && typeof session.mediaLive.inputIds === 'object') {
          cleanupResults.mediaLiveInputs.attempted = true;
          console.log(`[END SESSION] Deleting ${Object.keys(session.mediaLive.inputIds).length} MediaLive inputs`);
          
          for (const [sourceName, inputId] of Object.entries(session.mediaLive.inputIds)) {
            try {
              console.log(`[END SESSION] Deleting MediaLive input ${sourceName}: ${inputId}`);
              await mediaLiveClient.send(new DeleteInputCommand({ InputId: inputId }));
              cleanupResults.mediaLiveInputs.deletedCount++;
              console.log(`[END SESSION] ✓ Successfully deleted MediaLive input ${sourceName}: ${inputId}`);
            } catch (inputError) {
              console.error(`[END SESSION] ✗ Failed to delete input ${sourceName}:`, inputError);
            }
          }
          
          cleanupResults.mediaLiveInputs.success = cleanupResults.mediaLiveInputs.deletedCount === Object.keys(session.mediaLive.inputIds).length;
          console.log(`[END SESSION] Deleted ${cleanupResults.mediaLiveInputs.deletedCount}/${Object.keys(session.mediaLive.inputIds).length} MediaLive inputs`);
        }
      } catch (mlError) {
        cleanupResults.mediaLiveChannel.error = mlError.message;
        console.error('[END SESSION] ✗ MediaLive cleanup error:', mlError);
      }
    } else {
      console.log('[END SESSION] No MediaLive channel to clean up');
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

    // Log cleanup summary
    console.log('[END SESSION] Cleanup Summary:', JSON.stringify(cleanupResults, null, 2));
    
    const hasFailures = Object.values(cleanupResults).some(r => r.attempted && !r.success);
    if (hasFailures) {
      console.warn('[END SESSION] ⚠️ Some cleanup operations failed - check logs above');
    } else {
      console.log('[END SESSION] ✓ All cleanup operations completed successfully');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Session ended successfully',
        sessionId,
        cleanupResults,
        warning: hasFailures ? 'Some resources may not have been deleted - check CloudWatch logs' : null
      }),
    };
  } catch (error) {
    console.error('[END SESSION] ✗ Critical error ending session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to end session",
        error: error.message,
        cleanupResults
      }),
    };
  }
};
