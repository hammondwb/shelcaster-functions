# Monitor LiveSessions in DynamoDB
# This script polls DynamoDB and shows the latest session

$REGION = "us-east-1"
$PROFILE = "shelcaster-admin"

Write-Host "=== MONITORING LIVESESSIONS ===" -ForegroundColor Cyan
Write-Host "Polling DynamoDB every 5 seconds..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

$lastSessionId = $null

while ($true) {
    # Get the most recent session
    $result = aws dynamodb scan `
        --table-name shelcaster-app `
        --filter-expression "entityType = :type" `
        --expression-attribute-values '{\":type\":{\"S\":\"liveSession\"}}' `
        --region $REGION `
        --profile $PROFILE `
        --query 'Items | sort_by(@, &createdAt.S) | [-1]' `
        --output json 2>$null | ConvertFrom-Json

    if ($result) {
        $sessionId = $result.sessionId.S
        $createdAt = $result.createdAt.S
        $rawStageArn = $result.ivs.M.rawStageArn.S
        $programStageArn = $result.ivs.M.programStageArn.S
        $programChannelArn = $result.ivs.M.programChannelArn.S
        $activeVideoSource = $result.programState.M.activeVideoSource.S

        # Only show if it's a new session
        if ($sessionId -ne $lastSessionId) {
            Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] NEW SESSION DETECTED!" -ForegroundColor Green
            Write-Host "  Session ID: $sessionId" -ForegroundColor White
            Write-Host "  Created At: $createdAt" -ForegroundColor Gray
            Write-Host "  RAW Stage ARN: $rawStageArn" -ForegroundColor $(if ($rawStageArn) { "Green" } else { "Red" })
            Write-Host "  PROGRAM Stage ARN: $programStageArn" -ForegroundColor $(if ($programStageArn) { "Green" } else { "Red" })
            Write-Host "  PROGRAM Channel ARN: $programChannelArn" -ForegroundColor $(if ($programChannelArn) { "Green" } else { "Red" })
            Write-Host "  Active Video Source: $activeVideoSource" -ForegroundColor Cyan
            Write-Host ""
            
            $lastSessionId = $sessionId
        }
    }

    Start-Sleep -Seconds 5
}

