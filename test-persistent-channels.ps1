# Test Persistent IVS Channels API
# This script tests all persistent channel endpoints

$ErrorActionPreference = "Stop"

$API_BASE_URL = "https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com"
$TEST_USER_ID = "test-user-$(Get-Random -Maximum 9999)"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Persistent Channels API" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "API Base URL: $API_BASE_URL" -ForegroundColor Gray
Write-Host "Test User ID: $TEST_USER_ID" -ForegroundColor Gray
Write-Host ""

# Store test data
$testChannelId = $null
$testChannelArn = $null

# Test 1: Get Channel Capacity
Write-Host "Test 1: Get Channel Capacity" -ForegroundColor Yellow
Write-Host "GET /admin/channels/capacity" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/channels/capacity" -Method Get
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  Current Channels: $($response.currentChannelCount)" -ForegroundColor Gray
    Write-Host "  Max Limit: $($response.maxChannelLimit)" -ForegroundColor Gray
    Write-Host "  Remaining: $($response.remainingCapacity)" -ForegroundColor Gray
    Write-Host "  Utilization: $($response.utilizationPercentage)%" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Create Persistent Channel
Write-Host "Test 2: Create Persistent Channel" -ForegroundColor Yellow
Write-Host "POST /admin/channels" -ForegroundColor Gray
try {
    $body = @{
        name = "Test Channel $(Get-Date -Format 'HHmmss')"
        recordingEnabled = $true
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/channels" -Method Post -Body $body -ContentType "application/json"
    $testChannelId = $response.channel.channelId
    $testChannelArn = $response.channel.channelArn
    
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  Channel ID: $testChannelId" -ForegroundColor Gray
    Write-Host "  Channel ARN: $testChannelArn" -ForegroundColor Gray
    Write-Host "  Playback URL: $($response.channel.playbackUrl)" -ForegroundColor Gray
    Write-Host "  State: $($response.channel.state)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
Write-Host ""

if (-not $testChannelId) {
    Write-Host "Cannot continue tests without a channel. Exiting." -ForegroundColor Red
    exit 1
}

# Test 3: List All Channels
Write-Host "Test 3: List All Channels" -ForegroundColor Yellow
Write-Host "GET /admin/channels" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/channels" -Method Get
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  Total Channels: $($response.count)" -ForegroundColor Gray
    if ($response.channels.Count -gt 0) {
        Write-Host "  First Channel: $($response.channels[0].channelName)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: List Channels by State (IDLE)
Write-Host "Test 4: List Channels by State (IDLE)" -ForegroundColor Yellow
Write-Host "GET /admin/channels?state=IDLE" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/channels?state=IDLE" -Method Get
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  IDLE Channels: $($response.count)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Get Channel Statistics
Write-Host "Test 5: Get Channel Statistics" -ForegroundColor Yellow
Write-Host "GET /admin/channels/$testChannelId/stats" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/channels/$testChannelId/stats" -Method Get
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  Total Broadcasts: $($response.totalBroadcasts)" -ForegroundColor Gray
    Write-Host "  Total Streaming Hours: $($response.totalStreamingHours)" -ForegroundColor Gray
    Write-Host "  Current State: $($response.currentState)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 6: Assign Channel to Host
Write-Host "Test 6: Assign Channel to Host" -ForegroundColor Yellow
Write-Host "POST /admin/channels/$testChannelId/assign" -ForegroundColor Gray
try {
    $body = @{
        hostUserId = $TEST_USER_ID
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/channels/$testChannelId/assign" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  Host User ID: $($response.assignment.hostUserId)" -ForegroundColor Gray
    Write-Host "  Channel ID: $($response.assignment.channelId)" -ForegroundColor Gray
    Write-Host "  Assigned At: $($response.assignment.assignedAt)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 7: Get Host's Assigned Channel
Write-Host "Test 7: Get Host's Assigned Channel" -ForegroundColor Yellow
Write-Host "GET /hosts/$TEST_USER_ID/channel" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/hosts/$TEST_USER_ID/channel" -Method Get
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  Channel ID: $($response.channelId)" -ForegroundColor Gray
    Write-Host "  Channel Name: $($response.channelName)" -ForegroundColor Gray
    Write-Host "  Playback URL: $($response.playbackUrl)" -ForegroundColor Gray
    Write-Host "  State: $($response.state)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 8: Update Channel State to LIVE
Write-Host "Test 8: Update Channel State to LIVE" -ForegroundColor Yellow
Write-Host "PUT /admin/channels/$testChannelId/state" -ForegroundColor Gray
try {
    $body = @{
        newState = "LIVE"
        sessionId = "test-session-123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/channels/$testChannelId/state" -Method Put -Body $body -ContentType "application/json"
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  New State: $($response.newState)" -ForegroundColor Gray
    Write-Host "  Session ID: $($response.sessionId)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 9: Update Channel State back to IDLE
Write-Host "Test 9: Update Channel State back to IDLE" -ForegroundColor Yellow
Write-Host "PUT /admin/channels/$testChannelId/state" -ForegroundColor Gray
try {
    $body = @{
        newState = "IDLE"
        sessionId = $null
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/channels/$testChannelId/state" -Method Put -Body $body -ContentType "application/json"
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  New State: $($response.newState)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 10: Unassign Channel from Host
Write-Host "Test 10: Unassign Channel from Host" -ForegroundColor Yellow
Write-Host "DELETE /admin/channels/$testChannelId/assign/$TEST_USER_ID" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/channels/$testChannelId/assign/$TEST_USER_ID" -Method Delete
    Write-Host "✓ Success" -ForegroundColor Green
    Write-Host "  Channel unassigned from host" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 11: Verify Host Has No Channel (should fail)
Write-Host "Test 11: Verify Host Has No Channel (should return 404)" -ForegroundColor Yellow
Write-Host "GET /hosts/$TEST_USER_ID/channel" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/hosts/$TEST_USER_ID/channel" -Method Get
    Write-Host "✗ Unexpected Success - should have returned 404" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✓ Success - Correctly returned 404" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed with unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Channel Created:" -ForegroundColor Yellow
Write-Host "  Channel ID: $testChannelId" -ForegroundColor Gray
Write-Host "  Channel ARN: $testChannelArn" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: The test channel was created but not deleted." -ForegroundColor Yellow
Write-Host "You can manually delete it from AWS IVS Console if needed." -ForegroundColor Yellow
