# MediaLive Auto-Create Flow Diagram

## User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                        SHELCASTER STUDIO                        │
│                     (Frontend Application)                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ 1. User logs in
                                ▼
                    ┌───────────────────────┐
                    │   Select/Create Show  │
                    └───────────────────────┘
                                │
                                │ 2. Click "Join Stage"
                                ▼
                    ┌───────────────────────┐
                    │  Create LiveSession   │
                    │  - RAW stage created  │
                    │  - PROGRAM channel    │
                    │  - Session in DynamoDB│
                    └───────────────────────┘
                                │
                                │ 3. Click "Go Live" ⭐
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO-CREATE MEDIALIVE CHANNEL                │
└─────────────────────────────────────────────────────────────────┘
```

## Backend Flow (Auto-Create)

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /sessions/{sessionId}/streaming/start                     │
│  Lambda: shelcaster-start-streaming                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Get Session from      │
                    │ DynamoDB              │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Does MediaLive        │
                    │ channel exist?        │
                    └───────────────────────┘
                        │              │
                   NO   │              │ YES
                        │              │
            ┌───────────┘              └───────────┐
            ▼                                      ▼
┌───────────────────────┐              ┌───────────────────────┐
│ CREATE MEDIALIVE      │              │ USE EXISTING CHANNEL  │
│ CHANNEL               │              └───────────────────────┘
└───────────────────────┘                          │
            │                                      │
            ▼                                      │
┌───────────────────────┐                          │
│ 1. Create RTMP Input  │                          │
│    - Host camera      │                          │
│    - 2 endpoints      │                          │
└───────────────────────┘                          │
            │                                      │
            ▼                                      │
┌───────────────────────┐                          │
│ 2. Create Channel     │                          │
│    - Input: RTMP      │                          │
│    - Output 1: IVS    │                          │
│    - Output 2: S3     │                          │
└───────────────────────┘                          │
            │                                      │
            ▼                                      │
┌───────────────────────┐                          │
│ 3. Save to DynamoDB   │                          │
│    - channelId        │                          │
│    - channelArn       │                          │
│    - rtmpEndpoints    │                          │
└───────────────────────┘                          │
            │                                      │
            └──────────────┬───────────────────────┘
                           ▼
                ┌───────────────────────┐
                │ Start MediaLive       │
                │ Channel               │
                └───────────────────────┘
                           │
                           ▼
                ┌───────────────────────┐
                │ Start IVS Channel     │
                └───────────────────────┘
                           │
                           ▼
                ┌───────────────────────┐
                │ Update Session State  │
                │ streaming.isLive=true │
                └───────────────────────┘
                           │
                           ▼
                ┌───────────────────────┐
                │ Return Success        │
                │ + Playback URL        │
                └───────────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                               │
│  ControlPanel.jsx → mediaLiveService.js                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ JWT Token
                                │ Session ID
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                              │
│  POST /sessions/{sessionId}/streaming/start                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAMBDA FUNCTION                              │
│  shelcaster-start-streaming                                     │
│  Environment Variables:                                         │
│  - MEDIALIVE_ROLE_ARN                                           │
│  - MEDIALIVE_INPUT_SECURITY_GROUP_ID                            │
└─────────────────────────────────────────────────────────────────┘
        │                   │                   │
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  DynamoDB   │   │ MediaLive   │   │     IVS     │
│             │   │             │   │             │
│ - Get       │   │ - Create    │   │ - Start     │
│   session   │   │   input     │   │   channel   │
│             │   │ - Create    │   │             │
│ - Update    │   │   channel   │   │             │
│   session   │   │ - Start     │   │             │
│             │   │   channel   │   │             │
└─────────────┘   └─────────────┘   └─────────────┘
```

## MediaLive Channel Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEDIALIVE CHANNEL                            │
│                  shelcaster-{sessionId}                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
        ┌───────────────┐             ┌───────────────┐
        │     INPUT     │             │   ENCODER     │
        │               │             │               │
        │ RTMP Push     │────────────▶│ Video: H.264  │
        │ - stream1     │             │ 1920x1080     │
        │ - stream2     │             │ 4.5 Mbps      │
        │               │             │ 30fps         │
        │ Security      │             │               │
        │ Group: 7480724│             │ Audio: AAC    │
        │               │             │ 128 kbps      │
        └───────────────┘             │ 48 kHz        │
                                      └───────────────┘
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        ▼                                           ▼
            ┌───────────────────┐                       ┌───────────────────┐
            │   OUTPUT 1: IVS   │                       │   OUTPUT 2: S3    │
            │                   │                       │                   │
            │ RTMP Output       │                       │ HLS Output        │
            │ Destination:      │                       │ Destination:      │
            │ IVS Program       │                       │ s3://shelcaster-  │
            │ Ingest Endpoint   │                       │ media-manager/    │
            │                   │                       │ sessions/         │
            │ Purpose:          │                       │ {sessionId}/      │
            │ Live Streaming    │                       │ recording/        │
            │                   │                       │                   │
            │                   │                       │ Purpose:          │
            │                   │                       │ Recording         │
            └───────────────────┘                       └───────────────────┘
                        │                                           │
                        ▼                                           ▼
            ┌───────────────────┐                       ┌───────────────────┐
            │  IVS CHANNEL      │                       │  S3 BUCKET        │
            │  (PROGRAM)        │                       │                   │
            │                   │                       │ HLS segments      │
            │ Viewers watch     │                       │ saved for         │
            │ live stream       │                       │ post-show export  │
            └───────────────────┘                       └───────────────────┘
```

## Session State in DynamoDB

```
┌─────────────────────────────────────────────────────────────────┐
│  DynamoDB Table: shelcaster-app                                 │
│  pk: session#{sessionId}                                        │
│  sk: info                                                       │
└─────────────────────────────────────────────────────────────────┘

BEFORE "Go Live":
{
  "sessionId": "abc123",
  "showId": "show456",
  "ivs": {
    "rawStageArn": "arn:aws:ivs:...",
    "programChannelArn": "arn:aws:ivs:...",
    "programIngestEndpoint": "rtmps://...",
    "programPlaybackUrl": "https://..."
  },
  "streaming": {
    "isLive": false
  }
}

AFTER "Go Live" (Auto-Created):
{
  "sessionId": "abc123",
  "showId": "show456",
  "ivs": { ... },
  "mediaLive": {                          ⭐ NEW
    "channelId": "1234567",               ⭐ NEW
    "channelArn": "arn:aws:medialive:...",⭐ NEW
    "inputIds": {                         ⭐ NEW
      "host": "9876543"                   ⭐ NEW
    },                                    ⭐ NEW
    "rtmpEndpoints": {                    ⭐ NEW
      "host": [                           ⭐ NEW
        {                                 ⭐ NEW
          "url": "rtmp://...",            ⭐ NEW
          "streamName": "stream1"         ⭐ NEW
        },                                ⭐ NEW
        {                                 ⭐ NEW
          "url": "rtmp://...",            ⭐ NEW
          "streamName": "stream2"         ⭐ NEW
        }                                 ⭐ NEW
      ]                                   ⭐ NEW
    }                                     ⭐ NEW
  },                                      ⭐ NEW
  "streaming": {
    "isLive": true,                       ⭐ UPDATED
    "startedAt": "2025-01-15T10:30:00Z"   ⭐ UPDATED
  }
}
```

## Cost Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE AUTO-CREATE                           │
└─────────────────────────────────────────────────────────────────┘

Manual Setup:
  1. Create MediaLive channel manually
  2. Leave channel running 24/7
  3. Cost: $2.55/hour × 24 hours = $61.20/day

Monthly Cost: $1,836

┌─────────────────────────────────────────────────────────────────┐
│                    AFTER AUTO-CREATE                            │
└─────────────────────────────────────────────────────────────────┘

Automatic Setup:
  1. Channel created on "Go Live"
  2. Channel stopped when not streaming
  3. Cost: $2.55/hour × actual streaming hours

Example (2 hours/day):
  Daily Cost: $5.10
  Monthly Cost: $153

SAVINGS: $1,683/month (92% reduction)
```

## Timeline

```
T=0s    User clicks "Go Live"
        │
T=1s    API call to Lambda
        │
T=2s    Lambda checks DynamoDB
        │
T=3s    MediaLive channel creation starts
        │
T=10s   RTMP input created
        │
T=15s   MediaLive channel created
        │
T=20s   Channel info saved to DynamoDB
        │
T=25s   MediaLive channel starting
        │
T=30s   IVS channel starting
        │
T=35s   Session state updated
        │
T=40s   Stream goes live ✅
        │
T=45s   Viewers can watch
```

## Success Indicators

```
✅ Lambda logs show "MediaLive channel not found, creating..."
✅ Lambda logs show "MediaLive channel created: {channelId}"
✅ AWS Console → MediaLive shows new channel
✅ Channel state: RUNNING
✅ DynamoDB session has mediaLive object
✅ IVS playback URL shows live stream
✅ S3 bucket receives recording segments
✅ No duplicate channels created
```

## Error Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                      ERROR SCENARIOS                            │
└─────────────────────────────────────────────────────────────────┘

1. Missing Environment Variables
   ├─→ Error: "Missing MEDIALIVE_ROLE_ARN"
   └─→ Solution: Run deploy-start-streaming.ps1

2. Missing IVS Ingest Endpoint
   ├─→ Error: "IVS ingest endpoint not found in session"
   └─→ Solution: Verify shelcaster-create-session creates IVS channels

3. MediaLive Role Permissions
   ├─→ Error: "AccessDeniedException"
   └─→ Solution: Verify role has required permissions

4. Channel Already Exists
   ├─→ Behavior: Use existing channel (no error)
   └─→ Log: "MediaLive channel started: {channelId}"

5. Channel Already Running
   ├─→ Error: "ConflictException"
   └─→ Behavior: Ignored (channel already running)
   └─→ Log: "MediaLive channel already running"
```

---

**Legend:**
- ⭐ = New/Updated
- ✅ = Success indicator
- ├─→ = Flow branch
- └─→ = Flow continuation
- │ = Flow direction
- ▼ = Next step
