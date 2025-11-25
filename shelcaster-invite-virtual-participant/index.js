const { IVSRealTime, CreateParticipantTokenCommand } = require("@aws-sdk/client-ivs-realtime");
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");

const ivsRealTimeClient = new IVSRealTime({ region: "us-east-1" });
const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const ecsClient = new ECSClient({ region: "us-east-1" });

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // Handle OPTIONS request for CORS
  if (event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { showId } = event.pathParameters;
    const { tracklistUrl } = JSON.parse(event.body || '{}');

    if (!showId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing showId parameter" }),
      };
    }

    // Get the show to get stage ARN
    const getShowParams = {
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
    };

    const showResult = await dynamoDBClient.send(new GetItemCommand(getShowParams));
    const show = showResult.Item ? unmarshall(showResult.Item) : null;

    if (!show || !show.stageArn) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Show or stage not found" }),
      };
    }

    // Create participant token for virtual participant
    const vpId = `vp-${showId}`;
    const tokenCommand = new CreateParticipantTokenCommand({
      stageArn: show.stageArn,
      duration: 720, // 12 hours (in minutes)
      capabilities: ['PUBLISH'], // Only publish, don't subscribe
      userId: vpId,
      attributes: {
        username: 'Tracklist Player',
        role: 'virtual-participant',
        showId: showId,
      },
    });

    const tokenResponse = await ivsRealTimeClient.send(tokenCommand);

    // Store VP info in DynamoDB using the same table as shows
    const vpRecord = {
      pk: `show#${showId}`,
      sk: 'vp#info',
      vpId: vpId,
      showId: showId,
      stageArn: show.stageArn,
      participantToken: tokenResponse.participantToken.token,
      participantId: tokenResponse.participantToken.participantId,
      tracklistUrl: tracklistUrl || null,
      status: 'INVITED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dynamoDBClient.send(new PutItemCommand({
      TableName: "shelcaster-app",
      Item: marshall(vpRecord),
    }));

    // Start ECS task - always try to start it
    try {
      const runTaskParams = {
        cluster: 'shelcaster-vp-cluster',
        taskDefinition: 'shelcaster-vp:1',
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: ['subnet-0d18ba700259e4ef4'],
            assignPublicIp: 'ENABLED',
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: 'shelcaster-vp',
              environment: [
                { name: 'VP_ID', value: vpId },
                { name: 'SHOW_ID', value: showId },
                { name: 'STAGE_TOKEN', value: tokenResponse.participantToken.token },
                { name: 'TRACKLIST_URL', value: tracklistUrl || '' },
              ],
            },
          ],
        },
      };

      const taskResult = await ecsClient.send(new RunTaskCommand(runTaskParams));
      console.log('ECS task started:', taskResult.tasks?.[0]?.taskArn);

      vpRecord.taskArn = taskResult.tasks?.[0]?.taskArn;
      vpRecord.status = 'STARTING';

      // Update record with task ARN
      await dynamoDBClient.send(new PutItemCommand({
        TableName: "shelcaster-app",
        Item: marshall(vpRecord),
      }));
    } catch (ecsError) {
      console.error('Error starting ECS task:', ecsError);
      vpRecord.status = 'ERROR';
      vpRecord.error = ecsError.message;
      // Continue anyway - return the token so it can be used manually
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        vpId: vpId,
        participantId: tokenResponse.participantToken.participantId,
        status: vpRecord.status,
        message: 'Virtual participant invited successfully',
      }),
    };
  } catch (error) {
    console.error('Error inviting virtual participant:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to invite virtual participant",
        error: error.message 
      }),
    };
  }
};

