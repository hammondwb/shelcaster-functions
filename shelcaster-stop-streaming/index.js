const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const dynamoDBClient = new DynamoDBClient({ region: 'us-east-1' });
const TABLE_NAME = 'shelcaster-app';

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
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
    
    // TODO: Stop IVS channel (requires fixing SDK import issue)
    
    // Update DynamoDB streaming state
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
    
    console.log('Streaming stopped in DynamoDB');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Streaming stopped (DynamoDB only - IVS integration pending)'
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
