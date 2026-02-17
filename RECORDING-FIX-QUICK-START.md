# Quick Start: Fix Recording Issue

## Problem
- Recordings not saving full broadcast
- Recordings only showing host view (grid layout) instead of mixed program output

## Solution
Switch from composition S3 recording to IVS Channel auto-recording.

## Deploy Fix (3 steps)

### Step 1: Create Recording Configuration
```powershell
cd e:\projects\shelcaster-functions
.\setup-ivs-channel-recording.ps1
```

This will output an ARN like:
```
arn:aws:ivs:us-east-1:124355640062:recording-configuration/AbCdEfGh
```

### Step 2: Update Lambda Environment
```powershell
aws lambda update-function-configuration `
  --function-name shelcaster-create-session `
  --environment "Variables={RECORDING_CONFIGURATION_ARN=arn:aws:ivs:us-east-1:124355640062:recording-configuration/AbCdEfGh}"
```

Replace `AbCdEfGh` with your actual ARN from Step 1.

### Step 3: Deploy Updated Functions
```powershell
.\deploy-recording-fix.ps1
```

## Test

1. Start a broadcast in shelcaster-studio-2026
2. Let it run for 2-3 minutes
3. End the broadcast
4. Wait 2-5 minutes for processing
5. Check Media Manager - recording should appear with full broadcast

## What Changed

**Before:**
- Composition recorded RAW stage (grid of all participants)
- Recording was separate from live stream
- Only captured host view

**After:**
- PROGRAM channel auto-records (what viewers see)
- Recording matches live stream exactly
- Captures full composed output

## Files Modified

1. `shelcaster-start-composition/index.mjs` - Removed S3 destination
2. `shelcaster-create-session/index.mjs` - Added recording config to channel
3. `shelcaster-ivs-recording-processor/index.mjs` - Handle channel recordings

## Rollback

If needed, restore from git:
```powershell
git checkout HEAD -- shelcaster-start-composition/index.mjs
git checkout HEAD -- shelcaster-create-session/index.mjs
git checkout HEAD -- shelcaster-ivs-recording-processor/index.mjs
.\deploy-recording-fix.ps1
```

## Support

See `RECORDING-FIX-COMPLETE.md` for full technical details.
