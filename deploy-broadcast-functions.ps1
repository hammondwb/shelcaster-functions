# Deploy Broadcast Studio Lambda Functions
# This script deploys all 16 new Lambda functions for the Broadcast Studio

$ErrorActionPreference = "Stop"
$profile = "shelcaster-admin"
$region = "us-east-1"
$role = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"
$runtime = "nodejs22.x"

# List of functions to deploy
$functions = @(
    "shelcaster-create-show",
    "shelcaster-get-show",
    "shelcaster-get-producer-shows",
    "shelcaster-update-show",
    "shelcaster-delete-show",
    "shelcaster-create-tracklist",
    "shelcaster-get-tracklist",
    "shelcaster-get-producer-tracklists",
    "shelcaster-get-tracklist-programs",
    "shelcaster-update-tracklist",
    "shelcaster-delete-tracklist",
    "shelcaster-start-broadcast",
    "shelcaster-stop-broadcast",
    "shelcaster-invite-guest",
    "shelcaster-get-show-guests",
    "shelcaster-update-guest-status"
)

Write-Host "Starting deployment of $($functions.Count) Lambda functions..." -ForegroundColor Green

foreach ($functionName in $functions) {
    Write-Host "`nProcessing: $functionName" -ForegroundColor Cyan
    
    # Create zip file
    $zipFile = "$functionName.zip"
    if (Test-Path $zipFile) {
        Remove-Item $zipFile -Force
    }
    
    Push-Location $functionName
    Compress-Archive -Path "index.mjs" -DestinationPath "../$zipFile" -Force
    Pop-Location
    
    Write-Host "  Created: $zipFile" -ForegroundColor Gray
    
    # Check if function exists
    $functionExists = $false
    try {
        aws lambda get-function --function-name $functionName --profile $profile --region $region 2>$null
        $functionExists = $true
        Write-Host "  Function exists - updating..." -ForegroundColor Yellow
    } catch {
        Write-Host "  Function does not exist - creating..." -ForegroundColor Yellow
    }
    
    if ($functionExists) {
        # Update existing function
        aws lambda update-function-code `
            --function-name $functionName `
            --zip-file "fileb://$zipFile" `
            --profile $profile `
            --region $region | Out-Null
        Write-Host "  Updated function code" -ForegroundColor Green
    } else {
        # Create new function
        aws lambda create-function `
            --function-name $functionName `
            --runtime $runtime `
            --role $role `
            --handler "index.handler" `
            --zip-file "fileb://$zipFile" `
            --profile $profile `
            --region $region `
            --timeout 30 `
            --memory-size 256 | Out-Null
        Write-Host "  Created new function" -ForegroundColor Green
    }
    
    # Clean up zip file
    Remove-Item $zipFile -Force
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "Deployed $($functions.Count) functions successfully" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

