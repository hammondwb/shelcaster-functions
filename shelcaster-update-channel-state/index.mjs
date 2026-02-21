import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

/**
 * Updates the state of a persistent channel
 * Valid states: IDLE, LIVE, OFFLINE
 */
export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle OPTIONS preflight
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { channelId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { newState, sessionId = null } = body;

    const validStates = ['IDLE', 'LIVE', 'OFFLINE'];
    
    if (!channelId || !newState) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required fields: channelId, newState" }),
      };
    }

    if (!validStates.includes(newState)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          message: "Invalid state. Must be one of: IDLE, LIVE, OFFLINE",
          providedState: newState
        }),
      };
    }

    const now = new Date().toISOString();

    // Update channel state
    const updateParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `channel#${channelId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #state = :state, updatedAt = :now, currentSessionId = :sessionId',
      ExpressionAttributeNames: {
        '#state': 'state'
      },
      ExpressionAttributeValues: marshall({
        ':state': newState,
        ':now': now,
        ':sessionId': sessionId
      }),
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(updateParams));
    const updatedChannel = unmarshall(result.Attributes);

    console.log(`Channel ${channelId} state updated to ${newState}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Channel state updated successfully',
        channelId,
        previousState: updatedChannel.state,
        newState,
        sessionId,
        updatedAt: now,
      }),
    };
  } catch (error) {
    console.error('Error updating channel state:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to update channel state",
        error: error.message,
      }),
    };
  }
};

/**
 * Helper function to validate channel availability
 * Can be imported by other Lambda functions
 */
export async function validateChannelAvailable(channelId) {
  const getParams = {
    TableName: "shelcaster-app",
    Key: marshall({
      pk: `channel#${channelId}`,
      sk: 'info',
    }),
  };

  const result = await dynamoDBClient.send(new GetItemCommand(getParams));
  
  if (!result.Item) {
    throw new Error('Channel not found');
  }

  const channel = unmarshall(result.Item);

  if (channel.state === 'LIVE') {
    throw new Error('Channel is currently in use. Please try again later.');
  }

  if (channel.state === 'OFFLINE') {
    throw new Error('Channel is temporarily unavailable. Please contact support.');
  }

  return channel;
}

/**
 * Helper function to get channel state
 * Can be imported by other Lambda functions
 */
export async function getChannelState(channelId) {
  const getParams = {
    TableName: "shelcaster-app",
    Key: marshall({
      pk: `channel#${channelId}`,
      sk: 'info',
    }),
  };

  const result = await dynamoDBClient.send(new GetItemCommand(getParams));
  
  if (!result.Item) {
    return null;
  }

  const channel = unmarshall(result.Item);
  return channel.state;
}
