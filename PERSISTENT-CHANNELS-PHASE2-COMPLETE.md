# Phase 2 Complete: Session Integration with Persistent Channels

## Overview

Phase 2 modifies the session creation and cleanup Lambda functions to integrate persistent channels into the broadcast workflow. Instead of creating temporary channels for each broadcast, the system now uses pre-assigned persistent channels with static playback URLs.

## What Changed

### Modified Lambda Functions

#### 1. shelcaster-create-session

**Before Phase 2**:
- Created a new temporary IVS channel for each broadcast session
- Generated a new playback URL for each session
- Deleted the channel when the session ended

**After Phase 2**:
- Looks up the host's assigned persistent channel from DynamoDB
- Validates the channel is available (state is IDLE, not LIVE or OFFLINE)
- Updates the channel state to LIVE when the session starts
- Creates a temporary relay channel for composition output
- Stores persistent channel info in the session record

**New Error Responses**:
- `403 Forbidden`: No channel assigned to host
- `409 Conflict`: Channel already in use (LIVE)
- `503 Service Unavailable`: Channel temporarily unavailable (OFFLINE)

**Key Changes**:
```javascript
// NEW: Look up host's persistent channel
const channelAssignment = await getChannelAssignment(hostUserId);
const persistentChannel = await getChannelInfo(channelAssignment.channelId);

// NEW: Validate channel availability
if (persistentChannel.state === 'LIVE') {
  return 409 Conflict;
}

// NEW: Update channel state to LIVE
await updateChannelState(channelId, 'LIVE', sessionId);

// CHANGED: Create relay channel instead of program channel
const relayChannel = await createIVSChannel(`shelcaster-relay-${sessionId}`);

// NEW: Store persistent channel info in session
session.ivs.persistentChannelId = channelId;
session.ivs.persistentChannelArn = persistentChannel.channelArn;
session.ivs.persistentPlaybackUrl = persistentChannel.playbackUrl;
session.ivs.relayChannelArn = relayChannel.arn;
```

#### 2. shelcaster-end-session

**Before Phase 2**:
- Deleted the temporary program channel
- No channel state management

**After Phase 2**:
- Updates the persistent channel state to IDLE (does NOT delete)
- Deletes only the temporary relay channel
- Updates channel statistics (totalBroadcasts, totalStreamingMinutes, lastBroadcastAt)
- Clears currentSessionId from the channel record

**Key Changes**:
```javascript
// NEW: Update persistent channel to IDLE (preserve for reuse)
await updateChannelState(persistentChannelId, 'IDLE', null);

// NEW: Update channel statistics
await updateChannelStats(persistentChannelId, {
  totalBroadcasts: +1,
  totalStreamingMinutes: +streamingDuration,
  lastBroadcastAt: now
});

// CHANGED: Delete relay channel (not persistent channel)
await deleteIVSChannel(session.ivs.relayChannelArn);

// NEW: Add persistentChannel to cleanup results
cleanupResults.persistentChannel = {
  attempted: true,
  success: true,
  error: null
};
```

## Architecture Changes

### Before Phase 2
```
Host → Create Session → Create Temporary Channel → Broadcast → End Session → Delete Channel
                         (New playback URL each time)
```

### After Phase 2
```
Host → Create Session → Look Up Persistent Channel → Update State to LIVE → Broadcast
                         (Static playback URL)
                                ↓
                         End Session → Update State to IDLE → Preserve Channel
                         (Channel ready for next broadcast)
```

## Benefits

1. **Static Playback URLs**: Viewers can use the same URL for all broadcasts from a host
2. **No Channel Creation Delay**: Sessions start faster (no IVS channel creation)
3. **Cost Optimization**: Idle channels have no hourly charges
4. **Channel Reusability**: Same channel used across multiple broadcasts
5. **Better Resource Management**: Controlled number of channels per account

## Data Model Changes

### Session Record (DynamoDB)

**New Fields**:
```javascript
{
  ivs: {
    // NEW: Persistent channel info
    persistentChannelId: "uuid",
    persistentChannelArn: "arn:aws:ivs:...",
    persistentPlaybackUrl: "https://...",
    persistentIngestEndpoint: "rtmps://...",
    
    // CHANGED: Relay channel (was programChannel)
    relayChannelArn: "arn:aws:ivs:...",
    relayPlaybackUrl: "https://...",
    relayIngestEndpoint: "rtmps://...",
    
    // Existing fields unchanged
    rawStageArn: "...",
    programStageArn: "...",
    compositionArn: "...",
  }
}
```

### Channel Record (DynamoDB)

**Updated Fields**:
```javascript
{
  state: "IDLE" | "LIVE" | "OFFLINE",
  currentSessionId: "uuid" | null,
  totalBroadcasts: 0,
  totalStreamingMinutes: 0,
  lastBroadcastAt: "2026-02-19T...",
  updatedAt: "2026-02-19T..."
}
```

## Deployment

### Prerequisites
- Phase 1 complete (channel management functions deployed)
- At least one test channel created and assigned to a host

### Deploy Commands

```powershell
# Deploy create-session Lambda
.\deploy-create-session-phase2.ps1

# Deploy end-session Lambda
.\deploy-end-session-phase2.ps1
```

### Verification

```powershell
# Check function versions
aws lambda get-function --function-name shelcaster-create-session --region us-east-1
aws lambda get-function --function-name shelcaster-end-session --region us-east-1

# Test with assigned host
# See PHASE2-TESTING-GUIDE.md for detailed test procedures
```

## Testing

See [PHASE2-TESTING-GUIDE.md](./PHASE2-TESTING-GUIDE.md) for comprehensive testing procedures.

### Quick Test

```powershell
# 1. Create session (should use persistent channel)
POST /sessions
{
  "showId": "test-show-123",
  "episodeId": "test-episode-1"
}

# Expected: 201 Created with persistentChannel info

# 2. End session (should preserve channel)
DELETE /sessions/{sessionId}

# Expected: 200 OK with persistentChannel.success: true

# 3. Verify channel still exists and is IDLE
GET /hosts/{hostUserId}/channel

# Expected: state: "IDLE", channel still exists
```

## Backward Compatibility

Phase 2 maintains backward compatibility:

- **Legacy sessions** (without persistent channels) continue to work
- **Shared channel fallback** can be enabled during migration
- **Existing session cleanup** still works for old sessions

## Error Handling

### New Error Scenarios

| Error | Status | Message | Resolution |
|-------|--------|---------|------------|
| No channel assigned | 403 | "No channel assigned to your account. Please contact support." | Admin must assign a channel |
| Channel in use | 409 | "Channel is currently in use. Please try again later." | Wait for current broadcast to end |
| Channel offline | 503 | "Channel is temporarily unavailable. Please contact support." | Admin must investigate and restore |
| Channel not found | 500 | "Channel configuration error. Please contact support." | Check DynamoDB for channel record |

### Recovery Procedures

**Channel stuck in LIVE state**:
```powershell
# Manually reset channel state
PUT /admin/channels/{channelId}/state
{
  "newState": "IDLE",
  "sessionId": null
}
```

**Orphaned relay channels**:
```powershell
# List all IVS channels
aws ivs list-channels --region us-east-1

# Manually delete relay channels
aws ivs delete-channel --arn {relayChannelArn} --region us-east-1
```

## Monitoring

### CloudWatch Logs

**create-session logs**:
- "Looking up persistent channel for host: {hostUserId}"
- "Found persistent channel: {channelId}"
- "Persistent channel state: IDLE"
- "Updating channel state to LIVE"
- "Creating RELAY channel for composition..."

**end-session logs**:
- "[END SESSION] Updating persistent channel {channelId} state to IDLE"
- "[END SESSION] ✓ Persistent channel {channelId} updated to IDLE (preserved for reuse)"
- "[END SESSION] ✓ Channel stats updated: +1 broadcast, +X minutes"
- "[END SESSION] Deleting relay IVS channel: {relayChannelArn}"

### Metrics to Monitor

- Session creation success rate
- Channel state transition errors
- Relay channel deletion failures
- Average session creation time (should be faster)
- Channel utilization (broadcasts per channel)

## Known Limitations

1. **No automatic channel assignment**: Hosts must be manually assigned channels (Phase 3 will add UI)
2. **No channel pooling**: Channels are created one at a time (future enhancement)
3. **No scheduled broadcasting**: Multiple hosts can't share a channel with scheduling (future enhancement)
4. **Manual state recovery**: Stuck channels require manual intervention (future: auto-recovery)

## Next Steps

### Phase 3: Program Manager Group Editor
- Build UI for content owners to create groups
- Implement group-to-channel request workflow
- Add image upload for channel images
- Create playlist from group programs

### Phase 4: Vista Stream Channel Approval
- Build UI for network admins to review channel requests
- Implement approve/reject workflow
- Display active channels with state indicators
- Add playback URL copy functionality

### Phase 5: End-to-End Testing
- Test complete workflow from group creation to broadcast
- Validate static playback URLs work in Vista Stream player
- Performance testing with multiple concurrent broadcasts
- Load testing with channel limits

## Files Modified

- `shelcaster-functions/shelcaster-create-session/index.mjs`
- `shelcaster-functions/shelcaster-end-session/index.mjs`

## Files Created

- `shelcaster-functions/deploy-create-session-phase2.ps1`
- `shelcaster-functions/deploy-end-session-phase2.ps1`
- `shelcaster-functions/PHASE2-TESTING-GUIDE.md`
- `shelcaster-functions/PERSISTENT-CHANNELS-PHASE2-COMPLETE.md`

## Success Criteria

Phase 2 is complete when:

- [x] create-session Lambda looks up persistent channels
- [x] create-session Lambda validates channel availability
- [x] create-session Lambda updates channel state to LIVE
- [x] create-session Lambda creates relay channel (not program channel)
- [x] end-session Lambda updates channel state to IDLE
- [x] end-session Lambda preserves persistent channel
- [x] end-session Lambda deletes relay channel
- [x] end-session Lambda updates channel statistics
- [ ] All tests in PHASE2-TESTING-GUIDE.md pass
- [ ] CloudWatch logs show correct flow
- [ ] No orphaned relay channels remain
- [ ] Static playback URLs work across multiple broadcasts

## Deployment Status

- [ ] create-session Lambda deployed
- [ ] end-session Lambda deployed
- [ ] Tested with assigned host
- [ ] Tested channel reuse
- [ ] Tested error scenarios
- [ ] Verified channel preservation
- [ ] Verified relay channel deletion
- [ ] Verified statistics updates

---

**Phase 2 Status**: Code Complete, Ready for Deployment and Testing

**Next Action**: Deploy Lambda functions and run tests from PHASE2-TESTING-GUIDE.md
