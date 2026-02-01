# Deploy shelcaster-start-broadcast Lambda

Write-Host "Creating deployment package..." -ForegroundColor Cyan

# Remove old zip if exists
if (Test-Path function.zip) {
    Remove-Item function.zip
}

# Create zip file
Compress-Archive -Path index.mjs,node_modules,package.json,package-lock.json -DestinationPath function.zip -Force

Write-Host "Uploading to AWS Lambda..." -ForegroundColor Cyan

# Update Lambda function
aws lambda update-function-code `
    --function-name shelcaster-start-broadcast `
    --zip-file fileb://function.zip `
    --profile shelcaster-admin `
    --region us-east-1

Write-Host "Deployment complete!" -ForegroundColor Green

