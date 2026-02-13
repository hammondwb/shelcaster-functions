/**
 * shelcaster-create-tracklist
 * POST /shows/{showId}/tracklist
 * 
 * Creates a tracklist for a show if it doesn't exist
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const showId = event.pathParameters?.showId;
  
  if (!showId) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({ error: 'showId is required' })
    };
  }

  try {
    // Check if show exists
    const showResult = await docClient.send(new GetCommand({
      TableName: 'shelcaster-app',
      Key: {
        pk: `show#${showId}`,
        sk: 'info'
      }
    }));

    if (!showResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({ error: 'Show not found' })
      };
    }

    // Check if tracklist already exists
    if (showResult.Item.tracklistId) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({ 
          tracklistId: showResult.Item.tracklistId,
          message: 'Tracklist already exists'
        })
      };
    }

    // Create new tracklist
    const tracklistId = randomUUID();
    const now = new Date().toISOString();

    // Create tracklist item
    await docClient.send(new PutCommand({
      TableName: 'shelcaster-app',
      Item: {
        pk: `tracklist#${tracklistId}`,
        sk: 'info',
        tracklistId,
        showId,
        programs: [],
        createdAt: now,
        updatedAt: now
      }
    }));

    // Update show with tracklistId
    await docClient.send(new PutCommand({
      TableName: 'shelcaster-app',
      Item: {
        ...showResult.Item,
        tracklistId,
        updatedAt: now
      }
    }));

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({ 
        tracklistId,
        message: 'Tracklist created successfully'
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
