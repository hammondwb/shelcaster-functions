# Deploy Phase 2: MediaLive Dynamic Channel

Write-Host "Deploying Phase 2: MediaLive Dynamic Channel" -ForegroundColor Cyan

cd shelcaster-create-medialive-dynamic
npm install

if (Test-Path function.zip) {
    Remove-Item function.zip
}

Compress-Archive -Path * -DestinationPath function.zip -Force

aws lambda update-function-code `
  --function-name shelcaster-create-medialive-dynamic `
  --zip-file fileb://function.zip `
  --profile shelcaster-admin `
  --region us-east-1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Function doesn't exist, creating..." -ForegroundColor Yellow
    
    aws lambda create-function `
      --function-name shelcaster-create-medialive-dynamic `
      --runtime nodejs20.x `
      --role arn:aws:iam::124355640062:role/lambda-dynamodb-role `
      --handler index.handler `
      --zip-file fileb://function.zip `
      --timeout 120 `
      --memory-size 512 `
      --environment "Variables={MEDIALIVE_ROLE_ARN=arn:aws:iam::124355640062:role/MediaLiveAccessRole}" `
      --profile shelcaster-admin `
      --region us-east-1
}

Remove-Item function.zip
cd ..

Write-Host "`n✅ Phase 2 deployment complete!" -ForegroundColor Green
