import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({});

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export const handler = async (event) => {
  try {
    const { networkId } = event.pathParameters;
    const { programsItems, userWithAccess } = JSON.parse(event.body);
    const hasDuplicateProgramId = new Set(programsItems.map(p => p.programId)).size !== programsItems.length;
    const invalidPrograms = !Array.isArray(programsItems) || programsItems.length === 0 || hasDuplicateProgramId;

    if (!networkId || invalidPrograms) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing networkId or invalid programs array" }),
      };
    }

    if(programsItems.length > 25) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "programsItems cannot be larger than 25 items." }),
      };
    }

    if(userWithAccess.role !== "admin" || userWithAccess.userNetworkId !== networkId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Missing user permissions to update network." }),
      };
    }

    for (const program of programsItems) {
      if (!program.programId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "Each program must contain programId" }),
        };
      }
    }

    const writeRequests = programsItems.map((program) => ({
      PutRequest: {
        Item: marshall({
          pk: `n#${networkId}#programs`,
          sk: `p#${program.programId}`,
          entityType: "network#program",
          networkId,
          programId: program.programId,
          ownerId: program?.ownerId || "none",
          GSI1PK: `p#${program.programId}`,
          GSI1SK: `n#${networkId}#programs`,
          order: 0,
          ...program,
        }),
      },
    }));

    const chunks = [];
    while (writeRequests.length) {
      chunks.push(writeRequests.splice(0, 25));
    }

    for (const chunk of chunks) {
      const params = {
        RequestItems: {
          "shelcaster-app": chunk,
        },
      };

      await dynamoDBClient.send(new BatchWriteItemCommand(params));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Programs added to network successfully",
        programs: programsItems.map(({ programId, ownerId }) => ({ programId, ownerId })),
      }),
    };
  } catch (error) {
    console.error("Error adding programs to network:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};