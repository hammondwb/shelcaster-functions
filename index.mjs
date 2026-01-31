import { DynamoDBClient, QueryCommand, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dbClient = new DynamoDBClient();

export const handler = async (event) => {
  try {
    console.log("Event received:", JSON.stringify(event));

    const { networkId, channelId, playlistId } = event.pathParameters || {};
    const { limit, lastKey, getByCustomOrder = "false" } = event.queryStringParameters || {};
    const parsedLimit = limit ? +limit : 20; // Default to 20 programs per page
    const doGetByCustomOrder = getByCustomOrder === "true";
    console.log("programs from get programs", networkId, channelId, playlistId);
    console.log("lastKey from query params:", lastKey);
    console.log("limit:", parsedLimit);

    if (!networkId || !channelId || !playlistId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Required path params is missing" }),
      }
    }
    const params = {
      TableName: "shelcaster-app",
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: marshall({
        ":pk": `n#${networkId}#ch#${channelId}#pl#${playlistId}`,
        ":sk": `p#`,
      }),
      Limit: parsedLimit,
    };

    // Check if we should use GSI2
    if (doGetByCustomOrder) {
      params.IndexName = "GSI2";
      params.KeyConditionExpression = "GSI2PK = :pk AND begins_with(GSI2SK, :sk)";
    } else {
      params.KeyConditionExpression = "pk = :pk AND begins_with(sk, :sk)";
    }

    if (lastKey) {
      try {
        console.log("Received lastKey:", lastKey);
        // The lastKey is a JSON string of the unmarshalled key
        // We need to parse it and then marshall it for DynamoDB
        const parsedKey = JSON.parse(lastKey);
        console.log("Parsed lastKey:", parsedKey);

        // Marshall the key for DynamoDB
        params.ExclusiveStartKey = marshall(parsedKey);
        console.log("Marshalled ExclusiveStartKey:", JSON.stringify(params.ExclusiveStartKey));
      } catch (e) {
        console.error("Error parsing/marshalling lastKey:", e);
        console.error("Error stack:", e.stack);
        console.warn("Malformed lastKey passed, ignoring it:", lastKey);
        // Don't set ExclusiveStartKey if there's an error
      }
    }

    console.log("Query params:", JSON.stringify(params, null, 2));

    let result;
    try {
      const command = new QueryCommand(params);
      result = await dbClient.send(command);
      console.log("Playlist programs query result", result);
    } catch (queryError) {
      console.error("Error executing Query command:", queryError);
      console.error("Query error stack:", queryError.stack);
      throw queryError;
    }

    // Get the playlist programs (these contain programId references)
    const playlistPrograms = result.Items ? result.Items.map((item) => unmarshall(item)) : [];
    console.log("Playlist programs count:", playlistPrograms.length);
    console.log("First playlist program sample:", playlistPrograms[0]);

    if (playlistPrograms.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          Items: [],
          LastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(unmarshall(result.LastEvaluatedKey)) : null,
        }),
      };
    }

    // Extract unique programIds from playlist programs
    const programIds = [...new Set(playlistPrograms.map(p => p.programId).filter(Boolean))];
    console.log("Program IDs to enrich:", programIds);
    console.log("Number of program IDs:", programIds.length);

    // Fetch full program data from network programs table using BatchGetItem
    // DynamoDB BatchGetItem has a limit of 100 items per request
    const enrichedProgramsMap = new Map();

    // Only fetch if there are programIds to enrich
    if (programIds.length > 0) {
      // Process in batches of 100 (DynamoDB limit)
      for (let i = 0; i < programIds.length; i += 100) {
        const batchProgramIds = programIds.slice(i, i + 100);

        console.log(`Processing batch ${i / 100 + 1}, programIds:`, batchProgramIds);

        const batchGetParams = {
          RequestItems: {
            "shelcaster-app": {
              Keys: batchProgramIds.map(programId => marshall({
                pk: `n#${networkId}#pr#${programId}`,
                sk: `n#${networkId}#pr#${programId}`
              }))
            }
          }
        };

        try {
          const batchCommand = new BatchGetItemCommand(batchGetParams);
          const batchResult = await dbClient.send(batchCommand);
          console.log(`Batch ${i / 100 + 1} result:`, batchResult);

          if (batchResult.Responses && batchResult.Responses["shelcaster-app"]) {
            batchResult.Responses["shelcaster-app"].forEach(item => {
              const program = unmarshall(item);
              enrichedProgramsMap.set(program.programId, program);
            });
          }
        } catch (batchError) {
          console.error("Error in BatchGetItem:", batchError);
          console.error("BatchGetItem error stack:", batchError.stack);
          // Continue processing even if batch fails
        }
      }
    }

    console.log("Enriched programs map size:", enrichedProgramsMap.size);

    // Merge playlist program data with full network program data
    const enrichedPrograms = playlistPrograms.map(playlistProgram => {
      const networkProgram = enrichedProgramsMap.get(playlistProgram.programId);

      if (networkProgram) {
        // Merge: network program data as base, playlist-specific fields override
        return {
          ...networkProgram,
          ...playlistProgram,
        };
      } else {
        // If network program not found, return playlist program as-is
        console.warn("Network program not found for programId:", playlistProgram.programId);
        return playlistProgram;
      }
    });

    console.log("Enriched programs count:", enrichedPrograms.length);
    console.log("First enriched program sample:", enrichedPrograms[0]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        Items: enrichedPrograms,
        LastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(unmarshall(result.LastEvaluatedKey)) : null,
      }),
    };
  } catch (error) {
    console.error("Error in Lambda handler:", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
        stack: error.stack
      }),
    };
  }
};