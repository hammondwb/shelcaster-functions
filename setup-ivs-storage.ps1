# Setup IVS Storage Configuration for Compositions

Write-Host "Setting up IVS Storage Configuration" -ForegroundColor Cyan

# Create S3 bucket for compositions (if not exists)
$BUCKET_NAME = "shelcaster-compositions"

Write-Host "`nChecking if bucket exists..." -ForegroundColor Yellow
aws s3 ls s3://$BUCKET_NAME --profile shelcaster-admin 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating S3 bucket: $BUCKET_NAME" -ForegroundColor Yellow
    aws s3 mb s3://$BUCKET_NAME --profile shelcaster-admin --region us-east-1
} else {
    Write-Host "Bucket already exists" -ForegroundColor Green
}

# Create storage configuration
Write-Host "`nCreating IVS storage configuration..." -ForegroundColor Yellow

$storageConfig = aws ivs create-storage-configuration `
  --name "shelcaster-compositions" `
  --s3 "{`"bucketName`":`"$BUCKET_NAME`"}" `
  --profile shelcaster-admin `
  --region us-east-1 `
  --output json | ConvertFrom-Json

$STORAGE_ARN = $storageConfig.storageConfiguration.arn

Write-Host "`n✅ Storage configuration created!" -ForegroundColor Green
Write-Host "ARN: $STORAGE_ARN" -ForegroundColor Yellow

# Update Lambda environment variable
Write-Host "`nUpdating Lambda environment variable..." -ForegroundColor Yellow

aws lambda update-function-configuration `
  --function-name shelcaster-create-participant-compositions `
  --environment "Variables={S3_STORAGE_CONFIG_ARN=$STORAGE_ARN}" `
  --profile shelcaster-admin `
  --region us-east-1

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "`nStorage ARN: $STORAGE_ARN" -ForegroundColor Cyan
Write-Host "Bucket: s3://$BUCKET_NAME" -ForegroundColor Cyan
