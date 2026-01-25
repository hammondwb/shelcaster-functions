# Setup AWS IVS Recording Configuration
# This script creates an IVS recording configuration that saves recordings to S3

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$S3_BUCKET = "shelcaster-media-manager"  # Using existing bucket
$RECORDING_CONFIG_NAME = "shelcaster-recordings"
$ACCOUNT_ID = "124355640062"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Setting up AWS IVS Recording" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

# Check if S3 bucket exists
Write-Host "[1/4] Checking S3 bucket..." -ForegroundColor Yellow
$bucketExists = aws s3api head-bucket --bucket $S3_BUCKET --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creating S3 bucket: $S3_BUCKET" -ForegroundColor Yellow
    aws s3api create-bucket --bucket $S3_BUCKET --profile $PROFILE --region $REGION --no-cli-pager
    Write-Host "  ✅ Created S3 bucket" -ForegroundColor Green
} else {
    Write-Host "  ✅ S3 bucket already exists: $S3_BUCKET" -ForegroundColor Green
}

# Create IAM role for IVS to write to S3
Write-Host "`n[2/4] Creating IAM role for IVS..." -ForegroundColor Yellow

$trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ivs.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@

$trustPolicy | Out-File -FilePath "ivs-trust-policy.json" -Encoding utf8

$roleExists = aws iam get-role --role-name IVSRecordingRole --profile $PROFILE 2>&1
if ($LASTEXITCODE -ne 0) {
    aws iam create-role --role-name IVSRecordingRole --assume-role-policy-document file://ivs-trust-policy.json --profile $PROFILE --no-cli-pager
    Write-Host "  ✅ Created IAM role: IVSRecordingRole" -ForegroundColor Green
} else {
    Write-Host "  ✅ IAM role already exists: IVSRecordingRole" -ForegroundColor Green
}

# Attach S3 write policy to the role
Write-Host "`n[3/4] Creating S3 policy..." -ForegroundColor Yellow

$s3Policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::$S3_BUCKET/*"
    }
  ]
}
"@

$s3Policy | Out-File -FilePath "ivs-s3-policy.json" -Encoding utf8

$policyExists = aws iam get-policy --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/IVSRecordingS3Policy" --profile $PROFILE 2>&1
if ($LASTEXITCODE -ne 0) {
    aws iam create-policy --policy-name IVSRecordingS3Policy --policy-document file://ivs-s3-policy.json --profile $PROFILE --no-cli-pager
    Write-Host "  ✅ Created IAM policy: IVSRecordingS3Policy" -ForegroundColor Green
} else {
    Write-Host "  ✅ IAM policy already exists: IVSRecordingS3Policy" -ForegroundColor Green
}

aws iam attach-role-policy --role-name IVSRecordingRole --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/IVSRecordingS3Policy" --profile $PROFILE 2>&1 | Out-Null

# Wait for role to be available
Write-Host "  Waiting for IAM role to propagate..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Get the role ARN
$roleArn = aws iam get-role --role-name IVSRecordingRole --profile $PROFILE --query "Role.Arn" --output text

Write-Host "`n[4/4] Creating IVS Recording Configuration..." -ForegroundColor Yellow

# Check if recording configuration already exists
$existingConfig = aws ivs list-recording-configurations --profile $PROFILE --region $REGION --query "recordingConfigurations[?name=='$RECORDING_CONFIG_NAME'].arn" --output text 2>&1

if ($existingConfig -and $existingConfig -ne "") {
    Write-Host "  ✅ Recording configuration already exists" -ForegroundColor Green
    Write-Host "  ARN: $existingConfig" -ForegroundColor Cyan
    $recordingConfigArn = $existingConfig
} else {
    # Create IVS recording configuration
    $recordingConfigArn = aws ivs create-recording-configuration `
        --name $RECORDING_CONFIG_NAME `
        --destination-configuration "s3={bucketName=$S3_BUCKET}" `
        --recording-reconnect-window-seconds 60 `
        --profile $PROFILE `
        --region $REGION `
        --query "recordingConfiguration.arn" `
        --output text

    Write-Host "  ✅ Created IVS Recording Configuration" -ForegroundColor Green
    Write-Host "  ARN: $recordingConfigArn" -ForegroundColor Cyan
}

# Cleanup temp files
Remove-Item -Path "ivs-trust-policy.json" -ErrorAction SilentlyContinue
Remove-Item -Path "ivs-s3-policy.json" -ErrorAction SilentlyContinue

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ IVS Recording Setup Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
Write-Host "Recording Configuration ARN:" -ForegroundColor Yellow
Write-Host "  $recordingConfigArn`n" -ForegroundColor Cyan
Write-Host "S3 Bucket:" -ForegroundColor Yellow
Write-Host "  $S3_BUCKET`n" -ForegroundColor Cyan
Write-Host "Recordings will be saved to:" -ForegroundColor Yellow
Write-Host "  s3://$S3_BUCKET/ivs-recordings/{channel-id}/..." -ForegroundColor Cyan
Write-Host "`nNOTE: You need to update the IVS channel creation to use this recording config ARN" -ForegroundColor Yellow

