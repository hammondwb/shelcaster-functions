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
    const actionName = session.recording?.actionName;
    
    if (!channelId || !actionName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Recording not active' })
      };
    }
    
    await mediaLiveClient.send(new BatchUpdateScheduleCommand({
      ChannelId: channelId,
      Deletes: {
        ScheduleActions: [{
          ActionName: actionName
        }]
      }
    }));
    
    await dynamoDBClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info'
      }),
      UpdateExpression: 'SET recording.isRecording = :rec, updatedAt = :now',
      ExpressionAttributeValues: marshall({
        ':rec': false,
        ':now': new Date().toISOString()
      })
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Recording stopped' })
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
