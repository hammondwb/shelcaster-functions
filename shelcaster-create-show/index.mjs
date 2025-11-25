import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const body = JSON.parse(event.body);
    const { 
      title, 
      description, 
      producerId, 
      scheduledStartTime, 
      scheduledEndTime,
      tracklistId,
      status = 'scheduled'
    } = body;

    if (!title || !producerId || !scheduledStartTime) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required fields: title, producerId, scheduledStartTime" }),
      };
    }

    const showId = randomUUID();
    const now = new Date().toISOString();

    const show = {
      pk: `show#${showId}`,
      sk: 'info',
      entityType: 'show',
      GSI1PK: `producer#${producerId}`,
      GSI1SK: `show#${scheduledStartTime}#${showId}`,
      showId,
      title,
      description: description || '',
      producerId,
      scheduledStartTime,
      scheduledEndTime: scheduledEndTime || null,
      tracklistId: tracklistId || null,
      status, // scheduled, live, completed, cancelled
      createdAt: now,
      updatedAt: now,
      actualStartTime: null,
      actualEndTime: null,
      viewerCount: 0,
      peakViewerCount: 0,
    };

    const params = {
      TableName: "shelcaster-app",
      Item: marshall(show),
    };

    await dynamoDBClient.send(new PutItemCommand(params));

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ show }),
    };
  } catch (error) {
    console.error("Error creating show:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

