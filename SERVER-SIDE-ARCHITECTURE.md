# Shelcaster Server-Side Architecture
## Production-Ready Live Broadcasting Platform

**Last Updated:** 2025-11-25  
**Status:** Planning Phase  
**Goal:** Build a reliable, server-side audio mixing system for live radio broadcasts with callers

---

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Phase 1: Core Infrastructure](#phase-1-core-infrastructure)
4. [Phase 2: Audio Mixing Engine](#phase-2-audio-mixing-engine)
5. [Phase 3: Studio UI & Controls](#phase-3-studio-ui--controls)
6. [Data Models](#data-models)
7. [API Endpoints](#api-endpoints)
8. [Deployment Strategy](#deployment-strategy)
9. [Cost Estimates](#cost-estimates)
10. [Timeline](#timeline)

---

## Overview

### The Problem
Current browser-based POC has critical limitations:
- ❌ Refreshing browser drops the entire show
- ❌ Browser crashes = show ends
- ❌ Unreliable audio mixing in browser
- ❌ No persistence or recovery
- ❌ Not production-ready

### The Solution
Server-side composition service that:
- ✅ Runs independently of browser
- ✅ Persists show state in DynamoDB
- ✅ Professional audio mixing with FFmpeg
- ✅ Outputs to IVS Channel for viewers
- ✅ Host controls via API, doesn't do mixing
- ✅ Recoverable and scalable

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         SHELCASTER PLATFORM                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Host UI    │      │  Caller UI   │      │  Viewer UI   │  │
│  │  (Browser)   │      │  (Browser)   │      │  (Browser)   │  │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘  │
│         │                     │                      │           │
│         │ Control API         │ Join Stage           │ Watch HLS │
│         ▼                     ▼                      ▼           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              API Gateway + Lambda Functions               │  │
│  │  • Start/Stop Show    • Toggle Caller On/Off Air         │  │
│  │  • Create Stage       • Get Show Status                  │  │
│  └──────────────┬───────────────────────────────────────────┘  │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    DynamoDB Tables                        │  │
│  │  • Shows  • Participants  • AudioRouting  • Tracklists   │  │
│  └──────────────┬───────────────────────────────────────────┘  │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         ECS Fargate - Composition Service                 │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  1. Join IVS Stage as Virtual Participant          │  │  │
│  │  │  2. Subscribe to Host + Caller audio streams       │  │  │
│  │  │  3. Download tracklist audio from S3               │  │  │
│  │  │  4. Mix audio with FFmpeg:                         │  │  │
│  │  │     - Mix A: Host + On-Air Callers                 │  │  │
│  │  │     - Mix B: Tracklist                             │  │  │
│  │  │     - Output: Mix A + Mix B                        │  │  │
│  │  │  5. Stream to IVS Channel via RTMPS                │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────┬───────────────────────────────────────────┘  │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              IVS Real-Time Stage (WebRTC)                 │  │
│  │  Participants: Host, Callers, Virtual Participant        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│                 │                                                │
│                 ▼                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              IVS Channel (HLS Output)                     │  │
│  │  Receives RTMPS from Composition Service                 │  │
│  │  Outputs HLS for viewers to watch                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles
1. **Separation of Concerns**: UI sends commands, server does work
2. **Stateful Server**: ECS container maintains show state
3. **Event-Driven**: DynamoDB Streams trigger updates
4. **Resilient**: Can recover from failures
5. **Observable**: CloudWatch logs and metrics

---

## Phase 1: Core Infrastructure
**Goal:** Get a container running that can join an IVS Stage and stay connected
**Duration:** 1-2 weeks
**Deliverables:** Working ECS service that joins Stage as virtual participant

### 1.1 ECS Container Setup

**Technology Stack:**
- **Base Image:** `node:20-alpine` (lightweight)
- **WebRTC Library:** `amazon-ivs-web-broadcast` SDK (Node.js version)
- **Alternative:** Use `wrtc` package for Node.js WebRTC support
- **Process Manager:** PM2 for auto-restart on crashes

**Container Responsibilities:**
- Join IVS Stage using participant token
- Subscribe to all participant streams
- Maintain WebRTC connection
- Report health status to DynamoDB
- Handle reconnection on network issues

**Dockerfile Example:**
```dockerfile
FROM node:20-alpine

# Install FFmpeg (for Phase 2)
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

CMD ["node", "src/index.js"]
```

### 1.2 DynamoDB Tables

**Table: `shelcaster-active-shows`**
```
PK: showId (String)
SK: "METADATA" (String)
---
stageArn: String
channelArn: String
hostUserId: String
status: "STARTING" | "LIVE" | "STOPPING" | "STOPPED"
compositionServiceTaskArn: String (ECS task ARN)
compositionServiceStatus: "STARTING" | "RUNNING" | "STOPPED"
tracklistId: String
createdAt: Number (timestamp)
updatedAt: Number (timestamp)
```

**Table: `shelcaster-participants`**
```
PK: showId (String)
SK: participantId (String)
---
username: String
role: "HOST" | "CALLER" | "VIRTUAL_PARTICIPANT"
isOnAir: Boolean
isPublishing: Boolean
joinedAt: Number (timestamp)
leftAt: Number (timestamp, optional)
```

**Table: `shelcaster-audio-routing`**
```
PK: showId (String)
SK: "CONFIG" (String)
---
tracklistVolume: Number (0-100)
hostVolume: Number (0-100)
callersVolume: Number (0-100)
onAirCallerIds: [String] (list of participant IDs)
updatedAt: Number (timestamp)
```

### 1.3 Lambda Functions (Phase 1)

**Function: `shelcaster-start-composition`**
- **Trigger:** API Gateway POST `/shows/{showId}/start-composition`
- **Purpose:** Launch ECS task for composition service
- **Steps:**
  1. Get show details from DynamoDB
  2. Create participant token for virtual participant
  3. Launch ECS task with environment variables:
     - `SHOW_ID`
     - `STAGE_TOKEN`
     - `CHANNEL_ARN`
     - `TRACKLIST_ID`
  4. Update show status to "STARTING"
  5. Return task ARN

**Function: `shelcaster-stop-composition`**
- **Trigger:** API Gateway POST `/shows/{showId}/stop-composition`
- **Purpose:** Stop ECS task gracefully
- **Steps:**
  1. Get task ARN from DynamoDB
  2. Send SIGTERM to ECS task
  3. Wait for graceful shutdown (30s timeout)
  4. Update show status to "STOPPED"

**Function: `shelcaster-get-composition-status`**
- **Trigger:** API Gateway GET `/shows/{showId}/composition-status`
- **Purpose:** Get real-time status of composition service
- **Returns:**
  - Task status (RUNNING, STOPPED, etc.)
  - Participant count
  - Audio routing config
  - Last heartbeat timestamp

### 1.4 ECS Service Configuration

**Task Definition:**
```json
{
  "family": "shelcaster-composition-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "composition-service",
      "image": "<ECR_REPO_URI>:latest",
      "essential": true,
      "environment": [
        {"name": "AWS_REGION", "value": "us-east-1"},
        {"name": "DYNAMODB_TABLE_SHOWS", "value": "shelcaster-active-shows"},
        {"name": "DYNAMODB_TABLE_PARTICIPANTS", "value": "shelcaster-participants"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/shelcaster-composition",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**IAM Permissions:**
- DynamoDB: Read/Write to all Shelcaster tables
- IVS: CreateParticipantToken, GetStage
- CloudWatch: PutMetricData, CreateLogStream, PutLogEvents
- S3: GetObject (for tracklist audio files)

---

## Phase 2: Audio Mixing Engine
**Goal:** Capture participant audio and mix with tracklist
**Duration:** 2-3 weeks
**Deliverables:** Working audio pipeline that outputs to IVS Channel

### 2.1 WebRTC Audio Capture

**Challenge:** Capture audio from IVS Stage participants in Node.js

**Solution Options:**

**Option A: Use `wrtc` package (Node.js WebRTC)**
- Pros: Native Node.js, can run in container
- Cons: Complex setup, may have compatibility issues

**Option B: Use Puppeteer/Playwright (Headless Browser)**
- Pros: Can use `amazon-ivs-web-broadcast` SDK directly
- Cons: Higher memory usage, more complex

**Recommended: Option B (Headless Browser)**

**Implementation:**
```javascript
const puppeteer = require('puppeteer');

async function joinStageAndCaptureAudio(stageToken) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream']
  });

  const page = await browser.newPage();

  // Inject IVS SDK and join stage
  await page.evaluateOnNewDocument((token) => {
    // Join stage, subscribe to all participants
    // Capture audio streams to MediaRecorder
  }, stageToken);

  // Pipe audio to FFmpeg
}
```

### 2.2 FFmpeg Audio Mixing Pipeline

**Audio Sources:**
1. **Host Microphone** - From IVS Stage
2. **Caller Audio** - From IVS Stage (multiple streams)
3. **Tracklist Audio** - From S3 (MP3/AAC files)

**Mixing Strategy:**
```
Input 1: Host Audio (from WebRTC)
Input 2: Caller 1 Audio (from WebRTC)
Input 3: Caller 2 Audio (from WebRTC)
Input 4: Tracklist Audio (from S3)

FFmpeg Command:
ffmpeg \
  -f s16le -ar 48000 -ac 1 -i pipe:0 \  # Host
  -f s16le -ar 48000 -ac 1 -i pipe:1 \  # Caller 1
  -f s16le -ar 48000 -ac 1 -i pipe:2 \  # Caller 2
  -i tracklist.mp3 \                     # Tracklist
  -filter_complex "\
    [0:a]volume=1.0[host]; \
    [1:a]volume=1.0[caller1]; \
    [2:a]volume=1.0[caller2]; \
    [host][caller1][caller2]amix=inputs=3:duration=longest[voice_mix]; \
    [3:a]volume=0.3[music]; \
    [voice_mix][music]amix=inputs=2:duration=longest[final]" \
  -map "[final]" \
  -c:a aac -b:a 128k \
  -f flv rtmps://CHANNEL_INGEST_ENDPOINT/STREAM_KEY
```

**Dynamic Mixing:**
- Monitor `shelcaster-audio-routing` table for changes
- Adjust volumes in real-time
- Add/remove caller inputs based on `isOnAir` status

### 2.3 RTMPS Output to IVS Channel

**Steps:**
1. Get IVS Channel ingest endpoint from DynamoDB
2. Get stream key (stored securely in Secrets Manager)
3. Stream mixed audio to RTMPS endpoint
4. Monitor stream health (bitrate, dropped frames)

**Error Handling:**
- Reconnect on network failure
- Buffer audio during reconnection
- Alert if stream is down for >30 seconds

### 2.4 Lambda Functions (Phase 2)

**Function: `shelcaster-update-audio-routing`**
- **Trigger:** API Gateway PUT `/shows/{showId}/audio-routing`
- **Purpose:** Update audio mixing configuration
- **Input:**
  ```json
  {
    "tracklistVolume": 30,
    "hostVolume": 100,
    "callersVolume": 80,
    "onAirCallerIds": ["caller-123", "caller-456"]
  }
  ```
- **Steps:**
  1. Validate input
  2. Update `shelcaster-audio-routing` table
  3. Composition service watches DynamoDB Stream
  4. FFmpeg adjusts volumes in real-time

**Function: `shelcaster-toggle-caller-on-air`**
- **Trigger:** API Gateway POST `/shows/{showId}/callers/{callerId}/toggle-on-air`
- **Purpose:** Add/remove caller from "on air" mix
- **Steps:**
  1. Get current audio routing config
  2. Add or remove caller ID from `onAirCallerIds`
  3. Update DynamoDB
  4. Composition service adjusts FFmpeg inputs

---

## Phase 3: Studio UI & Controls
**Goal:** Build host dashboard for controlling the show
**Duration:** 1-2 weeks
**Deliverables:** React UI for show management

### 3.1 Host Dashboard Features

**Show Control Panel:**
- ✅ Start/Stop Show button
- ✅ Show status indicator (STARTING, LIVE, STOPPING)
- ✅ Composition service health status
- ✅ Viewer count (from IVS Channel metrics)

**Participant Management:**
- ✅ List of connected participants
- ✅ "On Air" toggle for each caller
- ✅ Volume sliders (host, callers, tracklist)
- ✅ Kick participant button

**Tracklist Player:**
- ✅ Current track display
- ✅ Play/Pause/Skip controls
- ✅ Volume control
- ✅ Queue display

**Audio Monitoring:**
- ✅ VU meters for each audio source
- ✅ Master output level
- ✅ Clipping indicators

### 3.2 Real-Time Updates

**WebSocket Connection:**
- Use API Gateway WebSocket API
- Subscribe to show updates
- Receive participant join/leave events
- Receive audio level updates

**Alternative: Polling:**
- Poll `/shows/{showId}/status` every 2 seconds
- Simpler implementation
- Good enough for MVP

### 3.3 Caller Join Page

**Simple Join Flow:**
1. Caller opens link: `/join/{showId}?token=CALLER_TOKEN`
2. Enter name
3. Allow camera/mic permissions
4. Join IVS Stage
5. Show "You're connected" status
6. Display "On Air" indicator when host enables

**No Mixing in Browser:**
- Caller just publishes their audio/video
- Server handles all mixing
- Caller sees their own preview only

---

## Data Models (Detailed)

### Show Lifecycle States

```
CREATING → STARTING → LIVE → STOPPING → STOPPED
           ↓                    ↓
         ERROR                ERROR
```

**State Transitions:**
- `CREATING`: Show record created, Stage being created
- `STARTING`: ECS task launching, joining Stage
- `LIVE`: Composition service running, streaming to Channel
- `STOPPING`: Graceful shutdown initiated
- `STOPPED`: All resources cleaned up
- `ERROR`: Recoverable error, can retry

### Participant States

```
JOINING → CONNECTED → PUBLISHING → ON_AIR
          ↓           ↓             ↓
        DISCONNECTED  MUTED       OFF_AIR
```

### Audio Routing Configuration

**Default Values:**
```json
{
  "tracklistVolume": 30,
  "hostVolume": 100,
  "callersVolume": 80,
  "onAirCallerIds": [],
  "masterVolume": 100,
  "compression": {
    "enabled": true,
    "threshold": -20,
    "ratio": 4
  },
  "limiter": {
    "enabled": true,
    "ceiling": -1
  }
}
```

---

## API Endpoints (Complete List)

### Show Management

**POST `/shows/{showId}/start`**
- Start a show (create Stage, launch composition service)
- Returns: `{ stageArn, channelArn, hostToken, callerToken }`

**POST `/shows/{showId}/stop`**
- Stop a show gracefully
- Returns: `{ status: "STOPPING" }`

**GET `/shows/{showId}/status`**
- Get current show status
- Returns: Show metadata, participant count, composition status

### Composition Service

**POST `/shows/{showId}/composition/start`**
- Launch ECS task for composition
- Returns: `{ taskArn, status }`

**POST `/shows/{showId}/composition/stop`**
- Stop ECS task
- Returns: `{ status: "STOPPED" }`

**GET `/shows/{showId}/composition/health`**
- Get composition service health
- Returns: `{ status, lastHeartbeat, metrics }`

### Participant Management

**GET `/shows/{showId}/participants`**
- List all participants
- Returns: Array of participant objects

**POST `/shows/{showId}/participants/{participantId}/kick`**
- Remove participant from Stage
- Returns: `{ success: true }`

**POST `/shows/{showId}/participants/{participantId}/toggle-on-air`**
- Toggle caller on/off air
- Returns: `{ isOnAir: true/false }`

### Audio Routing

**GET `/shows/{showId}/audio-routing`**
- Get current audio configuration
- Returns: Audio routing config object

**PUT `/shows/{showId}/audio-routing`**
- Update audio configuration
- Body: `{ tracklistVolume, hostVolume, callersVolume, onAirCallerIds }`
- Returns: Updated config

**POST `/shows/{showId}/audio-routing/reset`**
- Reset to default values
- Returns: Default config

---

## Deployment Strategy

### Phase 1 Deployment

**Step 1: Create DynamoDB Tables**
```bash
aws dynamodb create-table \
  --table-name shelcaster-active-shows \
  --attribute-definitions AttributeName=showId,AttributeType=S \
  --key-schema AttributeName=showId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

**Step 2: Build and Push Docker Image**
```bash
cd composition-service
docker build -t shelcaster-composition .
aws ecr get-login-password | docker login --username AWS --password-stdin <ECR_URI>
docker tag shelcaster-composition:latest <ECR_URI>:latest
docker push <ECR_URI>:latest
```

**Step 3: Create ECS Task Definition**
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

**Step 4: Deploy Lambda Functions**
```bash
cd shelcaster-functions
./deploy-composition-functions.ps1
```

**Step 5: Add API Gateway Routes**
```bash
./add-composition-routes.ps1
```

### Phase 2 Deployment

**Step 1: Update Docker Image with FFmpeg**
- Add FFmpeg to Dockerfile
- Implement audio mixing logic
- Push new image version

**Step 2: Deploy Audio Routing Lambdas**
```bash
./deploy-audio-routing-functions.ps1
```

**Step 3: Enable DynamoDB Streams**
- Enable streams on `shelcaster-audio-routing` table
- Composition service subscribes to changes

### Phase 3 Deployment

**Step 1: Deploy Studio UI**
```bash
cd shelcaster-broadcast-studio
npm run build
aws s3 sync dist/ s3://shelcaster-studio-ui/
```

**Step 2: Configure CloudFront**
- Point to S3 bucket
- Enable HTTPS
- Configure custom domain

---

## Cost Estimates

### Monthly Costs (Assuming 10 concurrent shows, 2 hours each, 30 days)

**ECS Fargate:**
- 1 vCPU, 2GB RAM
- $0.04048/hour × 2 hours × 10 shows × 30 days = **$24.29/month**

**IVS Real-Time:**
- Stage hours: 2 hours × 10 shows × 30 days = 600 hours
- $0.0135/participant-hour × 3 participants × 600 hours = **$24.30/month**

**IVS Channel:**
- Input hours: 600 hours × $0.015 = **$9.00/month**
- Output (HD): 600 hours × $0.0119 = **$7.14/month**

**DynamoDB:**
- On-demand pricing
- Estimated: **$5/month**

**Data Transfer:**
- Estimated: **$10/month**

**Total: ~$80/month for 10 concurrent shows**

### Per-Show Cost
- **$0.27 per 2-hour show**

---

## Timeline

### Week 1-2: Phase 1 - Core Infrastructure
- [ ] Set up DynamoDB tables
- [ ] Create ECS task definition
- [ ] Build Docker image with WebRTC support
- [ ] Implement Stage joining logic
- [ ] Deploy Lambda functions for start/stop
- [ ] Test: Container can join Stage and stay connected

### Week 3-4: Phase 2 - Audio Mixing
- [ ] Implement audio capture from WebRTC
- [ ] Build FFmpeg mixing pipeline
- [ ] Implement RTMPS streaming to IVS Channel
- [ ] Add DynamoDB Stream listener for config changes
- [ ] Deploy audio routing Lambda functions
- [ ] Test: Audio mixing works, can toggle callers on/off

### Week 5-6: Phase 3 - Studio UI
- [ ] Build host dashboard UI
- [ ] Implement participant list with controls
- [ ] Add audio routing controls
- [ ] Implement real-time status updates
- [ ] Build caller join page
- [ ] Test: Full end-to-end flow

### Week 7: Testing & Polish
- [ ] Load testing (multiple concurrent shows)
- [ ] Error recovery testing
- [ ] UI/UX improvements
- [ ] Documentation
- [ ] Production deployment

---

## Success Criteria

### Phase 1 Success
- ✅ ECS container joins IVS Stage
- ✅ Container stays connected for 2+ hours
- ✅ Can start/stop via API
- ✅ Status updates in DynamoDB

### Phase 2 Success
- ✅ Audio from host + callers captured
- ✅ Tracklist audio mixed in
- ✅ Output streams to IVS Channel
- ✅ Can toggle callers on/off air
- ✅ Volume controls work

### Phase 3 Success
- ✅ Host can control show from browser
- ✅ Refreshing browser doesn't affect show
- ✅ Callers can join easily
- ✅ Real-time status updates work
- ✅ Professional audio quality

---

## Next Steps

1. **Review this architecture** - Make sure it meets your needs
2. **Prioritize features** - What's most important?
3. **Start Phase 1** - Build the foundation
4. **Iterate** - Test each phase before moving on

**Ready to start when you are!** 🚀


