import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const TABLE_NAME = 'shelcaster-app';
const CLOUDFRONT_DOMAIN = 'https://d2kyyx47f0bavc.cloudfront.net';

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { userId } = event.pathParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Missing userId' }),
      };
    }

    console.log('Fetching IVS recordings for userId:', userId);

    // Query DynamoDB for programs with sourceType: 'ivs-recording'
    const files = [];
    let lastEvaluatedKey = undefined;
    
    do {
      const queryParams = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `u#${userId}#programs`,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoClient.send(new QueryCommand(queryParams));
      
      if (result.Items) {
        // Filter for IVS recordings and extract the program_url
        const recordings = result.Items
          .filter(item => item.sourceType === 'ivs-recording' && item.program_url)
          .map(item => ({
            key: item.s3Key || item.programId,
            lastModified: item.createdAt ? new Date(item.createdAt) : undefined,
            size: item.fileSize || 0,
            url: item.program_url,
            name: item.title || 'IVS Recording',
          }));
        
        files.push(...recordings);
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Found ${files.length} IVS recordings`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        files,
        count: files.length,
      }),
    };
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: 'Failed to fetch recordings',
        error: error.message 
      }),
    };
  }
};
