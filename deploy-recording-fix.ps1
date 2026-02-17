# Deploy Recording Fix
# Updates Lambda functions to use IVS Channel auto-recording instead of composition S3 recording

Write-Host "Deploying Recording Fix..." -ForegroundColor Cyan
Write-Host "This will update the following Lambda functions:" -ForegroundColor Yellow
Write-Host "  - shelcaster-create-session" -ForegroundColor White
Write-Host "  - shelcaster-start-composition" -ForegroundColor White
Write-Host "  - shelcaster-ivs-recording-processor" -ForegroundColor White
Write-Host ""

# 1. Deploy shelcaster-create-session
Write-Host "1. Deploying shelcaster-create-session..." -ForegroundColor Cyan
Push-Location shelcaster-create-session
if (Test-Path function.zip) { Remove-Item function.zip }
npm install --production
Compress-Archive -Path index.mjs,package.json,package-lock.json,node_modules -DestinationPath function.zip -Force
aws lambda update-function-code --function-name shelcaster-create-session --zip-file fileb://function.zip
if ($LASTEXITCODE -eq 0) {
    Write-Host "Success - shelcaster-create-session deployed" -ForegroundColor Green
} else {
    Write-Host "Failed to deploy shelcaster-create-session" -ForegroundColor Red
}
Pop-Location

# 2. Deploy shelcaster-start-composition
Write-Host "`n2. Deploying shelcaster-start-composition..." -ForegroundColor Cyan
Push-Location shelcaster-start-composition
if (Test-Path function.zip) { Remove-Item function.zip }
npm install --production
Compress-Archive -Path index.mjs,package.json,package-lock.json,node_modules -DestinationPath function.zip -Force
aws lambda update-function-code --function-name shelcaster-start-composition --zip-file fileb://function.zip
if ($LASTEXITCODE -eq 0) {
    Write-Host "Success - shelcaster-start-composition deployed" -ForegroundColor Green
} else {
    Write-Host "Failed to deploy shelcaster-start-composition" -ForegroundColor Red
}
Pop-Location

# 3. Deploy shelcaster-ivs-recording-processor
Write-Host "`n3. Deploying shelcaster-ivs-recording-processor..." -ForegroundColor Cyan
Push-Location shelcaster-ivs-recording-processor
if (Test-Path function.zip) { Remove-Item function.zip }
npm install --production
Compress-Archive -Path index.mjs,package.json,package-lock.json,node_modules -DestinationPath function.zip -Force
aws lambda update-function-code --function-name shelcaster-ivs-recording-processor --zip-file fileb://function.zip
if ($LASTEXITCODE -eq 0) {
    Write-Host "Success - shelcaster-ivs-recording-processor deployed" -ForegroundColor Green
} else {
    Write-Host "Failed to deploy shelcaster-ivs-recording-processor" -ForegroundColor Red
}
Pop-Location

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run setup-ivs-channel-recording.ps1 to create recording configuration" -ForegroundColor White
Write-Host "2. Update Lambda environment variable with RECORDING_CONFIGURATION_ARN" -ForegroundColor White
Write-Host "3. Test by starting a new broadcast" -ForegroundColor White
Write-Host ""
Write-Host "What changed:" -ForegroundColor Yellow
Write-Host "- Removed S3 destination from composition (was recording RAW stage grid)" -ForegroundColor Green
Write-Host "- Added auto-recording to PROGRAM channel (records composed output)" -ForegroundColor Green
Write-Host "- Updated recording processor to handle IVS Channel recordings" -ForegroundColor Green
Write-Host "- Recordings now capture the full broadcast with mixed view" -ForegroundColor Green
