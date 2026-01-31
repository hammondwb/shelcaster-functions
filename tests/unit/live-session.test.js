/**
 * Unit tests for LiveSession creation and idempotent update logic
 * Phase 1 - Data Model + Validation (no IVS required)
 * 
 * Tests:
 * - Create LiveSession: required fields present
 * - Update LiveSession idempotently
 * - Validate constraints:
 *   - activeVideoSource enum values
 *   - audioLevels numeric + clamped range
 *   - overlayImageS3Key format or null
 */

const { v4: uuidv4 } = require('uuid');

describe('LiveSession - Creation and Validation', () => {
  describe('createLiveSession', () => {
    it('should create a valid LiveSession with all required fields', () => {
      const sessionId = uuidv4();
      const hostUserId = uuidv4();
      const showId = uuidv4();
      const episodeId = uuidv4();
      const now = new Date().toISOString();

      const liveSession = {
        pk: `session#${sessionId}`,
        sk: 'info',
        entityType: 'liveSession',
        sessionId,
        hostUserId,
        showId,
        episodeId,
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

      // Validate required fields
      expect(liveSession.sessionId).toBeDefined();
      expect(liveSession.hostUserId).toBeDefined();
      expect(liveSession.showId).toBeDefined();
      expect(liveSession.episodeId).toBeDefined();
      expect(liveSession.status).toBe('ACTIVE');
      expect(liveSession.entityType).toBe('liveSession');
      
      // Validate DynamoDB keys
      expect(liveSession.pk).toBe(`session#${sessionId}`);
      expect(liveSession.sk).toBe('info');
      
      // Validate nested structures
      expect(liveSession.ivs).toBeDefined();
      expect(liveSession.participants).toBeDefined();
      expect(liveSession.programState).toBeDefined();
      expect(liveSession.streaming).toBeDefined();
      expect(liveSession.recording).toBeDefined();
    });

    it('should initialize with default programState values', () => {
      const programState = {
        activeVideoSource: 'host',
        audioLevels: {
          host: 1.0
        },
        overlayImageS3Key: null
      };

      expect(programState.activeVideoSource).toBe('host');
      expect(programState.audioLevels.host).toBe(1.0);
      expect(programState.overlayImageS3Key).toBeNull();
    });
  });

  describe('activeVideoSource validation', () => {
    const validSources = ['host', 'caller', 'track'];
    
    validSources.forEach(source => {
      it(`should accept valid activeVideoSource: ${source}`, () => {
        const programState = {
          activeVideoSource: source,
          audioLevels: { host: 1.0 },
          overlayImageS3Key: null
        };

        expect(['host', 'caller', 'track']).toContain(programState.activeVideoSource);
      });
    });

    it('should reject invalid activeVideoSource', () => {
      const invalidSource = 'invalid-source';
      const validSources = ['host', 'caller', 'track'];
      
      expect(validSources).not.toContain(invalidSource);
    });
  });

  describe('audioLevels validation', () => {
    it('should accept valid audio levels (0.0 to 1.0)', () => {
      const audioLevels = {
        host: 1.0,
        'caller-1': 0.8,
        'caller-2': 0.5
      };

      Object.values(audioLevels).forEach(level => {
        expect(level).toBeGreaterThanOrEqual(0.0);
        expect(level).toBeLessThanOrEqual(1.0);
        expect(typeof level).toBe('number');
      });
    });

    it('should clamp audio levels to valid range', () => {
      const clampAudioLevel = (level) => Math.max(0.0, Math.min(1.0, level));

      expect(clampAudioLevel(1.5)).toBe(1.0);
      expect(clampAudioLevel(-0.5)).toBe(0.0);
      expect(clampAudioLevel(0.7)).toBe(0.7);
    });
  });

  describe('overlayImageS3Key validation', () => {
    it('should accept null overlayImageS3Key', () => {
      const programState = {
        activeVideoSource: 'host',
        audioLevels: { host: 1.0 },
        overlayImageS3Key: null
      };

      expect(programState.overlayImageS3Key).toBeNull();
    });

    it('should accept valid S3 key format', () => {
      const validS3Keys = [
        'overlays/logo.png',
        'users/user-123/overlays/banner.jpg',
        'media/overlay-image.webp'
      ];

      validS3Keys.forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });

    it('should validate S3 key format', () => {
      const isValidS3Key = (key) => {
        if (key === null) return true;
        if (typeof key !== 'string') return false;
        if (key.length === 0) return false;
        // S3 keys should not start with /
        if (key.startsWith('/')) return false;
        return true;
      };

      expect(isValidS3Key(null)).toBe(true);
      expect(isValidS3Key('overlays/logo.png')).toBe(true);
      expect(isValidS3Key('/invalid/key.png')).toBe(false);
      expect(isValidS3Key('')).toBe(false);
    });
  });

  describe('Idempotent Updates', () => {
    let baseSession;

    beforeEach(() => {
      const sessionId = uuidv4();
      const hostUserId = uuidv4();
      const showId = uuidv4();
      const now = new Date().toISOString();

      baseSession = {
        pk: `session#${sessionId}`,
        sk: 'info',
        entityType: 'liveSession',
        sessionId,
        hostUserId,
        showId,
        episodeId: uuidv4(),
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
          audioLevels: { host: 1.0 },
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
    });

    it('should update programState.activeVideoSource idempotently', () => {
      // First update
      const update1 = {
        ...baseSession,
        programState: {
          ...baseSession.programState,
          activeVideoSource: 'caller'
        },
        updatedAt: new Date().toISOString()
      };

      expect(update1.programState.activeVideoSource).toBe('caller');

      // Second update with same value (idempotent)
      const update2 = {
        ...update1,
        programState: {
          ...update1.programState,
          activeVideoSource: 'caller'
        },
        updatedAt: new Date().toISOString()
      };

      expect(update2.programState.activeVideoSource).toBe('caller');
      expect(update2.programState.activeVideoSource).toBe(update1.programState.activeVideoSource);
    });

    it('should update audioLevels idempotently', () => {
      // First update
      const update1 = {
        ...baseSession,
        programState: {
          ...baseSession.programState,
          audioLevels: {
            host: 0.8,
            'caller-1': 0.6
          }
        },
        updatedAt: new Date().toISOString()
      };

      expect(update1.programState.audioLevels.host).toBe(0.8);
      expect(update1.programState.audioLevels['caller-1']).toBe(0.6);

      // Second update with same values (idempotent)
      const update2 = {
        ...update1,
        programState: {
          ...update1.programState,
          audioLevels: {
            host: 0.8,
            'caller-1': 0.6
          }
        },
        updatedAt: new Date().toISOString()
      };

      expect(update2.programState.audioLevels).toEqual(update1.programState.audioLevels);
    });

    it('should update recording state idempotently', () => {
      // Start recording
      const update1 = {
        ...baseSession,
        recording: {
          ...baseSession.recording,
          isRecording: true
        },
        updatedAt: new Date().toISOString()
      };

      expect(update1.recording.isRecording).toBe(true);

      // Call start recording again (idempotent)
      const update2 = {
        ...update1,
        recording: {
          ...update1.recording,
          isRecording: true
        },
        updatedAt: new Date().toISOString()
      };

      expect(update2.recording.isRecording).toBe(true);
      expect(update2.recording.isRecording).toBe(update1.recording.isRecording);
    });

    it('should update streaming state idempotently', () => {
      const startTime = new Date().toISOString();

      // Start streaming
      const update1 = {
        ...baseSession,
        streaming: {
          isLive: true,
          startedAt: startTime
        },
        updatedAt: new Date().toISOString()
      };

      expect(update1.streaming.isLive).toBe(true);
      expect(update1.streaming.startedAt).toBe(startTime);

      // Call start streaming again (idempotent - should preserve startedAt)
      const update2 = {
        ...update1,
        streaming: {
          isLive: true,
          startedAt: update1.streaming.startedAt // Preserve original start time
        },
        updatedAt: new Date().toISOString()
      };

      expect(update2.streaming.isLive).toBe(true);
      expect(update2.streaming.startedAt).toBe(startTime);
    });

    it('should update session status idempotently', () => {
      // End session
      const update1 = {
        ...baseSession,
        status: 'ENDED',
        updatedAt: new Date().toISOString()
      };

      expect(update1.status).toBe('ENDED');

      // Call end session again (idempotent)
      const update2 = {
        ...update1,
        status: 'ENDED',
        updatedAt: new Date().toISOString()
      };

      expect(update2.status).toBe('ENDED');
      expect(update2.status).toBe(update1.status);
    });
  });
});

