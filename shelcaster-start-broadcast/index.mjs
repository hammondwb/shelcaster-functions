import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Ivs, GetStreamCommand } from "@aws-sdk/client-ivs";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const ivsClient = new Ivs({ region: "us-east-1" });

export const handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId } = event.pathParameters;
    console.log('Processing showId:', showId);

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
    console.log('Show retrieved:', JSON.stringify(show, null, 2));

    if (!show) {
      console.log('Show not found');
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Show not found" }),
      };
    }

    const now = new Date().toISOString();

    // Check stream health if a channel ARN is available
    // New infrastructure: PROGRAM channel is on the LiveSession, not the Show
    // Old infrastructure: channel was on show.ivsChannelArn
    let streamHealth = 'UNKNOWN';
    let viewerCount = 0;
    const channelArn = show.ivsChannelArn || null;
    if (channelArn) {
      try {
        const streamData = await ivsClient.send(new GetStreamCommand({
          channelArn
        }));
        streamHealth = streamData.stream?.health || 'UNKNOWN';
        viewerCount = streamData.stream?.viewerCount || 0;
      } catch (error) {
        console.log('No active stream yet:', error.message);
      }
    } else {
      console.log('No ivsChannelArn on Show — using new PROGRAM infrastructure (channel on LiveSession)');
    }

    // Update show status to live
    console.log('Updating show status to live...');
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

    console.log('DynamoDB update params:', JSON.stringify(params, null, 2));

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    console.log('DynamoDB update successful');
    const updatedShow = unmarshall(result.Attributes);
    console.log('Updated show:', JSON.stringify(updatedShow, null, 2));

    const response = {
      show: updatedShow,
      streamInfo: {
        playbackUrl: updatedShow.ivsPlaybackUrl,
        ingestEndpoint: updatedShow.ivsIngestEndpoint,
        streamKey: updatedShow.ivsStreamKey,
        streamHealth,
        viewerCount,
      }
    };

    console.log('Returning success response:', JSON.stringify(response, null, 2));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error starting broadcast:", error);
    console.error("Error stack:", error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message,
        errorType: error.name,
        stack: error.stack
      }),
    };
  }
};

