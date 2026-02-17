# Recording Fix Summary

## Problem

When starting a broadcast in shelcaster-studio-2026, recordings were:
1. **Not capturing the full broadcast** - Recording stopped early or was incomplete
2. **Only showing host view** - Recording showed a grid of all participants instead of the mixed/composed program output

## Root Cause

The system was using **IVS Real-Time Composition S3 recording** which:
- Records directly from the RAW stage (where host + callers publish)
- Uses a grid layout showing all participants equally
- Creates a separate recording stream from the live broadcast
- Does NOT capture the composed program output that viewers see

## Solution

Switch to **IVS Channel auto-recording** which:
- Records the PROGRAM channel output (what viewers actually see)
- Captures the full composed broadcast with proper source switching
- Records the entire broadcast from start to finish
- Saves to S3 automatically when the channel stops streaming

## Changes Made

### 1. shelcaster-start-composition (Lambda)
**File:** `shelcaster-functions/shelcaster-start-composition/index.mjs`

**Before:**
```javascript
const composition = await ivsClient.send(new StartCompositionCommand({
  stageArn: session.ivs.rawStageArn,
  destinations: [
    {
      channel: {
        channelArn: session.ivs.programChannelArn,
        encoderConfigurationArn: ENCODER_CONFIG_ARN
      }
    },
    {
      s3: {  // ❌ This was recording the RAW stage grid view
        storageConfigurationArn: '...',
        encoderConfigurationArns: [ENCODER_CONFIG_ARN]
      }
    }
  ],
  layout: {
    grid: { gridGap: 2 }
  }
}));
```

**After:**
```javascript
const composition = await ivsClient.send(new StartCompositionCommand({
  stageArn: session.ivs.rawStageArn,
  destinations: [
    {
      channel: {  // ✅ Only send to channel, let channel auto-record
        channelArn: session.ivs.programChannelArn,
        encoderConfigurationArn: ENCODER_CONFIG_ARN
      }
    }
    // ✅ Removed S3 destination - channel will auto-record instead
  ],
  layout: {
    grid: { gridGap: 2 }
  }
}));
```

### 2. shelcaster-create-session (Lambda)
**File:** `shelcaster-functions/shelcaster-create-session/index.mjs`

**Added recording configuration to channel creation:**
```javascript
const channelResponse = await ivsChannelClient.send(new CreateChannelCmd({
  name: `shelcaster-program-${sessionId}`,
  type: 'STANDARD',
  latencyMode: 'LOW',
  recordingConfigurationArn: process.env.RECORDING_CONFIGURATION_ARN  // ✅ Enable auto-recording
}));
```

### 3. shelcaster-ivs-recording-processor (Lambda)
**File:** `shelcaster-functions/shelcaster-ivs-recording-processor/index.mjs`

**Updated to handle IVS Channel recordings:**
- Added support for `events.json` files (IVS Channel recording indicator)
- Improved channel ARN matching logic
- Finds correct `master.m3u8` file for channel recordings

### 4. New Setup Script
**File:** `shelcaster-functions/setup-ivs-channel-recording.ps1`

Creates IVS Recording Configuration for channel auto-recording:
```powershell
aws ivs create-recording-configuration \
  --name shelcaster-channel-recording \
  --destination-configuration "s3={bucketName=shelcaster-media-bucket}" \
  --recording-reconnect-window-seconds 60 \
  --thumbnail-configuration "recordingMode=INTERVAL,targetIntervalSeconds=60"
```

## Architecture Comparison

### Before (Broken)
```
RAW Stage (Host + Callers)
    ↓
Composition (Grid Layout)
    ├─→ PROGRAM Channel (viewers see this) ✓
    └─→ S3 Recording (grid view) ✗ WRONG
```

### After (Fixed)
```
RAW Stage (Host + Callers)
    ↓
Composition (Grid Layout)
    ↓
PROGRAM Channel (viewers see this)
    ↓
Auto-Recording → S3 (same as viewers see) ✓ CORRECT
```

## Deployment Steps

1. **Run setup script to create recording configuration:**
   ```powershell
   cd e:\projects\shelcaster-functions
   .\setup-ivs-channel-recording.ps1
   ```

2. **Update Lambda environment variable:**
   ```powershell
   aws lambda update-function-configuration \
     --function-name shelcaster-create-session \
     --environment Variables={RECORDING_CONFIGURATION_ARN=<arn-from-step-1>}
   ```

3. **Deploy updated Lambda functions:**
   ```powershell
   .\deploy-recording-fix.ps1
   ```

4. **Test with a new broadcast:**
   - Start a broadcast in shelcaster-studio-2026
   - Let it run for a few minutes
   - End the broadcast
   - Check Media Manager for the recording
   - Verify it shows the full broadcast with composed output

## Benefits

✅ **Full broadcast captured** - Recording runs for entire broadcast duration
✅ **Correct view recorded** - Captures what viewers see (composed output)
✅ **Automatic processing** - IVS handles recording lifecycle
✅ **Reliable** - No manual start/stop recording needed
✅ **Consistent** - Recording always matches live stream

## Technical Details

### IVS Channel Auto-Recording
- Automatically starts when channel receives stream
- Automatically stops when stream ends
- Saves to S3 with predictable path structure
- Generates HLS manifest (master.m3u8) for playback
- Creates thumbnails at specified intervals

### S3 Path Structure
**IVS Channel recordings:**
```
s3://shelcaster-media-bucket/ivs/{channel-id}/{recording-id}/
  ├── master.m3u8
  ├── media/
  │   ├── hls_0.ts
  │   ├── hls_1.ts
  │   └── ...
  ├── thumbnails/
  │   ├── thumb0.jpg
  │   ├── thumb1.jpg
  │   └── ...
  └── events.json
```

### Recording Processor Trigger
- S3 event notification triggers Lambda when `events.json` is created
- Lambda finds the session by matching channel ARN
- Creates program entry in Media Manager
- Syncs to Algolia for search

## Rollback Plan

If issues occur, revert by:

1. **Restore previous Lambda code:**
   ```powershell
   aws lambda update-function-code \
     --function-name shelcaster-start-composition \
     --s3-bucket shelcaster-lambda-deployments \
     --s3-key backups/shelcaster-start-composition-backup.zip
   ```

2. **Remove recording configuration from channel creation:**
   - Edit `shelcaster-create-session/index.mjs`
   - Remove `recordingConfigurationArn` parameter

3. **Redeploy:**
   ```powershell
   .\deploy-recording-fix.ps1
   ```

## Testing Checklist

- [ ] Recording configuration created successfully
- [ ] Lambda environment variable updated
- [ ] All Lambda functions deployed
- [ ] Start a test broadcast
- [ ] Verify live stream works
- [ ] End broadcast
- [ ] Check S3 for recording files
- [ ] Verify recording appears in Media Manager
- [ ] Play recording and verify it shows composed output
- [ ] Verify recording duration matches broadcast duration

## Notes

- Old recordings (with grid view) will remain in Media Manager
- New recordings will show the composed program output
- Recording starts automatically when composition begins
- Recording stops automatically when broadcast ends
- No manual recording start/stop needed in UI

## Support

If issues persist:
1. Check CloudWatch logs for Lambda errors
2. Verify S3 bucket permissions
3. Check IVS Channel recording status in AWS Console
4. Verify recording configuration ARN is correct
5. Test with a minimal broadcast (host only, 1 minute)
