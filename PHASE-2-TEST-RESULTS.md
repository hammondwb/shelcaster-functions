# Phase 2 Test Results

## Test Status: ⚠️ Partially Successful

### What Works ✅
1. Lambda function deploys successfully
2. API Gateway route configured correctly
3. MediaLive channel creation API validates inputs
4. RTMP destination formatting correct
5. HLS input settings configured

### What Needs Real Data ❌
MediaLive requires **LIVE HLS streams** (not VOD) for multiple input switching.

Test used public VOD HLS stream which MediaLive rejects for multi-input channels.

### Error Message:
```
VOD HLS inputs (ie. those with bufferSegments unspecified or greater than 10) 
are not permitted for Channel Schedule input switch actions and therefore 
can not be attached to a channel with multiple inputs
```

---

## How to Test with Real Data

### Prerequisites:
1. Join IVS Real-Time stage (creates participants)
2. Create IVS compositions (Phase 1) - outputs LIVE HLS
3. Use composition HLS URLs (not test URLs)

### Test Flow:
```powershell
# 1. Join stage in browser (http://localhost:5173/podcast)
# 2. Get session ID from browser console
# 3. Create compositions
$SESSION_ID = "your-session-id"

$compBody = @{
  sessionId = $SESSION_ID
  stageArn = "arn:aws:ivs:..."
  participants = @(
    @{ participantId = "host-participant-id" }
  )
} | ConvertTo-Json

$compositions = Invoke-RestMethod `
  -Uri "https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/$SESSION_ID/compositions" `
  -Method POST `
  -Body $compBody `
  -ContentType "application/json"

# 4. Create MediaLive channel
$mlBody = @{
  sessionId = $SESSION_ID
  compositions = $compositions.compositions
  ivsIngestEndpoint = "your-ivs-ingest-endpoint"
} | ConvertTo-Json -Depth 10

$medialive = Invoke-RestMethod `
  -Uri "https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/$SESSION_ID/medialive" `
  -Method POST `
  -Body $mlBody `
  -ContentType "application/json"

# 5. Start MediaLive channel
aws medialive start-channel `
  --channel-id $medialive.channelId `
  --profile shelcaster-admin `
  --region us-east-1
```

---

## Phase 2 Implementation Status

### ✅ Complete:
- Lambda function created
- API Gateway route added
- MediaLive channel configuration
- Input attachment handling
- HLS input settings
- RTMP destination formatting
- DynamoDB integration

### ⏳ Pending:
- End-to-end test with real IVS compositions
- Integration with "Go Live" button
- Error handling improvements

---

## Next Steps

**Option 1:** Wire up "Go Live" button to test full flow
**Option 2:** Continue to Phase 3 (Source Switching)
**Option 3:** Test manually with real stage/compositions

**Recommendation:** Wire up "Go Live" button to test Phases 1+2 together.
