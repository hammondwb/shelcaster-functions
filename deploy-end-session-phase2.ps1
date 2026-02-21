# Deploy shelcaster-end-session Lambda (Phase 2 - Persistent Channels)
# This script deploys the modified end-session Lambda that preserves persistent channels

Write-Host "Deploying shelcaster-end-session Lambda (Phase 2)..." -ForegroundColor Cyan

# Change to function directory
Set-Location shelcaster-end-session

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Create deployment package
Write-Host "Creating deployment package..." -ForegroundColor Yellow
if (Test-Path "function.zip") {
    Remove-Item "function.zip"
}
Compress-Archive -Path * -DestinationPath function.zip

# Update Lambda function
Write-Host "Updating Lambda function code..." -ForegroundColor Yellow
aws lambda update-function-code `
    --function-name shelcaster-end-session `
    --zip-file fileb://function.zip `
    --region us-east-1

# Wait for update to complete
Write-Host "Waiting for function update to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Update function configuration (ensure correct role)
Write-Host "Updating function configuration..." -ForegroundColor Yellow
aws lambda update-function-configuration `
    --function-name shelcaster-end-session `
    --role arn:aws:iam::124355640062:role/lambda-dynamodb-role `
    --timeout 60 `
    --memory-size 512 `
    --region us-east-1

Write-Host "shelcaster-end-session deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Changes in Phase 2:" -ForegroundColor Cyan
Write-Host "  - Updates persistent channel state to IDLE" -ForegroundColor White
Write-Host "  - Deletes relay channel" -ForegroundColor White
Write-Host "  - Updates channel statistics" -ForegroundColor White
Write-Host "  - Clears currentSessionId from channel record" -ForegroundColor White
Write-Host "  - Calculates streaming duration" -ForegroundColor White
Write-Host ""
Write-Host "Cleanup results include:" -ForegroundColor Cyan
Write-Host "  - persistentChannel: State update to IDLE" -ForegroundColor White
Write-Host "  - relayChannel: Deletion of temporary channel" -ForegroundColor White

# Return to parent directory
Set-Location ..
