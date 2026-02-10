import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient({ region: 'us-east-1' });

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const showId = event.pathParameters.showId;
  
  try {
    const result = await dynamoDBClient.send(new GetItemCommand({
      TableName: 'shelcaster-app',
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info'
      })
    }));
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*'
        },
        body: JSON.stringify({ error: 'Show not found' })
      };
    }
    
    const show = unmarshall(result.Item);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      },
      body: JSON.stringify({
        tracklistId: show.tracklistId || null
      })
    };
  } catch (error) {
    console.error('Error getting show tracklist:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      },
      body: JSON.stringify({ error: 'Failed to get show tracklist' })
    };
  }
};
