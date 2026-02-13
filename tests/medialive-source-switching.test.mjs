/**
 * MediaLive Source Switching Tests — MVP (IVS Composition + MediaLive URL_PULL)
 *
 * Tests the logic for:
 *   1. parseSourceId — validates sourceId format ("participants" | "track:{trackId}")
 *   2. mapSourceToInputAttachment — maps sourceId to MediaLive InputAttachmentName
 *   3. switchMediaLiveInput — builds correct BatchUpdateSchedule params
 *   4. end-session input cleanup — iterates over inputIds object
 *   5. start-streaming — creates both participants + tracklist URL_PULL inputs
 *
 * Run:  node --test tests/medialive-source-switching.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Extracted logic from shelcaster-session-command/index.mjs ───────────────

function parseSourceId(sourceId) {
  if (sourceId === "participants") {
    return { type: 'participants' };
  }
  if (sourceId.startsWith("track:")) {
    const id = sourceId.substring(6);
    if (!id) {
      throw new Error("Invalid track sourceId: missing trackId");
    }
    return { type: 'track', id };
  }
  throw new Error(`Unknown sourceId format: ${sourceId}`);
}

function mapSourceToInputAttachment(sourceId) {
  if (sourceId === 'participants') {
    return 'participants';
  }
  if (sourceId.startsWith('track:')) {
    return 'tracklist';
  }
  throw new Error(`Cannot map sourceId to input attachment: ${sourceId}`);
}

function buildScheduleAction(channelId, sourceId) {
  const inputAttachmentName = mapSourceToInputAttachment(sourceId);
  return {
    ChannelId: channelId,
    Creates: {
      ScheduleActions: [{
        ActionName: `switch-${inputAttachmentName}-${Date.now()}`,
        ScheduleActionSettings: {
          InputSwitchSettings: {
            InputAttachmentNameReference: inputAttachmentName
          }
        },
        ScheduleActionStartSettings: {
          ImmediateModeScheduleActionStartSettings: {}
        }
      }]
    }
  };
}

// ─── Part 1: parseSourceId ──────────────────────────────────────────────────

describe('Part 1: parseSourceId — format validation', () => {
  it('should parse "participants" correctly', () => {
    const result = parseSourceId('participants');
    assert.deepEqual(result, { type: 'participants' });
  });

  it('should parse "track:{id}" correctly', () => {
    const result = parseSourceId('track:song-456');
    assert.deepEqual(result, { type: 'track', id: 'song-456' });
  });

  it('should throw on empty track id', () => {
    assert.throws(() => parseSourceId('track:'), /missing trackId/);
  });

  it('should throw on unknown format', () => {
    assert.throws(() => parseSourceId('unknown:xyz'), /Unknown sourceId format/);
  });

  it('should throw on empty string', () => {
    assert.throws(() => parseSourceId(''), /Unknown sourceId format/);
  });

  it('should throw on legacy "host" format', () => {
    assert.throws(() => parseSourceId('host'), /Unknown sourceId format/);
  });

  it('should throw on legacy "caller:" format', () => {
    assert.throws(() => parseSourceId('caller:abc'), /Unknown sourceId format/);
  });
});

// ─── Part 2: mapSourceToInputAttachment ─────────────────────────────────────

describe('Part 2: mapSourceToInputAttachment — sourceId to MediaLive mapping', () => {
  it('should map "participants" to "participants" attachment', () => {
    assert.equal(mapSourceToInputAttachment('participants'), 'participants');
  });

  it('should map "track:any-id" to "tracklist" attachment', () => {
    assert.equal(mapSourceToInputAttachment('track:song-1'), 'tracklist');
    assert.equal(mapSourceToInputAttachment('track:abc'), 'tracklist');
  });

  it('should throw for unknown source format', () => {
    assert.throws(
      () => mapSourceToInputAttachment('garbage'),
      /Cannot map sourceId to input attachment/
    );
  });

  it('should throw for legacy "host" source', () => {
    assert.throws(
      () => mapSourceToInputAttachment('host'),
      /Cannot map sourceId to input attachment/
    );
  });
});

// ─── Part 3: BatchUpdateSchedule params ─────────────────────────────────────

describe('Part 3: BatchUpdateSchedule — schedule action construction', () => {
  it('should set ChannelId from argument', () => {
    const params = buildScheduleAction('ch-999', 'participants');
    assert.equal(params.ChannelId, 'ch-999');
  });

  it('should create exactly one schedule action', () => {
    const params = buildScheduleAction('ch-1', 'participants');
    assert.equal(params.Creates.ScheduleActions.length, 1);
  });

  it('should set InputAttachmentNameReference to "participants" for participants source', () => {
    const params = buildScheduleAction('ch-1', 'participants');
    const action = params.Creates.ScheduleActions[0];
    assert.equal(
      action.ScheduleActionSettings.InputSwitchSettings.InputAttachmentNameReference,
      'participants'
    );
  });

  it('should set InputAttachmentNameReference to "tracklist" for track source', () => {
    const params = buildScheduleAction('ch-1', 'track:song-42');
    const action = params.Creates.ScheduleActions[0];
    assert.equal(
      action.ScheduleActionSettings.InputSwitchSettings.InputAttachmentNameReference,
      'tracklist'
    );
  });

  it('should use ImmediateModeScheduleActionStartSettings', () => {
    const params = buildScheduleAction('ch-1', 'participants');
    const action = params.Creates.ScheduleActions[0];
    assert.ok(
      action.ScheduleActionStartSettings.ImmediateModeScheduleActionStartSettings,
      'Should use immediate mode for instant switching'
    );
  });

  it('should include input attachment name in ActionName', () => {
    const params = buildScheduleAction('ch-1', 'participants');
    const actionName = params.Creates.ScheduleActions[0].ActionName;
    assert.ok(actionName.startsWith('switch-participants-'), `ActionName should start with switch-participants- but got: ${actionName}`);
  });
});

// ─── Part 4: End-session input cleanup ──────────────────────────────────────

describe('Part 4: End-session — input cleanup iteration', () => {
  function collectInputsToDelete(session) {
    const toDelete = [];
    if (session.mediaLive?.inputIds && typeof session.mediaLive.inputIds === 'object') {
      for (const [sourceName, inputId] of Object.entries(session.mediaLive.inputIds)) {
        toDelete.push({ sourceName, inputId });
      }
    }
    return toDelete;
  }

  it('should delete both participants and tracklist inputs', () => {
    const session = {
      mediaLive: {
        channelId: 'ch-1',
        inputIds: { participants: 'input-part-1', tracklist: 'input-track-1' }
      }
    };
    const toDelete = collectInputsToDelete(session);
    assert.equal(toDelete.length, 2);
    assert.ok(toDelete.some(d => d.sourceName === 'participants' && d.inputId === 'input-part-1'));
    assert.ok(toDelete.some(d => d.sourceName === 'tracklist' && d.inputId === 'input-track-1'));
  });

  it('should handle session with no mediaLive object', () => {
    const session = {};
    const toDelete = collectInputsToDelete(session);
    assert.equal(toDelete.length, 0);
  });

  it('should handle session with no inputIds', () => {
    const session = { mediaLive: { channelId: 'ch-1' } };
    const toDelete = collectInputsToDelete(session);
    assert.equal(toDelete.length, 0);
  });

  it('should handle single input', () => {
    const session = {
      mediaLive: {
        channelId: 'ch-1',
        inputIds: { participants: 'input-part-1' }
      }
    };
    const toDelete = collectInputsToDelete(session);
    assert.equal(toDelete.length, 1);
    assert.equal(toDelete[0].sourceName, 'participants');
  });
});

// ─── Part 5: Start-streaming — InputAttachments structure ───────────────────

describe('Part 5: Start-streaming — InputAttachments structure (both URL_PULL)', () => {
  function buildInputAttachments(participantsInputId, tracklistInputId) {
    return [
      { InputAttachmentName: 'participants', InputId: participantsInputId },
      {
        InputAttachmentName: 'tracklist',
        InputId: tracklistInputId,
        InputSettings: {
          AudioSelectors: [{
            Name: 'tracklist-audio',
            SelectorSettings: {
              AudioHlsRenditionSelection: { Name: 'default' }
            }
          }]
        }
      }
    ];
  }

  it('should create two input attachments', () => {
    const attachments = buildInputAttachments('part-1', 'track-1');
    assert.equal(attachments.length, 2);
  });

  it('should name first attachment "participants"', () => {
    const attachments = buildInputAttachments('part-1', 'track-1');
    assert.equal(attachments[0].InputAttachmentName, 'participants');
    assert.equal(attachments[0].InputId, 'part-1');
  });

  it('should name second attachment "tracklist"', () => {
    const attachments = buildInputAttachments('part-1', 'track-1');
    assert.equal(attachments[1].InputAttachmentName, 'tracklist');
    assert.equal(attachments[1].InputId, 'track-1');
  });

  it('tracklist attachment should have audio selector', () => {
    const attachments = buildInputAttachments('part-1', 'track-1');
    const tracklist = attachments[1];
    assert.ok(tracklist.InputSettings?.AudioSelectors, 'Tracklist should have AudioSelectors');
    assert.equal(tracklist.InputSettings.AudioSelectors[0].Name, 'tracklist-audio');
  });

  it('attachment names should match mapSourceToInputAttachment outputs', () => {
    const participantsAttachmentName = mapSourceToInputAttachment('participants');
    const trackAttachmentName = mapSourceToInputAttachment('track:any');
    const attachments = buildInputAttachments('p', 't');
    assert.equal(attachments[0].InputAttachmentName, participantsAttachmentName);
    assert.equal(attachments[1].InputAttachmentName, trackAttachmentName);
  });
});

// ─── Part 6: DynamoDB inputIds structure ────────────────────────────────────

describe('Part 6: DynamoDB inputIds — stored structure (no RTMP endpoints)', () => {
  function buildMediaLiveRecord(participantsInputId, tracklistInputId) {
    return {
      channelId: 'ch-1',
      channelArn: 'arn:aws:medialive:us-east-1:123:channel/ch-1',
      inputIds: {
        participants: participantsInputId,
        tracklist: tracklistInputId
      }
    };
  }

  it('should store both participants and tracklist input IDs', () => {
    const record = buildMediaLiveRecord('input-p', 'input-t');
    assert.equal(Object.keys(record.inputIds).length, 2);
    assert.equal(record.inputIds.participants, 'input-p');
    assert.equal(record.inputIds.tracklist, 'input-t');
  });

  it('should not have rtmpEndpoints (both inputs are URL_PULL)', () => {
    const record = buildMediaLiveRecord('p', 't');
    assert.equal(record.rtmpEndpoints, undefined, 'Should have no RTMP endpoints');
  });
});
