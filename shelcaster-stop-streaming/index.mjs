import IVSPkg from '@aws-sdk/client-ivs';
import DynamoDBPkg from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const { IVSClient, StopChannelCommand } = IVSPkg;
const { DynamoDBClient, UpdateItemCommand } = DynamoDBPkg;

const ivsClient = new IVSClient({ region: "us-east-1" });
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
    const body = JSON.parse(event.body || '{}');
    const channelArn = body.channelArn;
    
    if (!sessionId || !channelArn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing sessionId or channelArn' })
      };
    }
    
    await ivsClient.send(new StopChannelCommand({ arn: channelArn }));
    
    await dynamoDBClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        pk: `session#${sessionId}`,
        sk: 'info'
      }),
      UpdateExpression: 'SET streaming.isLive = :live, updatedAt = :now',
      ExpressionAttributeValues: marshall({
        ':live': false,
        ':now': new Date().toISOString()
      })
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Streaming stopped' })
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
