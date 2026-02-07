import { DynamoDBClient, UpdateItemCommand, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Ivs, StopStreamCommand, GetStreamCommand, DeleteChannelCommand } from "@aws-sdk/client-ivs";
import { IVSRealTimeClient, StopCompositionCommand, DeleteStageCommand } from "@aws-sdk/client-ivs-realtime";
import { ECSClient, StopTaskCommand } from "@aws-sdk/client-ecs";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const ivsClient = new Ivs({ region: "us-east-1" });
const ivsRealTimeClient = new IVSRealTimeClient({ region: "us-east-1" });
const ecsClient = new ECSClient({ region: "us-east-1" });

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId } = event.pathParameters;

    if (!showId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId parameter" }),
      };
    }

    // Get the show to check if it has an IVS channel
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

    // Stop the IVS stream if it exists
    let finalViewerCount = 0;
    let peakViewerCount = show.peakViewerCount || 0;

    // Stop the composition first (this is what streams Stage to Channel)
    if (show.compositionArn) {
      try {
        await ivsRealTimeClient.send(new StopCompositionCommand({
          arn: show.compositionArn
        }));
        console.log('Composition stopped successfully:', show.compositionArn);
      } catch (error) {
        console.log('Error stopping composition or already stopped:', error.message);
      }
    }

    // Stop the IVS stream
    if (show.ivsChannelArn) {
      try {
        // Get final stream stats before stopping
        const streamData = await ivsClient.send(new GetStreamCommand({
          channelArn: show.ivsChannelArn
        }));
        finalViewerCount = streamData.stream?.viewerCount || 0;

        // Stop the stream
        await ivsClient.send(new StopStreamCommand({
          channelArn: show.ivsChannelArn
        }));

        console.log('IVS stream stopped successfully');
      } catch (error) {
        console.log('Error stopping stream or stream already stopped:', error.message);
      }
    }

    const now = new Date().toISOString();

    // ── LiveSession cleanup ──────────────────────────────────────────
    // Find the active LiveSession for this show and tear down all
    // session-scoped resources (ECS task, stages, channel).
    let sessionCleanupResult = null;
    try {
      const sessionQuery = await dynamoDBClient.send(new QueryCommand({
        TableName: "shelcaster-app",
        IndexName: "entityType-index",
        KeyConditionExpression: "entityType = :et",
        FilterExpression: "showId = :showId AND #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":et": "liveSession",
          ":showId": showId,
          ":status": "ACTIVE",
        }),
        ScanIndexForward: false,
      }));

      const sessions = (sessionQuery.Items || []).map(i => unmarshall(i));
      if (sessions.length > 0) {
        const session = sessions[0]; // newest active session
        const ivs = session.ivs || {};
        console.log('Found active LiveSession:', session.sessionId);

        // 1. Stop ECS task (virtual participant)
        if (ivs.programControllerTaskArn) {
          try {
            await ecsClient.send(new StopTaskCommand({
              cluster: 'shelcaster-vp-cluster',
              task: ivs.programControllerTaskArn,
              reason: 'Broadcast stopped',
            }));
            console.log('ECS task stopped:', ivs.programControllerTaskArn);
          } catch (e) { console.log('ECS stop error (may already be stopped):', e.message); }
        }

        // 2. Stop composition on PROGRAM stage
        if (ivs.compositionArn) {
          try {
            await ivsRealTimeClient.send(new StopCompositionCommand({ arn: ivs.compositionArn }));
            console.log('Session composition stopped:', ivs.compositionArn);
          } catch (e) { console.log('Composition stop error:', e.message); }
        }

        // 3. Delete RAW stage
        if (ivs.rawStageArn) {
          try {
            await ivsRealTimeClient.send(new DeleteStageCommand({ arn: ivs.rawStageArn }));
            console.log('RAW stage deleted:', ivs.rawStageArn);
          } catch (e) { console.log('RAW stage delete error:', e.message); }
        }

        // 4. Delete PROGRAM stage
        if (ivs.programStageArn) {
          try {
            await ivsRealTimeClient.send(new DeleteStageCommand({ arn: ivs.programStageArn }));
            console.log('PROGRAM stage deleted:', ivs.programStageArn);
          } catch (e) { console.log('PROGRAM stage delete error:', e.message); }
        }

        // 5. Delete PROGRAM channel
        if (ivs.programChannelArn) {
          try {
            await ivsClient.send(new DeleteChannelCommand({ arn: ivs.programChannelArn }));
            console.log('PROGRAM channel deleted:', ivs.programChannelArn);
          } catch (e) { console.log('PROGRAM channel delete error:', e.message); }
        }

        // 6. Mark LiveSession as COMPLETED
        await dynamoDBClient.send(new UpdateItemCommand({
          TableName: "shelcaster-app",
          Key: marshall({ pk: `session#${session.sessionId}`, sk: 'info' }),
          UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#status': 'status', '#updatedAt': 'updatedAt' },
          ExpressionAttributeValues: marshall({ ':status': 'COMPLETED', ':updatedAt': now }),
        }));
        console.log('LiveSession marked COMPLETED:', session.sessionId);
        sessionCleanupResult = { sessionId: session.sessionId, cleaned: true };
      } else {
        console.log('No active LiveSession found for show:', showId);
      }
    } catch (sessionError) {
      console.error('LiveSession cleanup error (non-fatal):', sessionError.message);
    }

    // ── Update show status to completed ──────────────────────────────
    const params = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #status = :status, #actualEndTime = :actualEndTime, #finalViewerCount = :finalViewerCount, #peakViewerCount = :peakViewerCount, #streamHealth = :streamHealth, #updatedAt = :updatedAt REMOVE #compositionArn',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#actualEndTime': 'actualEndTime',
        '#finalViewerCount': 'finalViewerCount',
        '#peakViewerCount': 'peakViewerCount',
        '#streamHealth': 'streamHealth',
        '#updatedAt': 'updatedAt',
        '#compositionArn': 'compositionArn',
      },
      ExpressionAttributeValues: marshall({
        ':status': 'completed',
        ':actualEndTime': now,
        ':finalViewerCount': finalViewerCount,
        ':peakViewerCount': Math.max(peakViewerCount, finalViewerCount),
        ':streamHealth': 'STOPPED',
        ':updatedAt': now,
      }),
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        show: unmarshall(result.Attributes),
        sessionCleanup: sessionCleanupResult,
        message: 'Broadcast stopped. Session resources cleaned up.',
      }),
    };
  } catch (error) {
    console.error("Error stopping broadcast:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

