# Setup IVS Channel Recording Configuration
# This enables auto-recording for IVS channels to capture the full broadcast

$RECORDING_CONFIG_NAME = "shelcaster-channel-recording"
$S3_BUCKET = "shelcaster-media-manager"
$RECORDING_PREFIX = "ivs-channel-recordings/"

Write-Host "Setting up IVS Channel Recording Configuration..." -ForegroundColor Cyan

# Check if recording configuration already exists
Write-Host "`nChecking for existing recording configuration..." -ForegroundColor Yellow
$existingConfigs = aws ivs list-recording-configurations --query "recordingConfigurations[?name=='$RECORDING_CONFIG_NAME'].arn" --output text

if ($existingConfigs) {
    Write-Host "Recording configuration already exists: $existingConfigs" -ForegroundColor Green
    Write-Host "`nTo use this configuration, set the environment variable:" -ForegroundColor Cyan
    Write-Host "RECORDING_CONFIGURATION_ARN=$existingConfigs" -ForegroundColor White
    exit 0
}

# Create recording configuration
Write-Host "`nCreating IVS recording configuration..." -ForegroundColor Yellow
$recordingConfig = aws ivs create-recording-configuration `
    --name $RECORDING_CONFIG_NAME `
    --destination-configuration file://recording-dest-config.json `
    --recording-reconnect-window-seconds 60 `
    --query "recordingConfiguration.arn" `
    --output text

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success - Recording configuration created: $recordingConfig" -ForegroundColor Green
    
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Update Lambda environment variable:" -ForegroundColor White
    Write-Host "   RECORDING_CONFIGURATION_ARN=$recordingConfig" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Update shelcaster-create-session Lambda:" -ForegroundColor White
    Write-Host "   aws lambda update-function-configuration --function-name shelcaster-create-session --environment Variables={RECORDING_CONFIGURATION_ARN=$recordingConfig}" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Recordings will be saved to:" -ForegroundColor White
    Write-Host "   s3://$S3_BUCKET/ivs-channel-recordings/" -ForegroundColor Gray
} else {
    Write-Host "Failed to create recording configuration" -ForegroundColor Red
    exit 1
}
