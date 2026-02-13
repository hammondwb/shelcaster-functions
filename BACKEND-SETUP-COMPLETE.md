# Backend Setup Complete - Track Playback Infrastructure

## What Was Set Up

### 1. SQS Queue ✅
- **Queue Name**: `shelcaster-program-commands`
- **URL**: `https://sqs.us-east-1.amazonaws.com/124355640062/shelcaster-program-commands`
- **Purpose**: Routes PLAY_MEDIA, PAUSE_MEDIA, STOP_MEDIA commands to ECS task

### 2. ECS Cluster ✅
- **Cluster Name**: `shelcaster-cluster`
- **ARN**: `arn:aws:ecs:us-east-1:124355640062:cluster/shelcaster-cluster`
- **Status**: ACTIVE

### 3. ECS Task Definition ✅
- **Task Definition**: `shelcaster-program-controller:5`
- **Image**: `124355640062.dkr.ecr.us-east-1.amazonaws.com/shelcaster-program-controller:latest`
- **CPU**: 512
- **Memory**: 1024 MB
- **Network Mode**: awsvpc (Fargate)

### 4. CloudWatch Logs ✅
- **Log Group**: `/ecs/shelcaster-program-controller`
- **Purpose**: ECS task logs for debugging

### 5. Updated Lambda ✅
- **Function**: `shelcaster-create-session`
- **Change**: Updated to use `shelcaster-cluster` instead of `shelcaster-vp-cluster`
- **Deployed**: Successfully

## How It Works

1. **User creates session** → `shelcaster-create-session` Lambda runs
2. **Lambda starts ECS task** → `program-controller` container launches
3. **ECS task joins IVS stage** → As virtual participant using Puppeteer
4. **User clicks play track** → Frontend calls `playMedia()` API
5. **Lambda sends command to SQS** → `PLAY_MEDIA` message queued
6. **ECS task polls SQS** → Receives command
7. **ECS task plays media** → Streams audio to IVS stage via browser
8. **Audio mixes with participants** → Heard in composition output

## Testing Track Playback

1. Go to `/podcast` route
2. Join a show (creates session + starts ECS task)
3. Go Live (starts composition)
4. Import tracks from Program Manager
5. Click play button on a track
6. **Expected**: Track audio plays through the composition
7. **Check**: Browser console shows "playMedia API response: {command: 'PLAY_MEDIA', message: 'Command sent'}"

## Troubleshooting

### If track doesn't play:

1. **Check ECS task is running**:
   ```bash
   aws ecs list-tasks --cluster shelcaster-cluster --region us-east-1 --profile shelcaster-admin
   ```

2. **Check ECS task logs**:
   ```bash
   aws logs tail /ecs/shelcaster-program-controller --follow --region us-east-1 --profile shelcaster-admin
   ```

3. **Check SQS messages**:
   ```bash
   aws sqs receive-message --queue-url https://sqs.us-east-1.amazonaws.com/124355640062/shelcaster-program-commands --region us-east-1 --profile shelcaster-admin
   ```

4. **Verify program_url is valid**:
   - Check browser console for the URL being sent
   - Try opening the URL in a new tab to verify it plays

## Architecture Diagram

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ playMedia(sessionId, programId, program_url)
       ▼
┌─────────────────┐
│  API Gateway    │
│  + Lambda       │
└──────┬──────────┘
       │ Send to SQS
       ▼
┌─────────────────┐
│   SQS Queue     │
│  (Commands)     │
└──────┬──────────┘
       │ Poll
       ▼
┌─────────────────┐
│   ECS Task      │
│ (Puppeteer +    │
│  IVS SDK)       │
└──────┬──────────┘
       │ Publish audio
       ▼
┌─────────────────┐
│  IVS RAW Stage  │
│ (Host+Callers+  │
│  Track Audio)   │
└──────┬──────────┘
       │ Compose
       ▼
┌─────────────────┐
│ IVS Composition │
│ (Final Output)  │
└─────────────────┘
```

## Status: ✅ COMPLETE

All backend infrastructure is deployed and configured. Track playback should now work end-to-end.
