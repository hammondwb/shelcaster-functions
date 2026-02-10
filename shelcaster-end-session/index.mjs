import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ECSClient, StopTaskCommand } from "@aws-sdk/client-ecs";
import { IVSClient, DeleteChannelCommand } from "@aws-sdk/client-ivs";
import { IVSRealTimeClient, DeleteStageCommand } from "@aws-sdk/client-ivs-realtime";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const ecsClient = new ECSClient({ region: "us-east-1" });
const ivsClient = new IVSClient({ region: "us-east-1" });
const ivsRealtimeClient = new IVSRealTimeClient({ region: "us-east-1" });

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

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

    // Delete IVS channel if it exists
    if (session.ivs?.channelArn) {
      try {
        await ivsClient.send(new DeleteChannelCommand({
          arn: session.ivs.channelArn
        }));
        console.log('Deleted IVS channel:', session.ivs.channelArn);
      } catch (ivsError) {
        console.error('Failed to delete IVS channel:', ivsError.message);
      }
    }

    // Delete RAW stage if it exists
    if (session.ivs?.rawStageArn) {
      try {
        await ivsRealtimeClient.send(new DeleteStageCommand({
          arn: session.ivs.rawStageArn
        }));
        console.log('Deleted RAW stage:', session.ivs.rawStageArn);
      } catch (stageError) {
        console.error('Failed to delete RAW stage:', stageError.message);
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
