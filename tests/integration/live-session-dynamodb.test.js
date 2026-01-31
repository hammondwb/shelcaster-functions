/**
 * Integration test for LiveSession DynamoDB operations
 * Phase 2 - Session Lifecycle Controller (DynamoDB integration)
 * 
 * Tests:
 * - Create session → verify DynamoDB item exists and status=ACTIVE
 * - Read session back from DynamoDB
 * - Print PK/SK and sessionId for verification
 * 
 * REQUIRES: RUN_INTEGRATION=1 environment variable
 * REQUIRES: Valid AWS credentials and access to shelcaster-app table
 */

const { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { fromIni } = require('@aws-sdk/credential-providers');
const { v4: uuidv4 } = require('uuid');
const testConfig = require('../test-config');

// Skip all tests in this file unless RUN_INTEGRATION=1
const describeIntegration = process.env.RUN_INTEGRATION === '1' ? describe : describe.skip;

describeIntegration('LiveSession - DynamoDB Integration', () => {
  let dynamoDBClient;
  let testSessionId;
  let testPK;
  let testSK;

  beforeAll(async () => {
    // Initialize DynamoDB client with explicit credentials from AWS profile
    const awsProfile = process.env.AWS_PROFILE || 'shelcaster-admin';

    dynamoDBClient = new DynamoDBClient({
      region: testConfig.awsRegion,
      credentials: fromIni({ profile: awsProfile })
    });

    console.log('\n=== Integration Test Configuration ===');
    console.log(`AWS Profile: ${awsProfile}`);
    console.log(`AWS Region: ${testConfig.awsRegion}`);
    console.log(`Table Name: ${testConfig.tableName}`);
    console.log(`Test Run ID: ${testConfig.testRunId}`);
    console.log('=====================================\n');
  });

  afterAll(async () => {
    // Cleanup: Delete the test session
    if (testPK && testSK) {
      try {
        console.log('\n=== Cleanup ===');
        console.log(`Deleting test session: ${testSessionId}`);
        
        const deleteParams = {
          TableName: testConfig.tableName,
          Key: marshall({
            pk: testPK,
            sk: testSK
          })
        };

        await dynamoDBClient.send(new DeleteItemCommand(deleteParams));
        console.log('✓ Test session deleted successfully');
      } catch (error) {
        console.error('Failed to cleanup test session:', error.message);
      }
    }
  });

  describe('Create and Read LiveSession', () => {
    it('should write a LiveSession to DynamoDB and read it back', async () => {
      // Generate test data
      testSessionId = uuidv4();
      const hostUserId = uuidv4();
      const showId = uuidv4();
      const episodeId = uuidv4();
      const now = new Date().toISOString();

      testPK = `session#${testSessionId}`;
      testSK = 'info';

      // Create LiveSession object
      const liveSession = {
        pk: testPK,
        sk: testSK,
        entityType: 'liveSession',
        sessionId: testSessionId,
        hostUserId,
        showId,
        episodeId,
        testRunId: testConfig.testRunId, // For test isolation
        ivs: {
          stageArn: null,
          compositionId: null,
          channelArn: null
        },
        participants: {
          host: { participantId: null },
          callers: []
        },
        programState: {
          activeVideoSource: 'host',
          audioLevels: {
            host: 1.0
          },
          overlayImageS3Key: null
        },
        tracklist: {
          playlistId: null,
          currentIndex: 0
        },
        streaming: {
          isLive: false,
          startedAt: null
        },
        recording: {
          isRecording: false,
          s3Prefix: `users/${hostUserId}/recordings/${showId}/`
        },
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      };

      console.log('\n=== Writing LiveSession to DynamoDB ===');
      console.log(`Session ID: ${testSessionId}`);
      console.log(`PK: ${testPK}`);
      console.log(`SK: ${testSK}`);
      console.log(`Host User ID: ${hostUserId}`);
      console.log(`Show ID: ${showId}`);
      console.log(`Episode ID: ${episodeId}`);
      console.log(`Status: ${liveSession.status}`);

      // Write to DynamoDB
      const putParams = {
        TableName: testConfig.tableName,
        Item: marshall(liveSession, { removeUndefinedValues: true })
      };

      const putResult = await dynamoDBClient.send(new PutItemCommand(putParams));
      expect(putResult.$metadata.httpStatusCode).toBe(200);
      console.log('✓ LiveSession written successfully');

      // Read back from DynamoDB
      console.log('\n=== Reading LiveSession from DynamoDB ===');
      const getParams = {
        TableName: testConfig.tableName,
        Key: marshall({
          pk: testPK,
          sk: testSK
        })
      };

      const getResult = await dynamoDBClient.send(new GetItemCommand(getParams));
      expect(getResult.Item).toBeDefined();
      console.log('✓ LiveSession retrieved successfully');

      // Unmarshall and verify
      const retrievedSession = unmarshall(getResult.Item);

      console.log('\n=== Verification Results ===');
      console.log(`PK: ${retrievedSession.pk}`);
      console.log(`SK: ${retrievedSession.sk}`);
      console.log(`Session ID: ${retrievedSession.sessionId}`);
      console.log(`Entity Type: ${retrievedSession.entityType}`);
      console.log(`Status: ${retrievedSession.status}`);
      console.log(`Host User ID: ${retrievedSession.hostUserId}`);
      console.log(`Show ID: ${retrievedSession.showId}`);
      console.log(`Episode ID: ${retrievedSession.episodeId}`);
      console.log(`Test Run ID: ${retrievedSession.testRunId}`);
      console.log(`Created At: ${retrievedSession.createdAt}`);
      console.log(`Updated At: ${retrievedSession.updatedAt}`);
      console.log('============================\n');

      // Assertions
      expect(retrievedSession.pk).toBe(testPK);
      expect(retrievedSession.sk).toBe(testSK);
      expect(retrievedSession.sessionId).toBe(testSessionId);
      expect(retrievedSession.entityType).toBe('liveSession');
      expect(retrievedSession.status).toBe('ACTIVE');
      expect(retrievedSession.hostUserId).toBe(hostUserId);
      expect(retrievedSession.showId).toBe(showId);
      expect(retrievedSession.episodeId).toBe(episodeId);
      expect(retrievedSession.testRunId).toBe(testConfig.testRunId);

      // Verify nested structures
      expect(retrievedSession.ivs).toBeDefined();
      expect(retrievedSession.participants).toBeDefined();
      expect(retrievedSession.programState).toBeDefined();
      expect(retrievedSession.streaming).toBeDefined();
      expect(retrievedSession.recording).toBeDefined();

      // Verify programState
      expect(retrievedSession.programState.activeVideoSource).toBe('host');
      expect(retrievedSession.programState.audioLevels.host).toBe(1.0);
      expect(retrievedSession.programState.overlayImageS3Key).toBeNull();

      // Verify streaming state
      expect(retrievedSession.streaming.isLive).toBe(false);
      expect(retrievedSession.streaming.startedAt).toBeNull();

      // Verify recording state
      expect(retrievedSession.recording.isRecording).toBe(false);
      expect(retrievedSession.recording.s3Prefix).toBe(`users/${hostUserId}/recordings/${showId}/`);

      console.log('✓ All assertions passed');
      console.log('\n=== PASS ===');
      console.log('LiveSession successfully written to and read from DynamoDB');
      console.log(`Verification artifacts:`);
      console.log(`  - PK: ${testPK}`);
      console.log(`  - SK: ${testSK}`);
      console.log(`  - Session ID: ${testSessionId}`);
      console.log(`  - Table: ${testConfig.tableName}`);
      console.log(`  - Region: ${testConfig.awsRegion}`);
      console.log('============\n');
    }, 30000); // 30 second timeout for AWS operations

    it('should verify session status is ACTIVE', async () => {
      const getParams = {
        TableName: testConfig.tableName,
        Key: marshall({
          pk: testPK,
          sk: testSK
        })
      };

      const getResult = await dynamoDBClient.send(new GetItemCommand(getParams));
      const session = unmarshall(getResult.Item);

      console.log('\n=== Status Verification ===');
      console.log(`Session ID: ${session.sessionId}`);
      console.log(`Status: ${session.status}`);
      console.log('===========================\n');

      expect(session.status).toBe('ACTIVE');
      console.log('✓ Status verification passed');
    }, 30000);
  });

  describe('Data Integrity', () => {
    it('should maintain all required fields after round-trip', async () => {
      const getParams = {
        TableName: testConfig.tableName,
        Key: marshall({
          pk: testPK,
          sk: testSK
        })
      };

      const getResult = await dynamoDBClient.send(new GetItemCommand(getParams));
      const session = unmarshall(getResult.Item);

      // Required top-level fields
      const requiredFields = [
        'pk', 'sk', 'entityType', 'sessionId', 'hostUserId',
        'showId', 'episodeId', 'status', 'createdAt', 'updatedAt'
      ];

      console.log('\n=== Field Integrity Check ===');
      requiredFields.forEach(field => {
        expect(session[field]).toBeDefined();
        console.log(`✓ ${field}: ${session[field]}`);
      });

      // Required nested structures
      expect(session.ivs).toBeDefined();
      expect(session.participants).toBeDefined();
      expect(session.programState).toBeDefined();
      expect(session.tracklist).toBeDefined();
      expect(session.streaming).toBeDefined();
      expect(session.recording).toBeDefined();

      console.log('✓ All nested structures present');
      console.log('=============================\n');
    }, 30000);
  });
});

// Print warning if tests are skipped
if (process.env.RUN_INTEGRATION !== '1') {
  console.log('\n⚠️  Integration tests skipped');
  console.log('To run integration tests, set RUN_INTEGRATION=1');
  console.log('Example: RUN_INTEGRATION=1 npm run test:integration\n');
}

