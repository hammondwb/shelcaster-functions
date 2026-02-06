$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"

Write-Host "`n=== Testing LiveSession Lambda Functions ===" -ForegroundColor Cyan

# Test 1: Create Session (Direct Lambda Invocation)
Write-Host "`n[Test 1] Testing shelcaster-create-session Lambda..." -ForegroundColor Yellow

# Create test payload - simpler approach
$payload = @'
{
  "body": "{\"showId\":\"test-show-123\",\"episodeId\":\"test-episode-456\"}",
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-789"
      }
    }
  }
}
'@

# Save payload to file
$payload | Out-File -FilePath "test-create-session-payload.json" -Encoding utf8 -NoNewline

Write-Host "Invoking shelcaster-create-session..." -ForegroundColor Gray
aws lambda invoke `
    --function-name shelcaster-create-session `
    --payload file://test-create-session-payload.json `
    --profile $PROFILE `
    --region $REGION `
    create-session-response.json

Write-Host "`nResponse:" -ForegroundColor Green
Get-Content create-session-response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Extract sessionId from response
$response = Get-Content create-session-response.json | ConvertFrom-Json
$sessionId = $null
if ($response.body) {
    $bodyObj = $response.body | ConvertFrom-Json
    $sessionId = $bodyObj.session.sessionId
    Write-Host "`nCreated Session ID: $sessionId" -ForegroundColor Cyan
}

# Test 2: Send SWITCH_SOURCE Command
if ($sessionId) {
    Write-Host "`n[Test 2] Testing shelcaster-session-command Lambda (SWITCH_SOURCE)..." -ForegroundColor Yellow

    $commandPayload = @"
{
  "body": "{\"action\":\"SWITCH_SOURCE\",\"sourceId\":\"caller:test-participant-123\"}",
  "pathParameters": {
    "sessionId": "$sessionId"
  },
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-789"
      }
    }
  }
}
"@

    $commandPayload | Out-File -FilePath "test-command-payload.json" -Encoding utf8 -NoNewline
    
    Write-Host "Invoking shelcaster-session-command..." -ForegroundColor Gray
    aws lambda invoke `
        --function-name shelcaster-session-command `
        --payload file://test-command-payload.json `
        --profile $PROFILE `
        --region $REGION `
        command-response.json
    
    Write-Host "`nResponse:" -ForegroundColor Green
    Get-Content command-response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
    
    # Test 3: Idempotency - Send same command again
    Write-Host "`n[Test 3] Testing idempotency (same command again)..." -ForegroundColor Yellow
    
    aws lambda invoke `
        --function-name shelcaster-session-command `
        --payload file://test-command-payload.json `
        --profile $PROFILE `
        --region $REGION `
        command-response-2.json
    
    Write-Host "`nResponse:" -ForegroundColor Green
    Get-Content command-response-2.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
    
    # Test 4: Invalid sourceId format
    Write-Host "`n[Test 4] Testing invalid sourceId format..." -ForegroundColor Yellow

    $invalidCommandPayload = @"
{
  "body": "{\"action\":\"SWITCH_SOURCE\",\"sourceId\":\"invalid-format\"}",
  "pathParameters": {
    "sessionId": "$sessionId"
  },
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-789"
      }
    }
  }
}
"@

    $invalidCommandPayload | Out-File -FilePath "test-invalid-payload.json" -Encoding utf8 -NoNewline
    
    aws lambda invoke `
        --function-name shelcaster-session-command `
        --payload file://test-invalid-payload.json `
        --profile $PROFILE `
        --region $REGION `
        invalid-response.json
    
    Write-Host "`nResponse:" -ForegroundColor Green
    Get-Content invalid-response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
}

Write-Host "`n=== Tests Complete ===" -ForegroundColor Cyan
Write-Host "Cleaning up test files..." -ForegroundColor Gray
Remove-Item test-*.json -ErrorAction SilentlyContinue
Remove-Item *-response*.json -ErrorAction SilentlyContinue

Write-Host "Done!" -ForegroundColor Green

