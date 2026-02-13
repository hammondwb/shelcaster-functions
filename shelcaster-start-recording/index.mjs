import { MediaLiveClient, BatchUpdateScheduleCommand } from "@aws-sdk/client-medialive";
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const mediaLiveClient = new MediaLiveClient({ region: "us-east-1" });
const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

const TABLE_NAME = "shelcaster-app";

export const handler = async (event) => {
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
    const channelId = session.mediaLive?.channelId;
    
    if (!channelId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'MediaLive channel not configured' })
      };
    }
    
    const actionName = `start-recording-${sessionId}`;
    
    await mediaLiveClient.send(new BatchUpdateScheduleCommand({
      ChannelId: channelId,
      Creates: {
        ScheduleActions: [{
          ActionName: actionName,
          ScheduleActionStartSettings: {
            ImmediateModeScheduleActionStartSettings: {}
          },
          ScheduleActionSettings: {
            HlsOutputSettings: {}
          }
        }]
      }
    }));
    
    await dynamoDBClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info'
      }),
      UpdateExpression: 'SET recording.isRecording = :rec, recording.startedAt = :now, recording.actionName = :action, updatedAt = :now',
      ExpressionAttributeValues: marshall({
        ':rec': true,
        ':now': new Date().toISOString(),
        ':action': actionName
      })
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Recording started' })
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
