# Shelcaster Virtual Participant Deployment Script
$ErrorActionPreference = "Continue"
$PROFILE_NAME = "shelcaster-admin"
$REGION = "us-east-1"
$ACCOUNT_ID = "124355640062"

Write-Host "=== Shelcaster Virtual Participant Deployment ===" -ForegroundColor Cyan
Write-Host "Using existing shelcaster-app DynamoDB table" -ForegroundColor Cyan

# Step 1: Deploy Lambda - Invite VP
Write-Host "`n[1/4] Deploying invite Lambda..." -ForegroundColor Yellow

Set-Location shelcaster-invite-virtual-participant
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
npm install --production

if (Test-Path ../shelcaster-invite-vp.zip) { Remove-Item ../shelcaster-invite-vp.zip }
Compress-Archive -Path * -DestinationPath ../shelcaster-invite-vp.zip
Set-Location ..

$createResult = aws lambda create-function `
    --function-name shelcaster-invite-virtual-participant `
    --runtime nodejs20.x `
    --role "arn:aws:iam::${ACCOUNT_ID}:role/lambda-dynamodb-role" `
    --handler index.handler `
    --zip-file fileb://shelcaster-invite-vp.zip `
    --timeout 30 `
    --memory-size 256 `
    --profile $PROFILE_NAME `
    --region $REGION 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Function exists, updating..." -ForegroundColor Yellow
    aws lambda update-function-code `
        --function-name shelcaster-invite-virtual-participant `
        --zip-file fileb://shelcaster-invite-vp.zip `
        --profile $PROFILE_NAME `
        --region $REGION

    Write-Host "✓ Invite Lambda updated" -ForegroundColor Green
} else {
    Write-Host "✓ Invite Lambda created" -ForegroundColor Green
}

# Step 2: Deploy Lambda - Control VP
Write-Host "`n[2/4] Deploying control Lambda..." -ForegroundColor Yellow

Set-Location shelcaster-control-virtual-participant
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
npm install --production

if (Test-Path ../shelcaster-control-vp.zip) { Remove-Item ../shelcaster-control-vp.zip }
Compress-Archive -Path * -DestinationPath ../shelcaster-control-vp.zip
Set-Location ..

$createResult = aws lambda create-function `
    --function-name shelcaster-control-virtual-participant `
    --runtime nodejs20.x `
    --role "arn:aws:iam::${ACCOUNT_ID}:role/lambda-dynamodb-role" `
    --handler index.handler `
    --zip-file fileb://shelcaster-control-vp.zip `
    --timeout 30 `
    --memory-size 256 `
    --profile $PROFILE_NAME `
    --region $REGION 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Function exists, updating..." -ForegroundColor Yellow
    aws lambda update-function-code `
        --function-name shelcaster-control-virtual-participant `
        --zip-file fileb://shelcaster-control-vp.zip `
        --profile $PROFILE_NAME `
        --region $REGION

    Write-Host "✓ Control Lambda updated" -ForegroundColor Green
} else {
    Write-Host "✓ Control Lambda created" -ForegroundColor Green
}

# Step 3: Add API Gateway routes
Write-Host "`n[3/4] Adding API Gateway routes..." -ForegroundColor Yellow
Write-Host "Manual step required - see output below" -ForegroundColor Yellow

# Step 4: Update IAM permissions
Write-Host "`n[4/4] Updating IAM permissions..." -ForegroundColor Yellow
Write-Host "Manual step required - see output below" -ForegroundColor Yellow

Write-Host "`n=== Deployment Complete! ===" -ForegroundColor Green
Write-Host "`nNext manual steps:" -ForegroundColor Cyan
Write-Host "1. Add API Gateway routes (see DEPLOYMENT-CHECKLIST.md)"
Write-Host "2. Update IAM permissions (see DEPLOYMENT-CHECKLIST.md)"
Write-Host "3. Test from frontend"

