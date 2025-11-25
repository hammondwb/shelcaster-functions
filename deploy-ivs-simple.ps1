$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"

Write-Host "Deploying IVS Lambda functions..." -ForegroundColor Cyan

# Function to create zip using tar (available in Windows 10+)
function Create-LambdaZip {
    param($FunctionDir, $IndexFile = "index.js")

    Push-Location $FunctionDir
    if (Test-Path function.zip) { Remove-Item function.zip }

    # Use tar to create zip (works better than Compress-Archive)
    tar -a -c -f function.zip $IndexFile package.json node_modules

    Pop-Location
}

# Deploy shelcaster-create-ivs-channel
Write-Host "`n[1/3] Deploying shelcaster-create-ivs-channel..." -ForegroundColor Green
Push-Location shelcaster-create-ivs-channel
npm install --omit=dev --silent
Pop-Location

Create-LambdaZip "shelcaster-create-ivs-channel"

$functionExists = aws lambda get-function --function-name shelcaster-create-ivs-channel --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Updating existing function..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name shelcaster-create-ivs-channel --zip-file fileb://shelcaster-create-ivs-channel/function.zip --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
} else {
    Write-Host "  Creating new function..." -ForegroundColor Yellow
    aws lambda create-function --function-name shelcaster-create-ivs-channel --runtime nodejs20.x --role $ROLE_ARN --handler index.handler --zip-file fileb://shelcaster-create-ivs-channel/function.zip --timeout 30 --memory-size 256 --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
}
Remove-Item shelcaster-create-ivs-channel/function.zip

# Deploy shelcaster-start-broadcast
Write-Host "`n[2/3] Deploying shelcaster-start-broadcast..." -ForegroundColor Green
Push-Location shelcaster-start-broadcast
npm install --omit=dev --silent
Pop-Location

Create-LambdaZip "shelcaster-start-broadcast" "index.mjs"
aws lambda update-function-code --function-name shelcaster-start-broadcast --zip-file fileb://shelcaster-start-broadcast/function.zip --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
Remove-Item shelcaster-start-broadcast/function.zip

# Deploy shelcaster-stop-broadcast
Write-Host "`n[3/3] Deploying shelcaster-stop-broadcast..." -ForegroundColor Green
Push-Location shelcaster-stop-broadcast
npm install --omit=dev --silent
Pop-Location

Create-LambdaZip "shelcaster-stop-broadcast" "index.mjs"
aws lambda update-function-code --function-name shelcaster-stop-broadcast --zip-file fileb://shelcaster-stop-broadcast/function.zip --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
Remove-Item shelcaster-stop-broadcast/function.zip

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Next: Add API Gateway route and IVS permissions" -ForegroundColor Yellow

