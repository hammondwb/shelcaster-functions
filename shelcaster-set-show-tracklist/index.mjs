import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient({ region: 'us-east-1' });

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const showId = event.pathParameters.showId;
  const body = JSON.parse(event.body);
  const { tracklistId } = body;
  
  if (!tracklistId) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      },
      body: JSON.stringify({ error: 'tracklistId is required' })
    };
  }
  
  try {
    await dynamoDBClient.send(new UpdateItemCommand({
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info'
      }),
      UpdateExpression: 'SET tracklistId = :tracklistId, updatedAt = :now',
      ExpressionAttributeValues: marshall({
        ':tracklistId': tracklistId,
        ':now': new Date().toISOString()
      })
    }));
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      },
      body: JSON.stringify({
        message: 'Tracklist set for show',
        showId,
        tracklistId
      })
    };
  } catch (error) {
    console.error('Error setting show tracklist:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      },
      body: JSON.stringify({ error: 'Failed to set show tracklist' })
    };
  }
};
