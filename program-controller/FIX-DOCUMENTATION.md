# Fix: Virtual Participant Not Joining IVS Stage

## Problem
The program-controller ECS task was failing to join the IVS stage. Logs showed:
- Task successfully initialized through Step 7 (creating participant token)
- Never reached Step 9 (joining IVS stage)
- `joinStage()` function in browser-client.html was failing silently
- No error messages or stack traces were being logged

## Root Cause
**Insufficient error handling and logging** in the browser-side IVS SDK integration:
1. The `joinStage()` function had minimal logging
2. Errors were caught but not fully logged (no stack traces)
3. No validation of token format before attempting to join
4. No event listeners for additional IVS stage events
5. Node.js side wasn't logging the full error response from browser

## Solution Applied

### 1. Enhanced Browser-Side Logging (`browser-client.html`)
Added comprehensive logging at every step:
- Token validation before use
- AudioContext state logging
- Oscillator and gain node creation logging
- LocalStageStream creation logging
- Stage instance creation logging
- Additional IVS event listeners (PARTICIPANT_JOINED, PARTICIPANT_LEFT)
- Full error logging with name, message, and stack trace

### 2. Improved Node.js Error Handling (`index.js`)
- Added token length logging
- Log full result object from browser evaluation
- Log error stack traces from browser
- Better exception handling with detailed error messages

### 3. Deployment
```bash
# Build updated Docker image
docker build -t shelcaster-program-controller:latest .

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 124355640062.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag shelcaster-program-controller:latest 124355640062.dkr.ecr.us-east-1.amazonaws.com/shelcaster-program-controller:latest
docker push 124355640062.dkr.ecr.us-east-1.amazonaws.com/shelcaster-program-controller:latest

# Stop old task to force new deployment
aws ecs stop-task --cluster shelcaster-cluster --task <TASK_ARN> --region us-east-1
```

## Testing Instructions

### 1. Start New Session
1. Go to `/podcast` in the browser
2. Click "Go Live" button
3. This triggers `create-session` Lambda which starts new ECS task

### 2. Monitor Logs
Run the test script:
```bash
cd e:/projects/shelcaster-functions/program-controller
powershell -ExecutionPolicy Bypass -File test-deployment.ps1
```

Or manually check logs:
```bash
# Get task ARN
aws ecs list-tasks --cluster shelcaster-cluster --region us-east-1

# Get logs (replace TASK_ID with actual ID)
aws logs get-log-events \
  --log-group-name "/ecs/shelcaster-program-controller" \
  --log-stream-name "ecs/program-controller/TASK_ID" \
  --limit 50 \
  --region us-east-1
```

### 3. Look for Success Indicators
✓ `[JOIN] ✓ stage.join() completed successfully`
✓ `[STAGE] ✓ Successfully joined IVS stage`
✓ `[INIT] Step 10: Successfully joined IVS stage`
✓ `[INIT] Step 12: Starting SQS polling loop...`

### 4. Test Track Playback
1. In `/podcast`, add tracks to tracklist
2. Click play button on a track
3. Should hear audio in the video stream after ~2 seconds

## Expected Behavior After Fix

With enhanced logging, we will now see:
1. **If token is invalid**: Clear error message about token format
2. **If AudioContext fails**: Error at AudioContext creation step
3. **If IVS SDK fails**: Full error with name, message, and stack trace
4. **If network issue**: Connection state change events
5. **If successful**: Clear progression through all join steps

## Next Steps If Still Failing

If the task still fails to join after this fix, the enhanced logs will reveal:
- **Token format issues**: Check if token is valid JWT
- **Network issues**: Check VPC/security group configuration
- **IVS SDK errors**: Check if stage ARN is valid and accessible
- **Browser compatibility**: Check if Puppeteer/Chromium supports IVS SDK
- **Permissions**: Check if IAM role has necessary IVS permissions

## Files Modified
- `browser-client.html` - Enhanced error handling and logging
- `index.js` - Improved error logging in joinStage function
- `deploy.ps1` - Deployment script (created)
- `test-deployment.ps1` - Testing script (created)

## Deployment Status
✓ Docker image built: `sha256:7478cc2526216dbe26bd5e2398553f4002f77cbd048c825f27bd5510ef6a1518`
✓ Pushed to ECR: `sha256:699370f98c2663d94a2063c9f685e2710db815d000d3333895e799b79f5ee11e`
✓ Old task stopped: `9a7fa87a21bd4b4194b9c476be7de8c6`
⏳ Waiting for new session to start new task with updated code
