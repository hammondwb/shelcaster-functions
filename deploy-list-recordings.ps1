# Deploy shelcaster-list-recordings Lambda function
$FUNCTION_NAME = "shelcaster-list-recordings"
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::124355640062:role/shelcaster-lambda-role"

Write-Host "Deploying $FUNCTION_NAME Lambda function..." -ForegroundColor Cyan

# Create deployment package
Write-Host "Creating deployment package..." -ForegroundColor Yellow
Set-Location $FUNCTION_NAME
if (Test-Path "function.zip") {
    Remove-Item "function.zip"
}
Compress-Archive -Path "index.mjs" -DestinationPath "function.zip"

# Check if function exists
$functionExists = $false
try {
    aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>$null
    $functionExists = $true
    Write-Host "Function exists, updating..." -ForegroundColor Yellow
} catch {
    Write-Host "Function does not exist, creating..." -ForegroundColor Yellow
}

if ($functionExists) {
    # Update existing function
    aws lambda update-function-code `
        --function-name $FUNCTION_NAME `
        --zip-file fileb://function.zip `
        --region $REGION
} else {
    # Create new function
    aws lambda create-function `
        --function-name $FUNCTION_NAME `
        --runtime nodejs20.x `
        --role $ROLE_ARN `
        --handler index.handler `
        --zip-file fileb://function.zip `
        --timeout 30 `
        --memory-size 256 `
        --region $REGION
}

# Clean up
Remove-Item "function.zip"
Set-Location ..

Write-Host "✓ Lambda function deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run add-list-recordings-route.ps1 to add API Gateway route" -ForegroundColor White
Write-Host "2. Ensure Lambda has S3 read permissions for shelcaster-media-manager bucket" -ForegroundColor White
