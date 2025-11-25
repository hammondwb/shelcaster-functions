$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"

Write-Host "Deploying IVS Real-Time Lambda functions..." -ForegroundColor Cyan

# Function to create zip using tar (available in Windows 10+)
function Create-LambdaZip {
    param($FunctionDir, $IndexFile = "index.js")
    
    Push-Location $FunctionDir
    if (Test-Path function.zip) { Remove-Item function.zip }
    
    # Use tar to create zip (works better than Compress-Archive)
    tar -a -c -f function.zip $IndexFile package.json node_modules
    
    Pop-Location
}

# Deploy shelcaster-create-stage
Write-Host "`n[1/2] Deploying shelcaster-create-stage..." -ForegroundColor Green
Push-Location shelcaster-create-stage
npm install --omit=dev --silent
Pop-Location

Create-LambdaZip "shelcaster-create-stage"

$functionExists = aws lambda get-function --function-name shelcaster-create-stage --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Updating existing function..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name shelcaster-create-stage --zip-file fileb://shelcaster-create-stage/function.zip --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
} else {
    Write-Host "  Creating new function..." -ForegroundColor Yellow
    aws lambda create-function --function-name shelcaster-create-stage --runtime nodejs20.x --role $ROLE_ARN --handler index.handler --zip-file fileb://shelcaster-create-stage/function.zip --timeout 30 --memory-size 256 --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
}
Remove-Item shelcaster-create-stage/function.zip

# Deploy shelcaster-create-caller-token
Write-Host "`n[2/2] Deploying shelcaster-create-caller-token..." -ForegroundColor Green
Push-Location shelcaster-create-caller-token
npm install --omit=dev --silent
Pop-Location

Create-LambdaZip "shelcaster-create-caller-token"

$functionExists = aws lambda get-function --function-name shelcaster-create-caller-token --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Updating existing function..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name shelcaster-create-caller-token --zip-file fileb://shelcaster-create-caller-token/function.zip --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
} else {
    Write-Host "  Creating new function..." -ForegroundColor Yellow
    aws lambda create-function --function-name shelcaster-create-caller-token --runtime nodejs20.x --role $ROLE_ARN --handler index.handler --zip-file fileb://shelcaster-create-caller-token/function.zip --timeout 30 --memory-size 256 --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
}
Remove-Item shelcaster-create-caller-token/function.zip

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Next: Add API Gateway routes for these functions" -ForegroundColor Yellow

