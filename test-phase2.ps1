# Phase 2 Test Script

Write-Host "Testing Phase 2: MediaLive Channel Creation" -ForegroundColor Cyan

$API_BASE = "https://td0dn99gi2.execute-api.us-east-1.amazonaws.com"
$SESSION_ID = "test-phase2-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "`nSession ID: $SESSION_ID" -ForegroundColor Yellow

# Step 1: Get an existing IVS channel for testing
Write-Host "`n1. Getting IVS channel for testing..." -ForegroundColor Green

$ivsChannels = aws ivs list-channels --profile shelcaster-admin --region us-east-1 --output json | ConvertFrom-Json

if ($ivsChannels.channels.Count -eq 0) {
    Write-Host "No IVS channels found. Creating one..." -ForegroundColor Yellow
    
    $newChannel = aws ivs create-channel `
      --name "test-phase2-channel" `
      --profile shelcaster-admin `
      --region us-east-1 `
      --output json | ConvertFrom-Json
    
    $channelArn = $newChannel.channel.arn
    $ingestEndpoint = $newChannel.channel.ingestEndpoint
} else {
    $channelArn = $ivsChannels.channels[0].arn
    
    # Get full channel details
    $channelDetails = aws ivs get-channel `
      --arn $channelArn `
      --profile shelcaster-admin `
      --region us-east-1 `
      --output json | ConvertFrom-Json
    
    $ingestEndpoint = $channelDetails.channel.ingestEndpoint
}

Write-Host "Using IVS Channel: $channelArn" -ForegroundColor Yellow
Write-Host "Ingest Endpoint: $ingestEndpoint" -ForegroundColor Yellow

# Step 2: Create mock composition data (simulating Phase 1 output)
Write-Host "`n2. Creating mock composition data..." -ForegroundColor Green

$compositions = @(
    @{
        participantId = "host-123"
        compositionArn = "arn:aws:ivs:us-east-1:124355640062:composition/mock-host"
        hlsUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    },
    @{
        participantId = "caller-456"
        compositionArn = "arn:aws:ivs:us-east-1:124355640062:composition/mock-caller"
        hlsUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    }
)

Write-Host "Mock compositions created (using public test HLS stream)" -ForegroundColor Yellow

# Step 3: Call MediaLive creation API
Write-Host "`n3. Creating MediaLive channel..." -ForegroundColor Green

$body = @{
    sessionId = $SESSION_ID
    compositions = $compositions
    ivsIngestEndpoint = $ingestEndpoint
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod `
      -Uri "$API_BASE/sessions/$SESSION_ID/medialive" `
      -Method POST `
      -Body $body `
      -ContentType "application/json"
    
    Write-Host "`n✅ MediaLive channel created!" -ForegroundColor Green
    Write-Host "Channel ID: $($response.channelId)" -ForegroundColor Yellow
    Write-Host "Channel ARN: $($response.channelArn)" -ForegroundColor Yellow
    
    $channelId = $response.channelId
    
    # Step 4: Verify channel in AWS
    Write-Host "`n4. Verifying channel in AWS..." -ForegroundColor Green
    
    $channel = aws medialive describe-channel `
      --channel-id $channelId `
      --profile shelcaster-admin `
      --region us-east-1 `
      --output json | ConvertFrom-Json
    
    Write-Host "Channel State: $($channel.State)" -ForegroundColor Yellow
    Write-Host "Input Attachments: $($channel.InputAttachments.Count)" -ForegroundColor Yellow
    
    # Step 5: Start the channel
    Write-Host "`n5. Starting MediaLive channel..." -ForegroundColor Green
    
    aws medialive start-channel `
      --channel-id $channelId `
      --profile shelcaster-admin `
      --region us-east-1
    
    Write-Host "Channel starting... (this takes 30-60 seconds)" -ForegroundColor Yellow
    
    # Step 6: Check DynamoDB
    Write-Host "`n6. Checking DynamoDB session..." -ForegroundColor Green
    
    $dbItem = aws dynamodb get-item `
      --table-name shelcaster-app `
      --key "{`"pk`":{`"S`":`"session#$SESSION_ID`"},`"sk`":{`"S`":`"info`"}}" `
      --profile shelcaster-admin `
      --region us-east-1 `
      --output json | ConvertFrom-Json
    
    if ($dbItem.Item) {
        Write-Host "✅ Session found in DynamoDB" -ForegroundColor Green
        Write-Host "MediaLive Channel ID: $($dbItem.Item.mediaLive.M.channelId.S)" -ForegroundColor Yellow
    }
    
    Write-Host "`n✅ Phase 2 test complete!" -ForegroundColor Green
    Write-Host "`nCleanup:" -ForegroundColor Cyan
    Write-Host "To stop billing, run:" -ForegroundColor Yellow
    Write-Host "  aws medialive stop-channel --channel-id $channelId --profile shelcaster-admin --region us-east-1" -ForegroundColor White
    Write-Host "  aws medialive delete-channel --channel-id $channelId --profile shelcaster-admin --region us-east-1" -ForegroundColor White
    
} catch {
    Write-Host "`n❌ Error creating MediaLive channel" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nResponse:" -ForegroundColor Yellow
    Write-Host $_.ErrorDetails.Message -ForegroundColor White
}
