# Phase 2 Testing Guide: Session Integration with Persistent Channels

## Overview

Phase 2 modifies the session creation and cleanup Lambda functions to use persistent channels instead of creating temporary channels. This guide provides step-by-step testing procedures to validate the integration.

## Prerequisites

Before testing Phase 2, ensure:
- ✅ Phase 1 is complete (all channel management functions deployed)
- ✅ At least one test channel exists and is assigned to a host
- ✅ You have the test host's user ID and channel ID from Phase 1

## Deployment

### Step 1: Deploy Modified Lambda Functions

```powershell
# Deploy create-session Lambda
.\deploy-create-session-phase2.ps1

# Deploy end-session Lambda
.\deploy-end-session-phase2.ps1
```

### Step 2: Verify Deployments

```powershell
# Check create-session function
aws lambda get-function --function-name shelcaster-create-session --region us-east-1

# Check end-session function
aws lambda get-function --function-name shelcaster-end-session --region us-east-1
```

## Test Scenarios

### Test 1: Create Session with Assigned Channel (Happy Path)

**Purpose**: Verify that a host with an assigned channel can successfully create a broadcast session.

**Prerequisites**:
- Host has a persistent channel assigned (from Phase 1)
- Channel state is IDLE

**Steps**:

1. Get host's channel to verify it's IDLE:
```powershell
$hostUserId = "test-user-123"  # Replace with your test host ID

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/hosts/$hostUserId/channel" `
    --http-method GET `
    --region us-east-1 `
    response.json

Get-Content response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: Channel state is "IDLE"

2. Create a broadcast session:
```powershell
$showId = "test-show-123"  # Replace with a valid show ID
$body = @{
    showId = $showId
    episodeId = "test-episode-1"
} | ConvertTo-Json

# Note: You'll need a valid JWT token for the host user
$token = "YOUR_JWT_TOKEN_HERE"

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/sessions" `
    --http-method POST `
    --headers "Authorization=Bearer $token" `
    --body $body `
    --region us-east-1 `
    session-response.json

Get-Content session-response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Results**:
- ✅ Status code: 201
- ✅ Response includes `persistentChannel` object with:
  - `channelId`
  - `channelArn`
  - `playbackUrl` (static URL)
  - `ingestEndpoint`
- ✅ Session record includes:
  - `ivs.persistentChannelId`
  - `ivs.persistentChannelArn`
  - `ivs.persistentPlaybackUrl`
  - `ivs.relayChannelArn` (temporary relay channel)
  - `ivs.rawStageArn`
  - `ivs.programStageArn`

3. Verify channel state changed to LIVE:
```powershell
aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/hosts/$hostUserId/channel" `
    --http-method GET `
    --region us-east-1 `
    channel-state.json

Get-Content channel-state.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: Channel state is "LIVE", currentSessionId matches the session ID

4. Check CloudWatch logs:
```powershell
# Get recent logs for create-session
aws logs tail /aws/lambda/shelcaster-create-session --follow --region us-east-1
```

Look for:
- "Looking up persistent channel for host: {hostUserId}"
- "Found persistent channel: {channelId}"
- "Persistent channel state: IDLE"
- "Updating channel state to LIVE"
- "Channel state updated to LIVE"
- "Creating RAW stage..."
- "Creating PROGRAM stage..."
- "Creating RELAY channel for composition..."

### Test 2: End Session and Preserve Persistent Channel

**Purpose**: Verify that ending a session updates the channel to IDLE and preserves it (doesn't delete).

**Prerequisites**:
- Active session from Test 1

**Steps**:

1. End the broadcast session:
```powershell
$sessionId = "SESSION_ID_FROM_TEST_1"  # Get from Test 1 response

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/sessions/$sessionId" `
    --http-method DELETE `
    --headers "Authorization=Bearer $token" `
    --region us-east-1 `
    end-response.json

Get-Content end-response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Results**:
- ✅ Status code: 200
- ✅ Response includes `cleanupResults` with:
  - `persistentChannel.attempted: true`
  - `persistentChannel.success: true`
  - `relayChannel.attempted: true`
  - `relayChannel.success: true`
  - `rawStage.attempted: true`
  - `rawStage.success: true`
  - `programStage.attempted: true`
  - `programStage.success: true`

2. Verify channel state changed back to IDLE:
```powershell
aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/hosts/$hostUserId/channel" `
    --http-method GET `
    --region us-east-1 `
    channel-after-end.json

Get-Content channel-after-end.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected:
- Channel state is "IDLE"
- currentSessionId is null
- Channel still exists (not deleted)

3. Verify channel statistics were updated:
```powershell
$channelId = "CHANNEL_ID_FROM_PHASE_1"

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/admin/channels/$channelId/stats" `
    --http-method GET `
    --region us-east-1 `
    stats.json

Get-Content stats.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected:
- `totalBroadcasts` increased by 1
- `totalStreamingMinutes` increased (if streaming was started)
- `lastBroadcastAt` updated to recent timestamp

4. Check CloudWatch logs:
```powershell
# Get recent logs for end-session
aws logs tail /aws/lambda/shelcaster-end-session --follow --region us-east-1
```

Look for:
- "[END SESSION] Starting cleanup for session: {sessionId}"
- "[END SESSION] Deleting relay IVS channel: {relayChannelArn}"
- "[END SESSION] ✓ Successfully deleted relay channel"
- "[END SESSION] Updating persistent channel {channelId} state to IDLE"
- "[END SESSION] ✓ Persistent channel {channelId} updated to IDLE (preserved for reuse)"
- "[END SESSION] ✓ Channel stats updated: +1 broadcast, +X minutes"

### Test 3: Create Second Session with Same Channel (Reuse)

**Purpose**: Verify that the same persistent channel can be reused for multiple broadcasts.

**Prerequisites**:
- Completed Test 1 and Test 2
- Channel is back to IDLE state

**Steps**:

1. Create another session with the same host:
```powershell
$body = @{
    showId = $showId
    episodeId = "test-episode-2"
} | ConvertTo-Json

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/sessions" `
    --http-method POST `
    --headers "Authorization=Bearer $token" `
    --body $body `
    --region us-east-1 `
    session2-response.json

Get-Content session2-response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Results**:
- ✅ Status code: 201
- ✅ Same `persistentChannel.channelId` as Test 1
- ✅ Same `persistentChannel.playbackUrl` as Test 1 (static URL preserved)
- ✅ Different `sessionId` (new session)
- ✅ Different `ivs.relayChannelArn` (new temporary relay channel)

2. Verify playback URL is unchanged:
```powershell
# Compare playback URLs from Test 1 and Test 3
$url1 = (Get-Content session-response.json | ConvertFrom-Json).persistentChannel.playbackUrl
$url2 = (Get-Content session2-response.json | ConvertFrom-Json).persistentChannel.playbackUrl

if ($url1 -eq $url2) {
    Write-Host "✓ Playback URL is static and unchanged!" -ForegroundColor Green
} else {
    Write-Host "✗ Playback URL changed (unexpected)" -ForegroundColor Red
}
```

### Test 4: Attempt to Create Session Without Assigned Channel

**Purpose**: Verify that hosts without assigned channels are rejected with proper error message.

**Prerequisites**:
- A host user ID that does NOT have a channel assigned

**Steps**:

1. Attempt to create session:
```powershell
$unassignedHostUserId = "unassigned-host-123"
$token = "JWT_TOKEN_FOR_UNASSIGNED_HOST"

$body = @{
    showId = $showId
} | ConvertTo-Json

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/sessions" `
    --http-method POST `
    --headers "Authorization=Bearer $token" `
    --body $body `
    --region us-east-1 `
    error-response.json

Get-Content error-response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Results**:
- ✅ Status code: 403 Forbidden
- ✅ Error message: "No channel assigned to your account. Please contact support."
- ✅ Response includes `hostUserId`

### Test 5: Attempt Concurrent Broadcast on Same Channel

**Purpose**: Verify that attempting to start a second broadcast while channel is LIVE is rejected.

**Prerequisites**:
- Active session from Test 3 (channel is LIVE)

**Steps**:

1. Attempt to create another session with same host:
```powershell
$body = @{
    showId = $showId
    episodeId = "test-episode-3"
} | ConvertTo-Json

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/sessions" `
    --http-method POST `
    --headers "Authorization=Bearer $token" `
    --body $body `
    --region us-east-1 `
    conflict-response.json

Get-Content conflict-response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Results**:
- ✅ Status code: 409 Conflict
- ✅ Error message: "Channel is currently in use. Please try again later."
- ✅ Response includes `channelId` and `currentSessionId`

2. End the active session:
```powershell
$sessionId = "SESSION_ID_FROM_TEST_3"

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/sessions/$sessionId" `
    --http-method DELETE `
    --headers "Authorization=Bearer $token" `
    --region us-east-1 `
    cleanup.json
```

### Test 6: Verify Relay Channel Deletion

**Purpose**: Verify that temporary relay channels are deleted while persistent channels are preserved.

**Prerequisites**:
- Completed Test 5 (session ended)

**Steps**:

1. Check AWS IVS Console or use AWS CLI to list channels:
```powershell
aws ivs list-channels --region us-east-1 | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Results**:
- ✅ Persistent channel still exists (from Phase 1)
- ✅ Relay channels from previous sessions are deleted
- ✅ No channels with names like "shelcaster-relay-{sessionId}" remain

2. Verify in DynamoDB:
```powershell
# Check channel record
aws dynamodb get-item `
    --table-name shelcaster-app `
    --key "{\"pk\": {\"S\": \"channel#$channelId\"}, \"sk\": {\"S\": \"info\"}}" `
    --region us-east-1 | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected:
- Channel record exists
- State is "IDLE"
- currentSessionId is null

## Validation Checklist

After completing all tests, verify:

- [ ] Host with assigned channel can create sessions
- [ ] Channel state transitions: IDLE → LIVE → IDLE
- [ ] Persistent channel is preserved after session ends
- [ ] Relay channel is deleted after session ends
- [ ] Same playback URL is used across multiple sessions
- [ ] Channel statistics are updated correctly
- [ ] Hosts without assigned channels are rejected (403)
- [ ] Concurrent broadcasts on same channel are rejected (409)
- [ ] CloudWatch logs show correct flow
- [ ] No orphaned relay channels remain in AWS IVS

## Troubleshooting

### Issue: "No channel assigned to your account"

**Cause**: Host doesn't have a channel assignment in DynamoDB

**Solution**:
```powershell
# Assign a channel to the host
$body = @{
    hostUserId = $hostUserId
} | ConvertTo-Json

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/admin/channels/$channelId/assign" `
    --http-method POST `
    --body $body `
    --region us-east-1 `
    assign.json
```

### Issue: "Channel is currently in use"

**Cause**: Channel state is LIVE from a previous session that didn't end properly

**Solution**:
```powershell
# Manually update channel state to IDLE
$body = @{
    newState = "IDLE"
    sessionId = $null
} | ConvertTo-Json

aws apigatewayv2 invoke-api `
    --api-id td0dn99gi2 `
    --stage prod `
    --path "/admin/channels/$channelId/state" `
    --http-method PUT `
    --body $body `
    --region us-east-1 `
    reset.json
```

### Issue: Relay channel not deleted

**Cause**: AWS IVS API call failed during cleanup

**Solution**:
- Check CloudWatch logs for error details
- Manually delete orphaned relay channels in AWS IVS Console
- Verify Lambda has correct IAM permissions for IVS DeleteChannel

### Issue: Channel statistics not updating

**Cause**: session.streaming.startedAt is null or missing

**Solution**:
- Ensure streaming is started before ending session
- Check session record in DynamoDB for streaming.startedAt field
- Verify end-session Lambda has correct calculation logic

## Next Steps

After Phase 2 testing is complete:

1. **Phase 3**: Implement Program Manager Group Editor UI
2. **Phase 4**: Implement Vista Stream channel approval UI
3. **Phase 5**: End-to-end testing with real broadcasts

## Notes

- Phase 2 maintains backward compatibility with legacy sessions (no persistent channel)
- Relay channels are still created for composition output (temporary)
- Persistent channels have static playback URLs that work across all broadcasts
- Channel statistics accumulate across multiple broadcasts
