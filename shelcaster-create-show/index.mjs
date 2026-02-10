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
      // Accept scheduledDate (per Studio-Features-Next §1) or legacy scheduledStartTime
      scheduledDate,
      scheduledStartTime,
      scheduledEndTime,
      tracklistId,
      status = 'scheduled'
    } = body;

    // Resolve the scheduled date — prefer scheduledDate, fall back to scheduledStartTime
    const resolvedScheduledDate = scheduledDate || scheduledStartTime;

    if (!title || !producerId || !resolvedScheduledDate) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required fields: title, producerId, scheduledDate" }),
      };
    }

    const showId = randomUUID();
    const groupId = randomUUID();
    const now = new Date().toISOString();

    // 1. Create the Show record
    const show = {
      pk: `show#${showId}`,
      sk: 'info',
      entityType: 'show',
      GSI1PK: `producer#${producerId}`,
      GSI1SK: `show#${resolvedScheduledDate}#${showId}`,
      showId,
      title,
      description: description || '',
      producerId,
      scheduledDate: resolvedScheduledDate,
      scheduledStartTime: resolvedScheduledDate, // backward compat
      scheduledEndTime: scheduledEndTime || null,
      tracklistId: tracklistId || null,
      groupId, // Media Manager group created at show creation (§1.2)
      status, // scheduled, live, completed, cancelled
      createdAt: now,
      updatedAt: now,
      actualStartTime: null,
      actualEndTime: null,
      viewerCount: 0,
      peakViewerCount: 0,
    };

    await dynamoDBClient.send(new PutItemCommand({
      TableName: "shelcaster-app",
      Item: marshall(show),
    }));

    // 2. Create Media Manager group at show creation time (§1.2)
    //    Group name defaults to show title, ownership = producerId (hostUserId)
    const group = {
      pk: `u#${producerId}#groups`,
      sk: `g#${groupId}`,
      entityType: "group",
      programsCount: 0,
      ownerId: producerId,
      groupId,
      name: title,
      showId, // link back to the show
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDBClient.send(new PutItemCommand({
      TableName: "shelcaster-app",
      Item: marshall(group),
    }));

    console.log(`Show ${showId} created with Media Manager group ${groupId}`);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ show, groupId }),
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

