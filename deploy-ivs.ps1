$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"

Write-Host "Deploying IVS Lambda functions..." -ForegroundColor Cyan

# Deploy shelcaster-create-ivs-channel
Write-Host "`n[1/3] Deploying shelcaster-create-ivs-channel..." -ForegroundColor Green
cd shelcaster-create-ivs-channel
npm install --production
Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath function.zip -Force

$functionExists = aws lambda get-function --function-name shelcaster-create-ivs-channel --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Updating existing function..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name shelcaster-create-ivs-channel --zip-file fileb://function.zip --profile $PROFILE --region $REGION
} else {
    Write-Host "  Creating new function..." -ForegroundColor Yellow
    aws lambda create-function --function-name shelcaster-create-ivs-channel --runtime nodejs20.x --role $ROLE_ARN --handler index.handler --zip-file fileb://function.zip --timeout 30 --memory-size 256 --profile $PROFILE --region $REGION
}
Remove-Item function.zip
cd ..

# Deploy shelcaster-start-broadcast
Write-Host "`n[2/3] Deploying shelcaster-start-broadcast..." -ForegroundColor Green
cd shelcaster-start-broadcast
npm install --production
Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath function.zip -Force
aws lambda update-function-code --function-name shelcaster-start-broadcast --zip-file fileb://function.zip --profile $PROFILE --region $REGION
Remove-Item function.zip
cd ..

# Deploy shelcaster-stop-broadcast
Write-Host "`n[3/3] Deploying shelcaster-stop-broadcast..." -ForegroundColor Green
cd shelcaster-stop-broadcast
npm install --production
Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath function.zip -Force
aws lambda update-function-code --function-name shelcaster-stop-broadcast --zip-file fileb://function.zip --profile $PROFILE --region $REGION
Remove-Item function.zip
cd ..

Write-Host "`nDeployment complete!" -ForegroundColor Green

