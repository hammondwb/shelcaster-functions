# Deploy Persistent IVS Channels Lambda Functions
# This script deploys all Lambda functions for the persistent channels feature

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying Persistent Channels Lambdas" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$functions = @(
    "shelcaster-create-persistent-channel",
    "shelcaster-assign-channel",
    "shelcaster-unassign-channel",
    "shelcaster-get-host-channel",
    "shelcaster-list-channels",
    "shelcaster-get-channel-stats",
    "shelcaster-get-channel-capacity",
    "shelcaster-update-channel-state"
)

$successCount = 0
$failCount = 0

foreach ($functionName in $functions) {
    Write-Host "Deploying $functionName..." -ForegroundColor Yellow
    
    try {
        # Create zip file
        $zipFile = "$functionName.zip"
        if (Test-Path $zipFile) {
            Remove-Item $zipFile
        }
        
        Compress-Archive -Path "$functionName\index.mjs" -DestinationPath $zipFile
        
        # Update Lambda function code
        aws lambda update-function-code `
            --function-name $functionName `
            --zip-file "fileb://$zipFile" `
            --region us-east-1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $functionName deployed successfully" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "✗ Failed to deploy $functionName" -ForegroundColor Red
            $failCount++
        }
        
        # Clean up zip file
        Remove-Item $zipFile
        
    } catch {
        Write-Host "✗ Error deploying $functionName : $_" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "All functions deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "Some functions failed to deploy. Check the output above." -ForegroundColor Yellow
}
