import { DynamoDBClient, QueryCommand, BatchWriteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export const handler = async (event) => {
  try {
    const { tracklistId } = event.pathParameters;
    const { programs } = JSON.parse(event.body);

    if (!tracklistId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing tracklistId parameter" }),
      };
    }

    if (!Array.isArray(programs)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "programs must be an array" }),
      };
    }

    // Step 1: Query all existing programs in the tracklist
    const queryParams = {
      TableName: "shelcaster-app",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: marshall({
        ":pk": `tracklist#${tracklistId}`,
        ":sk": "program#",
      }),
    };

    const existingPrograms = await dynamoDBClient.send(new QueryCommand(queryParams));
    
    // Step 2: Delete all existing programs
    if (existingPrograms.Items && existingPrograms.Items.length > 0) {
      const deleteRequests = existingPrograms.Items.map(item => ({
        DeleteRequest: {
          Key: {
            pk: item.pk,
            sk: item.sk,
          }
        }
      }));

      // Batch delete in chunks of 25 (DynamoDB limit)
      for (let i = 0; i < deleteRequests.length; i += 25) {
        const chunk = deleteRequests.slice(i, i + 25);
        await dynamoDBClient.send(new BatchWriteItemCommand({
          RequestItems: {
            "shelcaster-app": chunk
          }
        }));
      }
    }

    // Step 3: Use the program data sent from frontend
    console.log('Received programs:', programs);
    const fullPrograms = programs.map((program, index) => ({
      ...program,
      order: index
    }));
    console.log('Total programs to save:', fullPrograms.length);

    // Step 4: Create new programs with updated order and full data
    if (fullPrograms.length > 0) {
      const putRequests = fullPrograms.map((program, index) => ({
        PutRequest: {
          Item: marshall({
            pk: `tracklist#${tracklistId}`,
            sk: `program#${String(index).padStart(5, '0')}#${program.programId}`,
            entityType: 'tracklistProgram',
            tracklistId,
            programId: program.programId,
            order: index,
            title: program.title || program.name || '',
            duration: program.duration || 0,
            program_url: program.program_url || program.mediaUrl || program.media_url || '',
            program_image: program.program_image || program.thumbnail || program.image || '',
          }, { removeUndefinedValues: true }),
        },
      }));

      // Batch write in chunks of 25
      for (let i = 0; i < putRequests.length; i += 25) {
        const chunk = putRequests.slice(i, i + 25);
        await dynamoDBClient.send(new BatchWriteItemCommand({
          RequestItems: {
            "shelcaster-app": chunk
          }
        }));
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: "Tracklist programs updated successfully",
        programCount: fullPrograms.length
      }),
    };
  } catch (error) {
    console.error("Error updating tracklist programs:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

