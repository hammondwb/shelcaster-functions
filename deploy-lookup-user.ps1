# Deploy shelcaster-lookup-user-by-email Lambda function

$ErrorActionPreference = "Stop"

$FUNCTION_NAME = "shelcaster-lookup-user-by-email"
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"
$USER_POOL_ID = "us-east-1_VYdYII5Yw"  # Update if different

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying $FUNCTION_NAME" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to function directory
Set-Location $FUNCTION_NAME

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Create deployment package
Write-Host "Creating deployment package..." -ForegroundColor Yellow
if (Test-Path function.zip) {
    Remove-Item function.zip
}
Compress-Archive -Path * -DestinationPath function.zip

# Check if function exists
Write-Host "Checking if function exists..." -ForegroundColor Yellow
$functionExists = $false
try {
    aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>$null | Out-Null
    $functionExists = $true
    Write-Host "Function exists, updating..." -ForegroundColor Green
} catch {
    Write-Host "Function does not exist, creating..." -ForegroundColor Green
}

if ($functionExists) {
    # Update existing function
    Write-Host "Updating function code..." -ForegroundColor Yellow
    aws lambda update-function-code `
        --function-name $FUNCTION_NAME `
        --zip-file fileb://function.zip `
        --region $REGION
    
    Write-Host "Updating function configuration..." -ForegroundColor Yellow
    aws lambda update-function-configuration `
        --function-name $FUNCTION_NAME `
        --environment "Variables={USER_POOL_ID=$USER_POOL_ID}" `
        --timeout 30 `
        --memory-size 256 `
        --region $REGION
} else {
    # Create new function
    Write-Host "Creating function..." -ForegroundColor Yellow
    aws lambda create-function `
        --function-name $FUNCTION_NAME `
        --runtime nodejs20.x `
        --role $ROLE_ARN `
        --handler index.handler `
        --zip-file fileb://function.zip `
        --timeout 30 `
        --memory-size 256 `
        --environment "Variables={USER_POOL_ID=$USER_POOL_ID}" `
        --region $REGION
}

# Return to parent directory
Set-Location ..

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Add API Gateway route:" -ForegroundColor Gray
Write-Host "   GET /admin/users/lookup" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test the function:" -ForegroundColor Gray
Write-Host "   Invoke-RestMethod -Uri 'https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/admin/users/lookup?email=test@example.com' -Method Get" -ForegroundColor Gray
