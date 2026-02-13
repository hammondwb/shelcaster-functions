# Phase 2 Deployment Complete ✅

## What Was Deployed

### Lambda Function
- **Name:** `shelcaster-create-medialive-dynamic`
- **Purpose:** Creates MediaLive channel with URL_PULL inputs from IVS compositions
- **Timeout:** 120 seconds
- **Memory:** 512 MB

### API Gateway Route
- **Endpoint:** `POST /sessions/{sessionId}/medialive`
- **Route ID:** `32fkss9`
- **Integration ID:** `2nu084m`

---

## How It Works

### Flow:
1. **Create Compositions** (Phase 1)
   - Call: `POST /sessions/{sessionId}/compositions`
   - Returns: HLS URLs for each participant

2. **Create MediaLive Channel** (Phase 2)
   - Call: `POST /sessions/{sessionId}/medialive`
   - Input: Composition HLS URLs + IVS ingest endpoint
   - Creates: MediaLive channel with URL_PULL inputs
   - Output: Channel ID and ARN

3. **Start MediaLive Channel**
   - MediaLive pulls HLS from each composition
   - Mixes audio from all participants
   - Outputs to IVS channel (streaming)

---

## API Usage

```javascript
// Step 1: Create compositions
const compositions = await fetch(
  `https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/${sessionId}/compositions`,
  {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      stageArn,
      participants: [
        { participantId: 'host-123' },
        { participantId: 'caller-456' }
      ]
    })
  }
).then(r => r.json())

// Step 2: Create MediaLive channel
const medialive = await fetch(
  `https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/${sessionId}/medialive`,
  {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      compositions: compositions.compositions,
      ivsIngestEndpoint: 'rtmps://...'
    })
  }
).then(r => r.json())

// Returns: { channelId, channelArn }
```

---

## What's Next

### Phase 3: Source Switching
- Lambda to switch MediaLive inputs
- Frontend button to switch between participants

### Phase 4: Audio Level Controls
- Lambda to adjust MediaLive audio mixer
- Frontend sliders for each participant

### Phase 5: Wire Up "Go Live"
- Integrate all phases into single "Go Live" flow
- Update PodcastStudio UI

---

## Architecture Summary

```
IVS Real-Time Stage (participants)
    ↓
IVS Compositions (one per participant → HLS)
    ↓
MediaLive URL_PULL Inputs (one per composition)
    ↓
MediaLive Audio Mixer + Video Switcher
    ↓
MediaLive Output → IVS Channel (streaming)
```

---

## Cost Per Hour (Host + 2 Callers)

- IVS Real-Time: $2.52
- IVS Compositions: $3.06
- MediaLive: $2.55
- **Total: $8.13/hour**

---

## Testing

```powershell
# Test MediaLive channel creation
$body = @{
  sessionId = "test-001"
  compositions = @(
    @{
      participantId = "host-123"
      hlsUrl = "https://shelcaster-compositions.s3.amazonaws.com/test-001/host-123/playlist.m3u8"
    }
  )
  ivsIngestEndpoint = "rtmps://xxxxx.global-contribute.live-video.net:443/app/"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/test-001/medialive" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

Ready for Phase 3?
