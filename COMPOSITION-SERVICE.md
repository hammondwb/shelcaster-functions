# Shelcaster Composition Service

## Purpose
Mix IVS Stage participants + tracklist audio → IVS Channel RTMPS stream

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         COMPOSITION SERVICE (Docker Container)          │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  1. STAGE CLIENT (Puppeteer + WebRTC)         │    │
│  │     - Join IVS Stage as participant            │    │
│  │     - Subscribe to all participant streams     │    │
│  │     - Capture audio/video to files             │    │
│  └────────────────┬───────────────────────────────┘    │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────┐    │
│  │  2. FFMPEG MIXER                               │    │
│  │     - Mix participant audio                    │    │
│  │     - Add tracklist audio (separate mix)       │    │
│  │     - Composite video layout                   │    │
│  │     - Encode to H.264 + AAC                    │    │
│  └────────────────┬───────────────────────────────┘    │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────┐    │
│  │  3. RTMPS OUTPUT                               │    │
│  │     - Stream to IVS Channel ingest endpoint    │    │
│  │     - Handle reconnection                      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Technology Stack

- **Node.js** - Main application
- **Puppeteer** - WebRTC client (joins Stage)
- **FFmpeg** - Audio/video mixing and encoding
- **Docker** - Containerization
- **ECS Fargate** - Hosting

## Environment Variables

```bash
SHOW_ID=<show-id>
STAGE_TOKEN=<participant-token>
CHANNEL_INGEST_ENDPOINT=<rtmps://...>
CHANNEL_STREAM_KEY=<stream-key>
TRACKLIST_URL=<optional-audio-url>
AWS_REGION=us-east-1
```

## Implementation Plan

### Step 1: Stage Client
Create a Puppeteer-based client that:
- Joins IVS Stage using token
- Subscribes to all participant streams
- Captures streams to local files/pipes

### Step 2: FFmpeg Pipeline
Build FFmpeg command that:
- Takes participant audio/video inputs
- Mixes audio (host + callers)
- Adds tracklist audio (separate mix)
- Creates video layout (grid/active speaker)
- Outputs RTMPS

### Step 3: Container
Package everything in Docker:
- Alpine Linux base
- Node.js + Puppeteer
- FFmpeg with RTMPS support
- Chromium for WebRTC

### Step 4: Deployment
Deploy to ECS:
- Task definition
- Auto-start via Lambda
- Auto-stop when show ends
- CloudWatch logs

## FFmpeg Command Example

```bash
ffmpeg \
  -f pulse -i stage_audio \
  -i tracklist.mp3 \
  -f x11grab -i :99 \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest[aout]" \
  -map 2:v -map "[aout]" \
  -c:v libx264 -preset veryfast -b:v 3000k \
  -c:a aac -b:a 128k \
  -f flv rtmps://${INGEST_ENDPOINT}:443/app/${STREAM_KEY}
```

## Next Steps

1. Create composition service directory structure
2. Implement Stage client with IVS Web Broadcast SDK
3. Build FFmpeg mixing pipeline
4. Test locally
5. Containerize and deploy to ECS

