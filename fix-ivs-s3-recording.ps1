# Fix IVS S3 Recording Configuration
# Diagnoses and fixes the issue where IVS recording is stuck in STARTING state

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$S3_BUCKET = "shelcaster-media-manager"
$ACCOUNT_ID = "124355640062"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IVS S3 Recording Diagnostic & Fix" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Check S3 bucket policy
Write-Host "[1/6] Checking S3 bucket policy..." -ForegroundColor Yellow
$bucketPolicy = aws s3api get-bucket-policy --bucket $S3_BUCKET --profile $PROFILE --region $REGION --query Policy --output text 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Current bucket policy:" -ForegroundColor Gray
    $bucketPolicy | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
    
    # Check if IVS service principal has permissions
    $policyObj = $bucketPolicy | ConvertFrom-Json
    $hasIVSPermission = $false
    foreach ($statement in $policyObj.Statement) {
        if ($statement.Principal.Service -eq "ivs.amazonaws.com") {
            $hasIVSPermission = $true
            Write-Host "  ✅ IVS service principal found in bucket policy" -ForegroundColor Green
            break
        }
    }
    
    if (-not $hasIVSPermission) {
        Write-Host "  ❌ IVS service principal NOT found in bucket policy" -ForegroundColor Red
        Write-Host "  Applying correct bucket policy..." -ForegroundColor Yellow
        
        $correctPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowIVSRecording",
      "Effect": "Allow",
      "Principal": {
        "Service": "ivs.amazonaws.com"
      },
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::$S3_BUCKET/*",
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "$ACCOUNT_ID"
        }
      }
    }
  ]
}
"@
        
        $correctPolicy | Out-File -FilePath "temp-bucket-policy.json" -Encoding utf8
        aws s3api put-bucket-policy --bucket $S3_BUCKET --policy file://temp-bucket-policy.json --profile $PROFILE --region $REGION
        Remove-Item -Path "temp-bucket-policy.json" -ErrorAction SilentlyContinue
        Write-Host "  ✅ Bucket policy updated" -ForegroundColor Green
    }
} else {
    Write-Host "  ❌ No bucket policy found or error accessing bucket" -ForegroundColor Red
    Write-Host "  Creating bucket policy..." -ForegroundColor Yellow
    
    $newPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowIVSRecording",
      "Effect": "Allow",
      "Principal": {
        "Service": "ivs.amazonaws.com"
      },
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::$S3_BUCKET/*",
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "$ACCOUNT_ID"
        }
      }
    }
  ]
}
"@
    
    $newPolicy | Out-File -FilePath "temp-bucket-policy.json" -Encoding utf8
    aws s3api put-bucket-policy --bucket $S3_BUCKET --policy file://temp-bucket-policy.json --profile $PROFILE --region $REGION
    Remove-Item -Path "temp-bucket-policy.json" -ErrorAction SilentlyContinue
    Write-Host "  ✅ Bucket policy created" -ForegroundColor Green
}

# Step 2: Check IVS storage configurations
Write-Host "`n[2/6] Checking IVS storage configurations..." -ForegroundColor Yellow
$storageConfigs = aws ivs-realtime list-storage-configurations --profile $PROFILE --region $REGION --output json 2>&1 | ConvertFrom-Json

if ($storageConfigs.storageConfigurations.Count -eq 0) {
    Write-Host "  ❌ No storage configurations found" -ForegroundColor Red
    Write-Host "  Creating storage configuration..." -ForegroundColor Yellow
    
    $createResult = aws ivs-realtime create-storage-configuration `
        --name "shelcaster-recordings" `
        --s3 "bucketName=$S3_BUCKET" `
        --profile $PROFILE `
        --region $REGION `
        --output json | ConvertFrom-Json
    
    $storageConfigArn = $createResult.storageConfiguration.arn
    Write-Host "  ✅ Storage configuration created" -ForegroundColor Green
    Write-Host "  ARN: $storageConfigArn" -ForegroundColor Cyan
} else {
    $storageConfig = $storageConfigs.storageConfigurations[0]
    $storageConfigArn = $storageConfig.arn
    Write-Host "  ✅ Storage configuration exists" -ForegroundColor Green
    Write-Host "  ARN: $storageConfigArn" -ForegroundColor Cyan
    Write-Host "  Bucket: $($storageConfig.s3.bucketName)" -ForegroundColor Gray
}

# Step 3: Check Lambda environment variable
Write-Host "`n[3/6] Checking Lambda environment variables..." -ForegroundColor Yellow
$lambdaConfig = aws lambda get-function-configuration `
    --function-name shelcaster-start-composition `
    --profile $PROFILE `
    --region $REGION `
    --output json 2>&1 | ConvertFrom-Json

$currentStorageArn = $lambdaConfig.Environment.Variables.STORAGE_CONFIGURATION_ARN

if ($currentStorageArn -eq $storageConfigArn) {
    Write-Host "  ✅ Lambda has correct STORAGE_CONFIGURATION_ARN" -ForegroundColor Green
    Write-Host "  ARN: $currentStorageArn" -ForegroundColor Gray
} else {
    Write-Host "  ❌ Lambda STORAGE_CONFIGURATION_ARN mismatch or missing" -ForegroundColor Red
    Write-Host "  Current: $currentStorageArn" -ForegroundColor Gray
    Write-Host "  Expected: $storageConfigArn" -ForegroundColor Gray
    Write-Host "  Updating Lambda environment variable..." -ForegroundColor Yellow
    
    aws lambda update-function-configuration `
        --function-name shelcaster-start-composition `
        --environment "Variables={STORAGE_CONFIGURATION_ARN=$storageConfigArn,ENCODER_CONFIGURATION_ARN=$($lambdaConfig.Environment.Variables.ENCODER_CONFIGURATION_ARN)}" `
        --profile $PROFILE `
        --region $REGION `
        --no-cli-pager | Out-Null
    
    Write-Host "  ✅ Lambda environment variable updated" -ForegroundColor Green
    Write-Host "  Waiting for Lambda to update..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

# Step 4: Verify S3 bucket exists and is accessible
Write-Host "`n[4/6] Verifying S3 bucket accessibility..." -ForegroundColor Yellow
$bucketCheck = aws s3api head-bucket --bucket $S3_BUCKET --profile $PROFILE --region $REGION 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ S3 bucket is accessible" -ForegroundColor Green
} else {
    Write-Host "  ❌ S3 bucket is not accessible" -ForegroundColor Red
    Write-Host "  Error: $bucketCheck" -ForegroundColor Red
    exit 1
}

# Step 5: Check bucket encryption (IVS requires SSE-S3 or no encryption)
Write-Host "`n[5/6] Checking S3 bucket encryption..." -ForegroundColor Yellow
$encryption = aws s3api get-bucket-encryption --bucket $S3_BUCKET --profile $PROFILE --region $REGION 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠️  No default encryption (this is OK for IVS)" -ForegroundColor Yellow
} else {
    $encryptionObj = $encryption | ConvertFrom-Json
    $sseAlgorithm = $encryptionObj.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm
    
    if ($sseAlgorithm -eq "AES256") {
        Write-Host "  ✅ Bucket uses SSE-S3 (AES256) - compatible with IVS" -ForegroundColor Green
    } elseif ($sseAlgorithm -eq "aws:kms") {
        Write-Host "  ❌ Bucket uses KMS encryption - IVS may have issues" -ForegroundColor Red
        Write-Host "  Consider removing default encryption or switching to SSE-S3" -ForegroundColor Yellow
    }
}

# Step 6: Test write permissions
Write-Host "`n[6/6] Testing IVS write permissions to S3..." -ForegroundColor Yellow
Write-Host "  Note: This tests YOUR permissions, not IVS service permissions" -ForegroundColor Gray

$testFile = "ivs-test-$(Get-Date -Format 'yyyyMMddHHmmss').txt"
$testContent = "IVS recording test file"

try {
    $testContent | Out-File -FilePath $testFile -Encoding utf8
    aws s3 cp $testFile "s3://$S3_BUCKET/test-recordings/$testFile" --profile $PROFILE --region $REGION 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Successfully wrote test file to S3" -ForegroundColor Green
        aws s3 rm "s3://$S3_BUCKET/test-recordings/$testFile" --profile $PROFILE --region $REGION 2>&1 | Out-Null
    } else {
        Write-Host "  ❌ Failed to write test file to S3" -ForegroundColor Red
    }
    
    Remove-Item -Path $testFile -ErrorAction SilentlyContinue
} catch {
    Write-Host "  ❌ Error testing S3 write: $_" -ForegroundColor Red
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Configuration Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "S3 Bucket: $S3_BUCKET" -ForegroundColor White
Write-Host "Storage Config ARN: $storageConfigArn" -ForegroundColor White
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Start a new composition to test recording" -ForegroundColor White
Write-Host "2. Check CloudWatch Logs for IVS Real-Time composition" -ForegroundColor White
Write-Host "3. Monitor S3 bucket for incoming m3u8 files" -ForegroundColor White
Write-Host "4. Check composition state with:" -ForegroundColor White
Write-Host "   aws ivs-realtime get-composition --arn <composition-arn> --profile $PROFILE" -ForegroundColor Gray
Write-Host "`n========================================`n" -ForegroundColor Cyan
