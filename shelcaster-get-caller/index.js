const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId, userId } = event.pathParameters;

    if (!showId || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId or userId parameter" }),
      };
    }

    // Get caller info from DynamoDB
    const getCallerParams = {
      TableName: "shelcaster-app",
      Key: {
        pk: { S: `show#${showId}` },
        sk: { S: `caller#${userId}` },
      },
    };

    const result = await dynamoDBClient.send(new GetItemCommand(getCallerParams));
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Caller not found" }),
      };
    }

    const caller = unmarshall(result.Item);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        userId: caller.userId,
        callerName: caller.callerName,
        joinedAt: caller.joinedAt,
      }),
    };
  } catch (error) {
    console.error('Error fetching caller:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to fetch caller",
        error: error.message 
      }),
    };
  }
};

