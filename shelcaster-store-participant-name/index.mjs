/**
 * Store Participant Name Lambda
 * Stores caller names in DynamoDB for display in host UI
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PARTICIPANT_NAMES_TABLE = 'ParticipantNames';

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { userId, name, action } = JSON.parse(event.body || '{}');

    if (action === 'store') {
      // Store participant name
      if (!userId || !name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'userId and name are required' }),
        };
      }

      await docClient.send(new PutCommand({
        TableName: PARTICIPANT_NAMES_TABLE,
        Item: {
          userId,
          name,
          timestamp: Date.now(),
          ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hour TTL
        },
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Name stored successfully' }),
      };
    } else if (action === 'get') {
      // Get participant name
      if (!userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'userId is required' }),
        };
      }

      const result = await docClient.send(new GetCommand({
        TableName: PARTICIPANT_NAMES_TABLE,
        Key: { userId },
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          name: result.Item?.name || null,
        }),
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid action. Use "store" or "get"' }),
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error', error: error.message }),
    };
  }
};

