const { IVSRealTime, CreateParticipantTokenCommand } = require("@aws-sdk/client-ivs-realtime");
const { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const ivsRealTimeClient = new IVSRealTime({ region: "us-east-1" });
const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId } = event.pathParameters;
    const { callerName, callerId } = JSON.parse(event.body || '{}');

    if (!showId || !callerName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId or callerName parameter" }),
      };
    }

    // ── Deterministic session resolution ──
    // Find most recent ACTIVE LiveSession for this showId to get rawStageArn
    const queryParams = {
      TableName: "shelcaster-app",
      IndexName: "entityType-index",
      KeyConditionExpression: "entityType = :et",
      FilterExpression: "showId = :showId AND #st = :status",
      ExpressionAttributeNames: {
        "#st": "status",
      },
      ExpressionAttributeValues: marshall({
        ":et": "liveSession",
        ":showId": showId,
        ":status": "ACTIVE",
      }),
    };

    const queryResult = await dynamoDBClient.send(new QueryCommand(queryParams));
    const activeSessions = (queryResult.Items || []).map(item => unmarshall(item));

    if (activeSessions.length === 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ message: "No active session. Host must Join Stage first." }),
      };
    }

    // Sort by createdAt DESC → pick newest
    activeSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const session = activeSessions[0];
    const rawStageArn = session.ivs?.rawStageArn;

    if (!rawStageArn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Active session does not have a RAW stage." }),
      };
    }

    console.log(`Resolved showId=${showId} → sessionId=${session.sessionId}, rawStageArn=${rawStageArn}`);

    // Create participant token for caller on the RAW stage
    const userId = callerId || `caller-${Date.now()}`;

    const tokenCommand = new CreateParticipantTokenCommand({
      stageArn: rawStageArn,
      duration: 7200, // 2 hours
      capabilities: ['PUBLISH', 'SUBSCRIBE'],
      userId: userId,
      attributes: {
        username: callerName,
        role: 'caller',
      },
    });

    const tokenResponse = await ivsRealTimeClient.send(tokenCommand);

    // Store caller/guest name in DynamoDB under the show
    const putGuestParams = {
      TableName: "shelcaster-app",
      Item: marshall({
        pk: `show#${showId}`,
        sk: `guest#${userId}`,
        name: callerName, // Use 'name' to match existing schema
        userId: userId,
        status: 'connected',
        joinedAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hour TTL
      }),
    };

    await dynamoDBClient.send(new PutItemCommand(putGuestParams));
    console.log('Stored guest name:', userId, callerName);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token: tokenResponse.participantToken.token,
        participantId: tokenResponse.participantToken.participantId,
        userId: userId,
        stageArn: rawStageArn,
        sessionId: session.sessionId,
      }),
    };
  } catch (error) {
    console.error('Error creating caller token:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to create caller token",
        error: error.message 
      }),
    };
  }
};

