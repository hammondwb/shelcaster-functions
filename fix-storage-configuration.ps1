# Fix IVS Real-Time Storage Configuration for S3 Recording
# This recreates the storage configuration with proper permissions

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$BUCKET = "shelcaster-media-manager"
$ACCOUNT_ID = "124355640062"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Fix IVS Real-Time Storage Configuration" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Verify/Update S3 Bucket Policy
Write-Host "[1/3] Updating S3 Bucket Policy..." -ForegroundColor Yellow

$bucketPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowIVSRecording",
      "Effect": "Allow",
      "Principal": {
        "Service": "ivs.amazonaws.com"
      },
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::$BUCKET/*",
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "$ACCOUNT_ID"
        }
      }
    },
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::$ACCOUNT_ID:distribution/E34KC6MODUKR5U"
        }
      }
    },
    {
      "Sid": "AllowIVSRealTimeComposite",
      "Effect": "Allow",
      "Principal": {
        "Service": "ivs-composite.us-east-1.amazonaws.com"
      },
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::$BUCKET/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-acl": "bucket-owner-full-control"
        },
        "Bool": {
          "aws:SecureTransport": "true"
        }
      }
    }
  ]
}
"@

$bucketPolicy | Out-File -FilePath "bucket-policy.json" -Encoding utf8
aws s3api put-bucket-policy --bucket $BUCKET --policy file://bucket-policy.json --profile $PROFILE --region $REGION
Remove-Item bucket-policy.json

Write-Host "  ✅ S3 bucket policy updated" -ForegroundColor Green

# Step 2: Delete old storage configuration (if needed)
Write-Host "`n[2/3] Checking existing storage configuration..." -ForegroundColor Yellow
$oldArn = "arn:aws:ivs:us-east-1:124355640062:storage-configuration/yxxsKmccqsDL"

# Note: AWS CLI doesn't support IVS Real-Time storage config operations
# Must use SDK or Console
Write-Host "  ⚠️  Cannot delete via CLI - use AWS Console or SDK" -ForegroundColor Yellow
Write-Host "  Old ARN: $oldArn" -ForegroundColor Gray

# Step 3: Create new storage configuration via Node.js
Write-Host "`n[3/3] Creating new storage configuration..." -ForegroundColor Yellow

$nodeScript = @"
const { IVSRealTimeClient, CreateStorageConfigurationCommand } = require('@aws-sdk/client-ivs-realtime');

const client = new IVSRealTimeClient({ region: 'us-east-1' });

async function createStorageConfig() {
  try {
    const response = await client.send(new CreateStorageConfigurationCommand({
      name: 'shelcaster-recordings-v2',
      s3: {
        bucketName: '$BUCKET'
      }
    }));
    
    console.log('✅ Storage configuration created:');
    console.log('ARN:', response.storageConfiguration.arn);
    console.log('');
    console.log('⚠️  UPDATE Lambda environment variable:');
    console.log('STORAGE_CONFIGURATION_ARN=' + response.storageConfiguration.arn);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createStorageConfig();
"@

$nodeScript | Out-File -FilePath "create-storage-config.js" -Encoding utf8

Write-Host "  Running Node.js script..." -ForegroundColor Yellow
node create-storage-config.js

Remove-Item create-storage-config.js

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "1. Copy the new STORAGE_CONFIGURATION_ARN from above" -ForegroundColor Yellow
Write-Host "2. Update Lambda environment variable:" -ForegroundColor Yellow
Write-Host "   aws lambda update-function-configuration \" -ForegroundColor White
Write-Host "     --function-name shelcaster-start-composition \" -ForegroundColor White
Write-Host "     --environment Variables={STORAGE_CONFIGURATION_ARN=<NEW_ARN>,ENCODER_CONFIGURATION_ARN=arn:aws:ivs:us-east-1:124355640062:encoder-configuration/vi0lHhtb9E0i} \" -ForegroundColor White
Write-Host "     --profile shelcaster-admin --region us-east-1" -ForegroundColor White
Write-Host ""
