# Deploy shelcaster-create-session Lambda (Phase 2 - Persistent Channels)
# This script deploys the modified create-session Lambda that uses persistent channels

Write-Host "Deploying shelcaster-create-session Lambda (Phase 2)..." -ForegroundColor Cyan

# Change to function directory
Set-Location shelcaster-create-session

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
    --function-name shelcaster-create-session `
    --zip-file fileb://function.zip `
    --region us-east-1

# Wait for update to complete
Write-Host "Waiting for function update to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Update function configuration (ensure correct role)
Write-Host "Updating function configuration..." -ForegroundColor Yellow
aws lambda update-function-configuration `
    --function-name shelcaster-create-session `
    --role arn:aws:iam::124355640062:role/lambda-dynamodb-role `
    --timeout 30 `
    --memory-size 512 `
    --region us-east-1

Write-Host "shelcaster-create-session deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Changes in Phase 2:" -ForegroundColor Cyan
Write-Host "  - Looks up host persistent channel before creating session" -ForegroundColor White
Write-Host "  - Validates channel is assigned and available" -ForegroundColor White
Write-Host "  - Updates channel state to LIVE when session starts" -ForegroundColor White
Write-Host "  - Creates relay channel instead of program channel" -ForegroundColor White
Write-Host "  - Stores persistent channel info in session record" -ForegroundColor White
Write-Host ""
Write-Host "Error responses:" -ForegroundColor Cyan
Write-Host "  - 403: No channel assigned to host" -ForegroundColor White
Write-Host "  - 409: Channel already in use" -ForegroundColor White
Write-Host "  - 503: Channel temporarily unavailable" -ForegroundColor White

# Return to parent directory
Set-Location ..
