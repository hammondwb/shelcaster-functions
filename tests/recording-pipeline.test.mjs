/**
 * Recording Pipeline Tests
 *
 * Tests each part of the IVS recording → Media Manager pipeline:
 *   Part 1: Start Composition — S3 destination configuration
 *   Part 2: Recording Processor — S3 event filtering, session matching, program creation
 *   Part 3: CloudFront Function — path routing for IVS recordings vs public content
 *   Part 4: Export Recording — program_url propagation and schema
 *
 * Run:  node --test tests/recording-pipeline.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build the composition params the same way shelcaster-start-program-composition does */
function buildCompositionParams(session, env) {
  return {
    stageArn: session.ivs.programStageArn,
    destinations: [
      {
        channel: {
          channelArn: session.ivs.programChannelArn,
          encoderConfigurationArn: env.ENCODER_CONFIGURATION_ARN,
        },
      },
      {
        s3: {
          storageConfigurationArn: env.STORAGE_CONFIGURATION_ARN,
          encoderConfigurationArn: env.ENCODER_CONFIGURATION_ARN,
        },
      },
    ],
    layout: {
      grid: {
        featuredParticipantAttribute: 'program',
        omitStoppedVideo: false,
        videoFillMode: 'COVER',
      },
    },
  };
}

/** Replicate the session-matching logic from shelcaster-ivs-recording-processor */
function matchSessionByPathSegments(sessions, pathSegments) {
  for (const session of sessions) {
    const ivs = session.ivs || {};
    if (ivs.compositionArn) {
      const compId = ivs.compositionArn.split('/').pop();
      if (compId && pathSegments.includes(compId)) {
        return { showId: session.showId, sessionId: session.sessionId };
      }
    }
    const channelArn = ivs.programChannelArn || ivs.channelArn;
    if (channelArn) {
      const channelId = channelArn.split('/').pop();
      if (channelId && pathSegments.includes(channelId)) {
        return { showId: session.showId, sessionId: session.sessionId };
      }
    }
  }
  return null;
}

/** Build a program item the same way shelcaster-ivs-recording-processor does */
function buildRecordingProcessorProgram({ producerId, groupId, showTitle, showId, playbackUrl, bucket, key, fileSize }) {
  const programId = 'test-program-id';
  const now = new Date().toISOString();
  return {
    pk: `u#${producerId}#programs`,
    sk: `p#${programId}`,
    entityType: 'program',
    GSI1PK: `u#${producerId}#g#${groupId}`,
    GSI1SK: `p#${programId}`,
    groupId,
    ownerId: producerId,
    programId,
    title: `${showTitle || 'Untitled Show'} - Recording`,
    description: `Recorded on ${new Date().toLocaleDateString()}`,
    broadcast_type: 'Video HLS',
    program_url: playbackUrl,
    program_image: null,
    premium: false,
    duration: 0,
    tags: ['recording', 'ivs'],
    created_date: now,
    createdAt: now,
    updatedAt: now,
    sourceType: 'ivs-recording',
    sourceShowId: showId,
    s3Bucket: bucket,
    s3Key: key,
    fileSize,
  };
}

/** Build a program item the same way shelcaster-export-recording does */
function buildExportProgram({ producerId, groupId, showTitle, showId, recording, recordingId }) {
  const programId = 'test-export-program-id';
  const now = new Date().toISOString();
  return {
    pk: `u#${producerId}#programs`,
    sk: `p#${programId}`,
    entityType: 'program',
    GSI1PK: `u#${producerId}#g#${groupId}`,
    GSI1SK: `p#${programId}`,
    groupId,
    ownerId: producerId,
    programId,
    title: `${showTitle || 'Untitled Show'} - Recording`,
    description: `Recorded on ${new Date(recording.startTime || recording.createdAt).toLocaleDateString()}`,
    broadcast_type: 'Video HLS',
    program_url: recording.playbackUrl || null,
    program_image: null,
    premium: false,
    duration: 0,
    tags: ['recording', 'studio-export'],
    created_date: now,
    createdAt: now,
    updatedAt: now,
    sourceType: 'recording-export',
    sourceShowId: showId,
    sourceRecordingId: recordingId,
  };
}

/** Inline CloudFront Function (from scripts/cf-function.js) */
function cfHandler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf('/composite/') !== -1 ||
      uri.indexOf('/AWSLogs/') === 0 ||
      uri.indexOf('/found-music/') === 0 ||
      uri.indexOf('/world-of-acappella/') === 0) {
    return request;
  }
  request.uri = '/public' + uri;
  return request;
}

/** S3 event key filter — replicates the safeguard logic in the recording processor */
function shouldProcessKey(key) {
  return key.endsWith('master.m3u8');
}

/** Build playback URL the same way the recording processor does */
function buildPlaybackUrl(cloudfrontDomain, key) {
  return `https://${cloudfrontDomain}/${key}`;
}

// Required fields every Media Manager program must have
const REQUIRED_PROGRAM_FIELDS = [
  'pk', 'sk', 'entityType', 'GSI1PK', 'GSI1SK',
  'groupId', 'ownerId', 'programId', 'title', 'description',
  'broadcast_type', 'program_url', 'program_image', 'premium',
  'duration', 'tags', 'created_date', 'createdAt', 'updatedAt',
];

// ─── Part 1: Start Composition — S3 Destination ────────────────────────────

describe('Part 1: Start Composition — S3 destination configuration', () => {
  const session = {
    ivs: {
      programStageArn: 'arn:aws:ivs:us-east-1:123456:stage/abc123',
      programChannelArn: 'arn:aws:ivs:us-east-1:123456:channel/ch789',
    },
  };
  const env = {
    STORAGE_CONFIGURATION_ARN: 'arn:aws:ivs:us-east-1:123456:storage-configuration/yxxsKmccqsDL',
    ENCODER_CONFIGURATION_ARN: 'arn:aws:ivs:us-east-1:123456:encoder-configuration/enc001',
  };

  it('should include both channel and S3 destinations', () => {
    const params = buildCompositionParams(session, env);
    assert.equal(params.destinations.length, 2);
    assert.ok(params.destinations[0].channel, 'First destination should be channel');
    assert.ok(params.destinations[1].s3, 'Second destination should be S3');
  });

  it('should use STORAGE_CONFIGURATION_ARN from env for S3 destination', () => {
    const params = buildCompositionParams(session, env);
    assert.equal(params.destinations[1].s3.storageConfigurationArn, env.STORAGE_CONFIGURATION_ARN);
  });

  it('should use programStageArn from session', () => {
    const params = buildCompositionParams(session, env);
    assert.equal(params.stageArn, session.ivs.programStageArn);
  });

  it('should use programChannelArn for channel destination', () => {
    const params = buildCompositionParams(session, env);
    assert.equal(params.destinations[0].channel.channelArn, session.ivs.programChannelArn);
  });

  it('should have undefined storageConfigurationArn when env var is missing', () => {
    const params = buildCompositionParams(session, { ENCODER_CONFIGURATION_ARN: 'enc' });
    assert.equal(params.destinations[1].s3.storageConfigurationArn, undefined,
      'Missing STORAGE_CONFIGURATION_ARN env var — S3 destination will fail at AWS API level');
  });

  it('should set SINGLE layout for PROGRAM composition', () => {
    const params = buildCompositionParams(session, env);
    assert.ok(params.layout.grid, 'Layout should use grid mode');
    assert.equal(params.layout.grid.featuredParticipantAttribute, 'program');
  });
});

// ─── Part 2: Recording Processor — Event Handling & Program Creation ───────

describe('Part 2: Recording Processor — S3 event filtering', () => {
  it('should process master.m3u8 files', () => {
    assert.ok(shouldProcessKey('8qtVoHXOE8kf/ywBfkICJ6Zii/BwxnNsp9Zsgy/composite/master.m3u8'));
  });

  it('should skip non-master files (media segments)', () => {
    assert.ok(!shouldProcessKey('8qtVoHXOE8kf/ywBfkICJ6Zii/BwxnNsp9Zsgy/composite/0.ts'));
    assert.ok(!shouldProcessKey('8qtVoHXOE8kf/ywBfkICJ6Zii/BwxnNsp9Zsgy/composite/media_12345.ts'));
  });

  it('should skip variant playlist files', () => {
    assert.ok(!shouldProcessKey('8qtVoHXOE8kf/ywBfkICJ6Zii/BwxnNsp9Zsgy/composite/variant.m3u8'));
  });

  it('should skip empty keys', () => {
    assert.ok(!shouldProcessKey(''));
  });

  it('should handle deeply nested master.m3u8 paths', () => {
    assert.ok(shouldProcessKey('a/b/c/d/e/composite/master.m3u8'));
  });
});

describe('Part 2: Recording Processor — session matching by composition ID', () => {
  const sessions = [
    {
      sessionId: 'session-1',
      showId: 'show-1',
      ivs: {
        compositionArn: 'arn:aws:ivs:us-east-1:123456:composition/ywBfkICJ6Zii',
        programChannelArn: 'arn:aws:ivs:us-east-1:123456:channel/chAAA',
      },
    },
    {
      sessionId: 'session-2',
      showId: 'show-2',
      ivs: {
        compositionArn: 'arn:aws:ivs:us-east-1:123456:composition/XXXXXXXXXXXXX',
        programChannelArn: 'arn:aws:ivs:us-east-1:123456:channel/chBBB',
      },
    },
  ];

  // IVS Real-Time S3 path: {randomPrefix}/{compositionId}/{destinationId}/composite/master.m3u8
  const ivsPath = '8qtVoHXOE8kf/ywBfkICJ6Zii/BwxnNsp9Zsgy/composite/master.m3u8';
  const pathSegments = ivsPath.split('/');

  it('should match session by composition ID in S3 path', () => {
    const match = matchSessionByPathSegments(sessions, pathSegments);
    assert.ok(match, 'Should find a matching session');
    assert.equal(match.sessionId, 'session-1');
    assert.equal(match.showId, 'show-1');
  });

  it('should return null when no session matches the path', () => {
    const unknownPath = 'abc/UNKNOWN_COMP_ID/def/composite/master.m3u8'.split('/');
    const match = matchSessionByPathSegments(sessions, unknownPath);
    assert.equal(match, null);
  });

  it('should match by channel ID as fallback', () => {
    const sessionNoComp = [{
      sessionId: 'session-3',
      showId: 'show-3',
      ivs: {
        compositionArn: null,
        programChannelArn: 'arn:aws:ivs:us-east-1:123456:channel/chAAA',
      },
    }];
    // Path contains channelId "chAAA" as a segment
    const channelPath = 'prefix/chAAA/dest/composite/master.m3u8'.split('/');
    const match = matchSessionByPathSegments(sessionNoComp, channelPath);
    assert.ok(match);
    assert.equal(match.sessionId, 'session-3');
  });

  it('should handle sessions with no ivs object', () => {
    const sessionsNoIvs = [{ sessionId: 's', showId: 'sh', ivs: undefined }];
    const match = matchSessionByPathSegments(sessionsNoIvs, pathSegments);
    assert.equal(match, null);
  });
});



describe('Part 2: Recording Processor — program item creation', () => {
  const input = {
    producerId: 'user-abc',
    groupId: 'group-xyz',
    showTitle: 'My Live Show',
    showId: 'show-111',
    playbackUrl: 'https://d2kyyx47f0bavc.cloudfront.net/8qtVo/ywBfk/Bwxn/composite/master.m3u8',
    bucket: 'shelcaster-v2',
    key: '8qtVo/ywBfk/Bwxn/composite/master.m3u8',
    fileSize: 12345,
  };

  it('should have all required Media Manager fields', () => {
    const program = buildRecordingProcessorProgram(input);
    for (const field of REQUIRED_PROGRAM_FIELDS) {
      assert.ok(field in program, `Missing required field: ${field}`);
    }
  });

  it('should set pk as u#{producerId}#programs', () => {
    const program = buildRecordingProcessorProgram(input);
    assert.equal(program.pk, 'u#user-abc#programs');
  });

  it('should set sk as p#{programId}', () => {
    const program = buildRecordingProcessorProgram(input);
    assert.ok(program.sk.startsWith('p#'), `sk should start with p# but got: ${program.sk}`);
  });

  it('should set entityType to program', () => {
    const program = buildRecordingProcessorProgram(input);
    assert.equal(program.entityType, 'program');
  });

  it('should set GSI1PK with producerId and groupId', () => {
    const program = buildRecordingProcessorProgram(input);
    assert.equal(program.GSI1PK, 'u#user-abc#g#group-xyz');
  });

  it('should set program_url to CloudFront URL', () => {
    const program = buildRecordingProcessorProgram(input);
    assert.equal(program.program_url, input.playbackUrl);
    assert.ok(program.program_url.startsWith('https://'), 'program_url should be HTTPS');
    assert.ok(program.program_url.endsWith('master.m3u8'), 'program_url should end with master.m3u8');
  });

  it('should set broadcast_type to Video HLS', () => {
    const program = buildRecordingProcessorProgram(input);
    assert.equal(program.broadcast_type, 'Video HLS');
  });

  it('should include s3Key and s3Bucket for traceability', () => {
    const program = buildRecordingProcessorProgram(input);
    assert.equal(program.s3Bucket, 'shelcaster-v2');
    assert.equal(program.s3Key, input.key);
  });

  it('should set sourceType to ivs-recording', () => {
    const program = buildRecordingProcessorProgram(input);
    assert.equal(program.sourceType, 'ivs-recording');
  });

  it('should use Untitled Show when showTitle is missing', () => {
    const program = buildRecordingProcessorProgram({ ...input, showTitle: null });
    assert.ok(program.title.startsWith('Untitled Show'));
  });
});

describe('Part 2: Recording Processor — playback URL construction', () => {
  const CF_DOMAIN = 'd2kyyx47f0bavc.cloudfront.net';

  it('should build correct CloudFront URL from S3 key', () => {
    const key = '8qtVoHXOE8kf/ywBfkICJ6Zii/BwxnNsp9Zsgy/composite/master.m3u8';
    const url = buildPlaybackUrl(CF_DOMAIN, key);
    assert.equal(url, `https://${CF_DOMAIN}/${key}`);
  });

  it('should produce an HTTPS URL', () => {
    const url = buildPlaybackUrl(CF_DOMAIN, 'any/path/master.m3u8');
    assert.ok(url.startsWith('https://'));
  });

  it('should not double-slash between domain and key', () => {
    const url = buildPlaybackUrl(CF_DOMAIN, 'path/master.m3u8');
    assert.ok(!url.includes('//path'), `URL has double slash: ${url}`);
  });
});

// ─── Part 3: CloudFront Function — Path Routing ────────────────────────────

describe('Part 3: CloudFront Function — IVS recording paths', () => {
  function makeEvent(uri) {
    return { request: { uri, headers: {} } };
  }

  it('should NOT prepend /public for paths containing /composite/', () => {
    const event = makeEvent('/ZmOo7eUJYbVR/2vnW9ixOFyAb/z7uWJLnM32at/composite/master.m3u8');
    const result = cfHandler(event);
    assert.equal(result.uri, '/ZmOo7eUJYbVR/2vnW9ixOFyAb/z7uWJLnM32at/composite/master.m3u8');
  });

  it('should NOT prepend /public for /composite/ media segments', () => {
    const event = makeEvent('/abc/def/ghi/composite/0.ts');
    const result = cfHandler(event);
    assert.equal(result.uri, '/abc/def/ghi/composite/0.ts');
  });

  it('should prepend /public for normal content paths', () => {
    const event = makeEvent('/users/profile.jpg');
    const result = cfHandler(event);
    assert.equal(result.uri, '/public/users/profile.jpg');
  });

  it('should prepend /public for root path', () => {
    const event = makeEvent('/index.html');
    const result = cfHandler(event);
    assert.equal(result.uri, '/public/index.html');
  });

  it('should NOT prepend /public for /AWSLogs/ path', () => {
    const event = makeEvent('/AWSLogs/123456/us-east-1/logfile.gz');
    const result = cfHandler(event);
    assert.equal(result.uri, '/AWSLogs/123456/us-east-1/logfile.gz');
  });

  it('should NOT prepend /public for /found-music/ path', () => {
    const event = makeEvent('/found-music/track.mp3');
    const result = cfHandler(event);
    assert.equal(result.uri, '/found-music/track.mp3');
  });

  it('should NOT prepend /public for /world-of-acappella/ path', () => {
    const event = makeEvent('/world-of-acappella/episode.mp4');
    const result = cfHandler(event);
    assert.equal(result.uri, '/world-of-acappella/episode.mp4');
  });

  it('should handle IVS recording path with random prefix', () => {
    // Real IVS path format: {randomPrefix}/{compositionId}/{destinationId}/composite/master.m3u8
    const event = makeEvent('/8qtVoHXOE8kf/ywBfkICJ6Zii/BwxnNsp9Zsgy/composite/master.m3u8');
    const result = cfHandler(event);
    assert.ok(!result.uri.startsWith('/public'), 'IVS recording path should NOT get /public prefix');
  });
});

// ─── Part 4: Export Recording — program_url Propagation ────────────────────

describe('Part 4: Export Recording — program item creation', () => {
  const baseInput = {
    producerId: 'user-abc',
    groupId: 'group-xyz',
    showTitle: 'My Live Show',
    showId: 'show-111',
    recordingId: 'rec-999',
    recording: {
      startTime: '2026-02-08T03:00:00.000Z',
      createdAt: '2026-02-08T03:00:00.000Z',
      playbackUrl: 'https://d2kyyx47f0bavc.cloudfront.net/8qtVo/comp/dest/composite/master.m3u8',
    },
  };

  it('should have all required Media Manager fields', () => {
    const program = buildExportProgram(baseInput);
    for (const field of REQUIRED_PROGRAM_FIELDS) {
      assert.ok(field in program, `Missing required field: ${field}`);
    }
  });

  it('should set program_url from recording.playbackUrl', () => {
    const program = buildExportProgram(baseInput);
    assert.equal(program.program_url, baseInput.recording.playbackUrl);
  });

  it('should set program_url to null when recording has no playbackUrl', () => {
    const input = {
      ...baseInput,
      recording: { ...baseInput.recording, playbackUrl: undefined },
    };
    const program = buildExportProgram(input);
    assert.equal(program.program_url, null, 'program_url should be null when recording has no playbackUrl');
  });

  it('should set sourceType to recording-export', () => {
    const program = buildExportProgram(baseInput);
    assert.equal(program.sourceType, 'recording-export');
  });

  it('should set sourceRecordingId', () => {
    const program = buildExportProgram(baseInput);
    assert.equal(program.sourceRecordingId, 'rec-999');
  });

  it('should set tags to recording, studio-export', () => {
    const program = buildExportProgram(baseInput);
    assert.deepEqual(program.tags, ['recording', 'studio-export']);
  });

  it('should set pk and GSI1PK matching recording processor format', () => {
    const program = buildExportProgram(baseInput);
    assert.equal(program.pk, 'u#user-abc#programs');
    assert.equal(program.GSI1PK, 'u#user-abc#g#group-xyz');
  });

  it('should set broadcast_type to Video HLS (matches recording processor)', () => {
    const program = buildExportProgram(baseInput);
    assert.equal(program.broadcast_type, 'Video HLS');
  });
});

// ─── Part 4b: Schema Compatibility — Both paths produce identical schemas ──

describe('Part 4b: Schema Compatibility — recording processor vs export', () => {
  it('should produce same pk/sk pattern from both paths', () => {
    const recProc = buildRecordingProcessorProgram({
      producerId: 'u1', groupId: 'g1', showTitle: 'T', showId: 's1',
      playbackUrl: 'https://cf/key', bucket: 'b', key: 'k', fileSize: 1,
    });
    const exp = buildExportProgram({
      producerId: 'u1', groupId: 'g1', showTitle: 'T', showId: 's1',
      recordingId: 'r1', recording: { playbackUrl: 'https://cf/key', startTime: new Date().toISOString() },
    });
    // pk format should match
    assert.equal(recProc.pk, exp.pk);
    // sk format should both start with p#
    assert.ok(recProc.sk.startsWith('p#'));
    assert.ok(exp.sk.startsWith('p#'));
    // GSI1PK format should match
    assert.equal(recProc.GSI1PK, exp.GSI1PK);
    // entityType should match
    assert.equal(recProc.entityType, exp.entityType);
    assert.equal(recProc.entityType, 'program');
  });

  it('both paths set broadcast_type to Video HLS', () => {
    const recProc = buildRecordingProcessorProgram({
      producerId: 'u', groupId: 'g', showTitle: 'T', showId: 's',
      playbackUrl: 'url', bucket: 'b', key: 'k', fileSize: 0,
    });
    const exp = buildExportProgram({
      producerId: 'u', groupId: 'g', showTitle: 'T', showId: 's',
      recordingId: 'r', recording: { playbackUrl: 'url', startTime: new Date().toISOString() },
    });
    assert.equal(recProc.broadcast_type, 'Video HLS');
    assert.equal(exp.broadcast_type, 'Video HLS');
  });
});