# Deploy shelcaster-end-session Lambda
Write-Host "Deploying shelcaster-end-session Lambda..." -ForegroundColor Cyan

# Navigate to Lambda directory
Push-Location shelcaster-end-session

# Remove old zip if exists
if (Test-Path function.zip) {
    Remove-Item function.zip
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install --production

# Create zip file
Write-Host "Creating deployment package..." -ForegroundColor Yellow
if (Get-Command tar -ErrorAction SilentlyContinue) {
    tar -a -cf function.zip index.mjs node_modules
} else {
    Compress-Archive -Path index.mjs,node_modules -DestinationPath function.zip -Force
}

# Deploy to AWS
Write-Host "Uploading to AWS Lambda..." -ForegroundColor Yellow
aws lambda update-function-code `
    --function-name shelcaster-end-session `
    --zip-file fileb://function.zip `
    --region us-east-1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully deployed shelcaster-end-session" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to deploy shelcaster-end-session" -ForegroundColor Red
}

# Cleanup
Remove-Item function.zip

Pop-Location

Write-Host "`nDeployment complete!" -ForegroundColor Cyan
Write-Host "The updated Lambda will now log detailed cleanup information to CloudWatch." -ForegroundColor Yellow
