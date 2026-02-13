# Deploy Phase 1: IVS Compositions Lambda

Write-Host "Deploying Phase 1: IVS Participant Compositions" -ForegroundColor Cyan

# Deploy shelcaster-create-participant-compositions
Write-Host "`nDeploying shelcaster-create-participant-compositions..." -ForegroundColor Yellow

cd shelcaster-create-participant-compositions
npm install

if (Test-Path function.zip) {
    Remove-Item function.zip
}

Compress-Archive -Path * -DestinationPath function.zip -Force

aws lambda update-function-code `
  --function-name shelcaster-create-participant-compositions `
  --zip-file fileb://function.zip `
  --profile shelcaster-admin `
  --region us-east-1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Function doesn't exist, creating..." -ForegroundColor Yellow
    
    aws lambda create-function `
      --function-name shelcaster-create-participant-compositions `
      --runtime nodejs20.x `
      --role arn:aws:iam::124355640062:role/lambda-dynamodb-role `
      --handler index.handler `
      --zip-file fileb://function.zip `
      --timeout 60 `
      --memory-size 512 `
      --environment "Variables={TABLE_NAME=shelcaster-app}" `
      --profile shelcaster-admin `
      --region us-east-1
}

Remove-Item function.zip
cd ..

Write-Host "`n✅ Phase 1 deployment complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Create S3 storage configuration for IVS compositions"
Write-Host "2. Update Lambda environment variable with storage config ARN"
Write-Host "3. Add API Gateway route: POST /sessions/{sessionId}/compositions"
Write-Host "4. Test composition creation"
