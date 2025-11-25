import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Ivs, StopStreamCommand, GetStreamCommand } from "@aws-sdk/client-ivs";

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

    // Stop the IVS stream if it exists
    let finalViewerCount = 0;
    let peakViewerCount = show.peakViewerCount || 0;

    if (show.ivsChannelArn) {
      try {
        // Get final stream stats before stopping
        const streamData = await ivsClient.send(new GetStreamCommand({
          channelArn: show.ivsChannelArn
        }));
        finalViewerCount = streamData.stream?.viewerCount || 0;

        // Stop the stream
        await ivsClient.send(new StopStreamCommand({
          channelArn: show.ivsChannelArn
        }));

        console.log('IVS stream stopped successfully');
      } catch (error) {
        console.log('Error stopping stream or stream already stopped:', error.message);
      }
    }

    const now = new Date().toISOString();

    // Update show status to completed
    const params = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET #status = :status, #actualEndTime = :actualEndTime, #finalViewerCount = :finalViewerCount, #peakViewerCount = :peakViewerCount, #streamHealth = :streamHealth, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#actualEndTime': 'actualEndTime',
        '#finalViewerCount': 'finalViewerCount',
        '#peakViewerCount': 'peakViewerCount',
        '#streamHealth': 'streamHealth',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: marshall({
        ':status': 'completed',
        ':actualEndTime': now,
        ':finalViewerCount': finalViewerCount,
        ':peakViewerCount': Math.max(peakViewerCount, finalViewerCount),
        ':streamHealth': 'STOPPED',
        ':updatedAt': now,
      }),
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        show: unmarshall(result.Attributes),
        message: 'Broadcast stopped. Recording will be available in S3 shortly.'
      }),
    };
  } catch (error) {
    console.error("Error stopping broadcast:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

