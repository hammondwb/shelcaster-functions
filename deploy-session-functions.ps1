$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"

Write-Host "Deploying LiveSession Lambda functions..." -ForegroundColor Cyan

# Function to create zip using tar (available in Windows 10+)
function Create-LambdaZip {
    param($FunctionDir, $IndexFile = "index.mjs")

    Push-Location $FunctionDir
    if (Test-Path function.zip) { Remove-Item function.zip }

    # Check if node_modules exists
    if (Test-Path node_modules) {
        # Use tar to create zip (works better than Compress-Archive)
        tar -a -c -f function.zip $IndexFile package.json node_modules
    } else {
        # No dependencies, just zip the index file and package.json
        tar -a -c -f function.zip $IndexFile package.json
    }

    Pop-Location
}

# Deploy shelcaster-create-session
Write-Host "`n[1/2] Deploying shelcaster-create-session..." -ForegroundColor Green
Write-Host "  Installing dependencies..." -ForegroundColor Cyan
Push-Location shelcaster-create-session
npm install --omit=dev
Pop-Location

Create-LambdaZip "shelcaster-create-session" "index.mjs"

$functionExists = aws lambda get-function --function-name shelcaster-create-session --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Updating existing function..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name shelcaster-create-session --zip-file fileb://shelcaster-create-session/function.zip --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
} else {
    Write-Host "  Creating new function..." -ForegroundColor Yellow
    aws lambda create-function --function-name shelcaster-create-session --runtime nodejs22.x --role $ROLE_ARN --handler index.handler --zip-file fileb://shelcaster-create-session/function.zip --timeout 30 --memory-size 256 --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
}
Remove-Item shelcaster-create-session/function.zip

# Deploy shelcaster-session-command
Write-Host "`n[2/2] Deploying shelcaster-session-command..." -ForegroundColor Green
Write-Host "  Installing dependencies..." -ForegroundColor Cyan
Push-Location shelcaster-session-command
npm install --omit=dev
Pop-Location

Create-LambdaZip "shelcaster-session-command" "index.mjs"

$functionExists = aws lambda get-function --function-name shelcaster-session-command --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Updating existing function..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name shelcaster-session-command --zip-file fileb://shelcaster-session-command/function.zip --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
} else {
    Write-Host "  Creating new function..." -ForegroundColor Yellow
    aws lambda create-function --function-name shelcaster-session-command --runtime nodejs22.x --role $ROLE_ARN --handler index.handler --zip-file fileb://shelcaster-session-command/function.zip --timeout 30 --memory-size 256 --environment "Variables={APPLY_IVS=0}" --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
}
Remove-Item shelcaster-session-command/function.zip

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Next: Run add-session-routes.ps1 to add API Gateway routes" -ForegroundColor Yellow

