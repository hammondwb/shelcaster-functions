import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Ivs, GetStreamCommand } from "@aws-sdk/client-ivs";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const ivsClient = new Ivs({ region: "us-east-1" });

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId } = event.pathParameters;

    if (!showId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId parameter" }),
      };
    }

    // Get the show to check if it has an IVS channel
    const getShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
    };

    const showResult = await dynamoDBClient.send(new GetItemCommand(getShowParams));
    const show = showResult.Item ? unmarshall(showResult.Item) : null;

    if (!show) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Show not found" }),
      };
    }

    if (!show.ivsChannelArn) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Show does not have an IVS channel. Create one first." }),
      };
    }

    const now = new Date().toISOString();

    // Check if stream is already live
    let streamHealth = 'UNKNOWN';
    let viewerCount = 0;
    try {
      const streamData = await ivsClient.send(new GetStreamCommand({
        channelArn: show.ivsChannelArn
      }));
      streamHealth = streamData.stream?.health || 'UNKNOWN';
      viewerCount = streamData.stream?.viewerCount || 0;
    } catch (error) {
      console.log('No active stream yet:', error.message);
    }

    // Update show status to live
    const params = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #status = :status, #actualStartTime = :actualStartTime, #streamHealth = :streamHealth, #viewerCount = :viewerCount, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#actualStartTime': 'actualStartTime',
        '#streamHealth': 'streamHealth',
        '#viewerCount': 'viewerCount',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':status': 'live',
        ':actualStartTime': now,
        ':streamHealth': streamHealth,
        ':viewerCount': viewerCount,
        ':updatedAt': now,
      }),
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    const updatedShow = unmarshall(result.Attributes);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        show: updatedShow,
        streamInfo: {
          playbackUrl: updatedShow.ivsPlaybackUrl,
          ingestEndpoint: updatedShow.ivsIngestEndpoint,
          streamKey: updatedShow.ivsStreamKey,
          streamHealth,
          viewerCount,
        }
      }),
    };
  } catch (error) {
    console.error("Error starting broadcast:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

