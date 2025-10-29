import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { userId, groupId } = event.pathParameters;
    const { programsItems } = JSON.parse(event.body);
    const someProgramsHaveNoIds = programsItems.some(p => !p.programId)

    if (!userId || !groupId || !Array.isArray(programsItems)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing userId, groupId or programs array" }),
      };
    }

    if (programsItems.length > 25) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "You can only create 25 programs at a time." }),
      };
    }

    if (someProgramsHaveNoIds) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Each program must have a unique 'programId' attribute." }),
      };
    }

    const writeRequests = programsItems.slice(0, 25).map((program) => ({
      PutRequest: {
        Item: marshall({
          pk: `u#${userId}#programs`,
          sk: `p#${program.programId}`,
          entityType: "program",
          GSI1PK: `u#${userId}#g#${groupId}`,
          GSI1SK: `p#${program.programId}`,
          groupId,
          ownerId: userId,
          ...program,
        }),
      },
    }));

    const params = {
      RequestItems: {
        "shelcaster-app": writeRequests,
      },
    };

    await dynamoDBClient.send(new BatchWriteItemCommand(params));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Programs written successfully",
      }),
    };
  } catch (error) {
    console.error("Error writing programs:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};