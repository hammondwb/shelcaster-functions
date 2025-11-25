import { DynamoDBClient, PutItemCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
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
      name, 
      description, 
      producerId,
      programs = []
    } = body;

    if (!name || !producerId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing required fields: name, producerId" }),
      };
    }

    const tracklistId = randomUUID();
    const now = new Date().toISOString();

    // Calculate total duration
    const totalDuration = programs.reduce((sum, p) => sum + (p.duration || 0), 0);

    const tracklist = {
      pk: `tracklist#${tracklistId}`,
      sk: 'info',
      entityType: 'tracklist',
      GSI1PK: `producer#${producerId}`,
      GSI1SK: `tracklist#${now}#${tracklistId}`,
      tracklistId,
      name,
      description: description || '',
      producerId,
      totalDuration,
      programCount: programs.length,
      createdAt: now,
      updatedAt: now,
    };

    // Create the tracklist item
    const tracklistParams = {
      TableName: "shelcaster-app",
      Item: marshall(tracklist),
    };

    await dynamoDBClient.send(new PutItemCommand(tracklistParams));

    // If there are programs, add them to the tracklist
    if (programs.length > 0) {
      const writeRequests = programs.map((program, index) => ({
        PutRequest: {
          Item: marshall({
            pk: `tracklist#${tracklistId}`,
            sk: `program#${String(index).padStart(5, '0')}#${program.programId}`,
            entityType: 'tracklistProgram',
            tracklistId,
            programId: program.programId,
            order: index,
            title: program.title,
            duration: program.duration || 0,
            program_url: program.program_url || '',
            program_image: program.program_image || '',
          }),
        },
      }));

      // Batch write in chunks of 25 (DynamoDB limit)
      for (let i = 0; i < writeRequests.length; i += 25) {
        const chunk = writeRequests.slice(i, i + 25);
        const batchParams = {
          RequestItems: {
            "shelcaster-app": chunk,
          },
        };
        await dynamoDBClient.send(new BatchWriteItemCommand(batchParams));
      }
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ tracklist }),
    };
  } catch (error) {
    console.error("Error creating tracklist:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

