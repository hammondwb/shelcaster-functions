# Program Controller Implementation - Complete

## Summary
Server-side audio playback for tracklist programs is now fully implemented using a headless browser approach with Puppeteer and IVS Web Broadcast SDK.

## Architecture

### Components
1. **Program Controller (ECS Task)** - Node.js service running in Fargate
2. **Headless Browser** - Chromium via Puppeteer for WebRTC/IVS SDK
3. **SQS Queue** - `shelcaster-program-commands` for command delivery
4. **Lambda Functions** - API endpoints for playback control

### Flow
```
Frontend → API Gateway → shelcaster-play-media Lambda → SQS Queue
                                                            ↓
                                                    Program Controller (ECS)
                                                            ↓
                                                    Headless Browser (Chromium)
                                                            ↓
                                                    IVS Web Broadcast SDK
                                                            ↓
                                                    RAW Stage (IVS Real-Time)
                                                            ↓
                                                    Composition → Recording
```

## Implementation Details

### 1. Program Controller (ECS Task)
**Location:** `e:\projects\shelcaster-functions\program-controller\`

**Files:**
- `index.js` - Main Node.js controller
- `browser-client.html` - HTML page with IVS SDK
- `package.json` - Dependencies (Puppeteer, AWS SDKs)
- `Dockerfile` - Alpine Linux + Chromium + Node.js

**Features:**
- Launches headless Chromium browser
- Loads IVS Web Broadcast SDK in browser
- Joins RAW stage as virtual participant
- Polls SQS for commands (PLAY_MEDIA, PAUSE_MEDIA, STOP_MEDIA, ADJUST_VOLUME)
- Streams audio from S3 URLs directly to IVS stage
- Updates playback state in DynamoDB

**Docker Image:**
- Repository: `124355640062.dkr.ecr.us-east-1.amazonaws.com/shelcaster-program-controller`
- Tag: `latest`
- Size: ~737 MB (includes Chromium)

**ECS Task Definition:**
- Family: `shelcaster-program-controller`
- Revision: 5
- CPU: 512
- Memory: 1024 MB
- Network Mode: awsvpc
- Launch Type: FARGATE

### 2. Browser Client (browser-client.html)
**Purpose:** Runs IVS Web Broadcast SDK in headless browser

**Functions Exposed to Node.js:**
- `joinStage(participantToken)` - Join IVS stage
- `playMedia(mediaUrl, volume)` - Play audio and publish to stage
- `pauseMedia()` - Pause playback
- `stopMedia()` - Stop playback
- `adjustVolume(volume)` - Adjust volume
- `leaveStage()` - Leave stage

**Audio Processing:**
- Uses Web Audio API for volume control
- Captures audio stream via MediaStreamDestination
- Publishes audio track to IVS stage via LocalStageStream

### 3. Lambda Functions

#### shelcaster-play-media
**Purpose:** Send playback commands to Program Controller

**Endpoint:** `POST /sessions/{sessionId}/play-media`

**Request Body:**
```json
{
  "programId": "uuid",
  "mediaUrl": "https://d2kyyx47f0bavc.cloudfront.net/...",
  "command": "PLAY_MEDIA",
  "volume": 80
}
```

**Commands Supported:**
- `PLAY_MEDIA` - Start playing audio
- `PAUSE_MEDIA` - Pause playback
- `STOP_MEDIA` - Stop playback
- `ADJUST_VOLUME` - Change volume

#### shelcaster-create-session
**Updated:** Now starts Program Controller ECS task automatically

**Environment Variables Passed to ECS:**
- `SESSION_ID` - LiveSession ID
- `RAW_STAGE_ARN` - IVS stage ARN
- `PROGRAM_STAGE_ARN` - Program stage ARN
- `COMMAND_QUEUE_URL` - SQS queue URL
- `DDB_TABLE` - DynamoDB table name
- `REGION` - AWS region

### 4. SQS Queue
**Name:** `shelcaster-program-commands`
**URL:** `https://sqs.us-east-1.amazonaws.com/124355640062/shelcaster-program-commands`

**Message Format:**
```json
{
  "command": "PLAY_MEDIA",
  "sessionId": "uuid",
  "programId": "uuid",
  "mediaUrl": "https://...",
  "volume": 80
}
```

## Deployment

### Docker Image
```bash
cd program-controller
docker build -t shelcaster-program-controller .
docker tag shelcaster-program-controller:latest 124355640062.dkr.ecr.us-east-1.amazonaws.com/shelcaster-program-controller:latest
docker push 124355640062.dkr.ecr.us-east-1.amazonaws.com/shelcaster-program-controller:latest
```

### ECS Task Definition
```bash
aws ecs register-task-definition \
  --family shelcaster-program-controller \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --execution-role-arn arn:aws:iam::124355640062:role/shelcaster-compositor-execution-role \
  --task-role-arn arn:aws:iam::124355640062:role/shelcaster-compositor-task-role \
  --container-definitions file://task-definition.json
```

### Lambda Function
```bash
cd shelcaster-play-media
npm install
zip -r function.zip index.mjs node_modules
aws lambda update-function-code \
  --function-name shelcaster-play-media \
  --zip-file fileb://function.zip
```

## Usage

### Frontend Integration

1. **Join Stage** (already implemented)
   - Host joins RAW stage
   - Program Controller automatically starts

2. **Play Audio from Tracklist**
```javascript
const response = await fetch(
  `https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/${sessionId}/play-media`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      programId: program.programId,
      mediaUrl: program.program_url, // CloudFront URL
      command: 'PLAY_MEDIA',
      volume: 80
    })
  }
);
```

3. **Control Playback**
```javascript
// Pause
await fetch(url, {
  method: 'POST',
  body: JSON.stringify({ command: 'PAUSE_MEDIA' })
});

// Stop
await fetch(url, {
  method: 'POST',
  body: JSON.stringify({ command: 'STOP_MEDIA' })
});

// Adjust Volume
await fetch(url, {
  method: 'POST',
  body: JSON.stringify({ command: 'ADJUST_VOLUME', volume: 50 })
});
```

## Benefits

### Server-Side Playback
✅ Audio plays on server, not in browser
✅ No need for system audio loopback
✅ Audio captured in IVS composition
✅ Audio included in recordings
✅ Consistent audio quality
✅ No browser audio routing issues

### Architecture
✅ Headless browser approach (industry standard for WebRTC in Node.js)
✅ IVS Web Broadcast SDK works natively
✅ Scalable (ECS Fargate auto-scaling)
✅ Isolated per session
✅ Automatic cleanup when session ends

## Monitoring

### CloudWatch Logs
- Log Group: `/ecs/shelcaster-program-controller`
- Stream Prefix: `ecs`

### Key Logs to Monitor
- "Joining stage..." - Stage connection
- "✓ Joined IVS stage" - Successfully connected
- "▶ Playing media:" - Playback started
- "Received command:" - SQS message processed

### Troubleshooting
- Check ECS task status in AWS Console
- View CloudWatch logs for errors
- Verify SQS queue has messages
- Check DynamoDB playlistState field

## Cost Considerations

### ECS Fargate
- CPU: 0.5 vCPU = $0.04048/hour
- Memory: 1 GB = $0.004445/hour
- **Total:** ~$0.045/hour per session

### Data Transfer
- Audio streaming to IVS: Included in IVS pricing
- S3 to ECS: $0.09/GB (first 10 TB)

### Estimated Cost
- 1-hour session: ~$0.05
- 10 concurrent sessions: ~$0.50/hour

## Next Steps

### Frontend Integration
1. Add "Play" button to tracklist items
2. Call `/sessions/{sessionId}/play-media` API
3. Display playback state from DynamoDB
4. Add pause/stop/volume controls

### Enhancements
1. Playlist auto-advance (play next track when current ends)
2. Crossfade between tracks
3. Audio ducking (lower music when host speaks)
4. Real-time waveform visualization
5. Pre-loading next track for seamless transitions

## Testing

### Manual Test
1. Create session (join stage)
2. Call play-media API with CloudFront audio URL
3. Check CloudWatch logs for "Playing media"
4. Verify audio in IVS composition
5. Start recording and verify audio in recording

### Verification
- Audio should appear in Program Monitor
- Audio should be in recording file
- No browser audio routing needed
- Works consistently across all browsers

## Status
✅ **COMPLETE** - Server-side audio playback fully implemented and deployed
