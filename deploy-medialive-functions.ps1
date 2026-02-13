#!/usr/bin/env pwsh

# Deploy MediaLive Lambda Functions
# Run from shelcaster-functions directory

$ErrorActionPreference = "Stop"
$profile = "shelcaster-admin"
$region = "us-east-1"
$role = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"

Write-Host "Deploying MediaLive Lambda Functions..." -ForegroundColor Cyan

# Function to deploy a Lambda
function Deploy-Lambda {
    param(
        [string]$FunctionName,
        [string]$Handler = "index.handler"
    )
    
    Write-Host "`nDeploying $FunctionName..." -ForegroundColor Yellow
    
    Set-Location $FunctionName
    
    # Create deployment package
    if (Test-Path "function.zip") {
        Remove-Item "function.zip"
    }
    
    Compress-Archive -Path "index.mjs" -DestinationPath "function.zip"
    
    # Check if function exists
    $functionExists = $false
    try {
        aws lambda get-function --function-name $FunctionName --profile $profile --region $region 2>$null
        $functionExists = $true
    } catch {}
    
    if ($functionExists) {
        Write-Host "Updating existing function..." -ForegroundColor Gray
        aws lambda update-function-code `
            --function-name $FunctionName `
            --zip-file fileb://function.zip `
            --profile $profile `
            --region $region
    } else {
        Write-Host "Creating new function..." -ForegroundColor Gray
        aws lambda create-function `
            --function-name $FunctionName `
            --runtime nodejs22.x `
            --role $role `
            --handler $Handler `
            --zip-file fileb://function.zip `
            --timeout 30 `
            --memory-size 256 `
            --profile $profile `
            --region $region
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ $FunctionName deployed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to deploy $FunctionName" -ForegroundColor Red
        exit 1
    }
    
    Set-Location ..
}

# Deploy all functions
Deploy-Lambda "shelcaster-create-medialive-channel"
Deploy-Lambda "shelcaster-start-streaming"
Deploy-Lambda "shelcaster-stop-streaming"
Deploy-Lambda "shelcaster-start-recording"
Deploy-Lambda "shelcaster-stop-recording"

Write-Host "`n✓ All MediaLive functions deployed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Create API Gateway routes for these functions"
Write-Host "2. Update MediaLive IAM role ARN in shelcaster-create-medialive-channel"
Write-Host "3. Update Input Security Group ID in shelcaster-create-medialive-channel"
Write-Host "4. Test MediaLive channel creation"
