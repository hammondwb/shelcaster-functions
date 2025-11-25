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
    const { showId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { name, email, role = 'guest' } = body;

    if (!showId || !name || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required fields: showId, name, email" }),
      };
    }

    const guestId = randomUUID();
    const now = new Date().toISOString();

    const guest = {
      pk: `show#${showId}`,
      sk: `guest#${guestId}`,
      entityType: 'showGuest',
      guestId,
      showId,
      name,
      email,
      role, // guest, co-host, interviewer
      status: 'invited', // invited, accepted, declined, joined, left
      invitedAt: now,
      joinedAt: null,
      leftAt: null,
    };

    const params = {
      TableName: "shelcaster-app",
      Item: marshall(guest),
    };

    await dynamoDBClient.send(new PutItemCommand(params));

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ guest }),
    };
  } catch (error) {
    console.error("Error inviting guest:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

