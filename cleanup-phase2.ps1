# Cleanup Phase 2 Test Resources

Write-Host "Cleaning up Phase 2 test resources" -ForegroundColor Cyan

# List all MediaLive channels
Write-Host "`nFinding MediaLive channels..." -ForegroundColor Yellow

$channels = aws medialive list-channels `
  --profile shelcaster-admin `
  --region us-east-1 `
  --output json | ConvertFrom-Json

$testChannels = $channels.Channels | Where-Object { $_.Name -like "shelcaster-test-*" }

if ($testChannels.Count -eq 0) {
    Write-Host "No test channels found" -ForegroundColor Green
} else {
    foreach ($channel in $testChannels) {
        Write-Host "`nCleaning up channel: $($channel.Name)" -ForegroundColor Yellow
        
        # Stop channel
        try {
            aws medialive stop-channel `
              --channel-id $channel.Id `
              --profile shelcaster-admin `
              --region us-east-1 2>$null
            
            Write-Host "  Stopped channel $($channel.Id)" -ForegroundColor Green
            
            # Wait for channel to stop
            Start-Sleep -Seconds 5
            
            # Delete channel
            aws medialive delete-channel `
              --channel-id $channel.Id `
              --profile shelcaster-admin `
              --region us-east-1 2>$null
            
            Write-Host "  Deleted channel $($channel.Id)" -ForegroundColor Green
        } catch {
            Write-Host "  Error cleaning up $($channel.Id): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`n✅ Cleanup complete!" -ForegroundColor Green
