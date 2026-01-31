Write-Host "Installing dependencies..." -ForegroundColor Green
npm install

Write-Host "Creating deployment package..." -ForegroundColor Green
Compress-Archive -Path index.mjs,node_modules,package.json -DestinationPath deploy.zip -Force

Write-Host "Deploying to AWS Lambda..." -ForegroundColor Green
$createResult = aws lambda create-function --function-name shelcaster-save-recording --runtime nodejs22.x --role arn:aws:iam::124355640062:role/lambda-dynamodb-role --handler index.handler --zip-file fileb://deploy.zip --timeout 30 --memory-size 256 --profile shelcaster-admin --region us-east-1 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Function exists, updating..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name shelcaster-save-recording --zip-file fileb://deploy.zip --profile shelcaster-admin --region us-east-1
} else {
    Write-Host "Function created successfully!" -ForegroundColor Green
}

Write-Host "Cleaning up..." -ForegroundColor Green
Remove-Item deploy.zip -ErrorAction SilentlyContinue

Write-Host "Done!" -ForegroundColor Green

