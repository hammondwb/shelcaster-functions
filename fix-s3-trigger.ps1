# Fix S3 Trigger for IVS Real-Time Recordings
# IVS Real-Time creates multivariant.m3u8, not master.m3u8

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$BUCKET = "shelcaster-media-manager"
$LAMBDA_ARN = "arn:aws:lambda:us-east-1:124355640062:function:shelcaster-ivs-recording-processor"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Fix S3 Trigger for IVS Real-Time" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Problem: IVS Real-Time creates multivariant.m3u8" -ForegroundColor Yellow
Write-Host "Current trigger only listens for master.m3u8" -ForegroundColor Yellow
Write-Host "Result: Lambda never runs, no program_url saved`n" -ForegroundColor Yellow

# Create notification configuration JSON
$notificationConfig = @"
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "ivs-realtime-multivariant",
      "LambdaFunctionArn": "$LAMBDA_ARN",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "Suffix",
              "Value": "multivariant.m3u8"
            }
          ]
        }
      }
    },
    {
      "Id": "ivs-standard-master",
      "LambdaFunctionArn": "$LAMBDA_ARN",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "Suffix",
              "Value": "master.m3u8"
            }
          ]
        }
      }
    }
  ]
}
"@

$notificationConfig | Out-File -FilePath "notification-config.json" -Encoding utf8

Write-Host "[1/2] Updating S3 notification configuration..." -ForegroundColor Yellow

aws s3api put-bucket-notification-configuration `
    --bucket $BUCKET `
    --notification-configuration file://notification-config.json `
    --profile $PROFILE `
    --region $REGION

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ S3 trigger updated successfully" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed to update S3 trigger" -ForegroundColor Red
    Write-Host "`nIf you see 'Unable to validate' error, run:" -ForegroundColor Yellow
    Write-Host "aws lambda add-permission \" -ForegroundColor White
    Write-Host "  --function-name shelcaster-ivs-recording-processor \" -ForegroundColor White
    Write-Host "  --statement-id s3-invoke-multivariant \" -ForegroundColor White
    Write-Host "  --action lambda:InvokeFunction \" -ForegroundColor White
    Write-Host "  --principal s3.amazonaws.com \" -ForegroundColor White
    Write-Host "  --source-arn arn:aws:s3:::shelcaster-media-manager \" -ForegroundColor White
    Write-Host "  --profile shelcaster-admin --region us-east-1" -ForegroundColor White
    Remove-Item notification-config.json
    exit 1
}

Write-Host "`n[2/2] Verifying configuration..." -ForegroundColor Yellow
aws s3api get-bucket-notification-configuration `
    --bucket $BUCKET `
    --profile $PROFILE `
    --region $REGION `
    --query "LambdaFunctionConfigurations[*].[Id,Filter.Key.FilterRules[0].Value]" `
    --output table

Remove-Item notification-config.json

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ Fix Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "S3 bucket now triggers Lambda for:" -ForegroundColor Green
Write-Host "  - multivariant.m3u8 (IVS Real-Time compositions)" -ForegroundColor White
Write-Host "  - master.m3u8 (IVS standard recordings)" -ForegroundColor White
Write-Host "`nNext recording will automatically:" -ForegroundColor Green
Write-Host "  1. Trigger Lambda when multivariant.m3u8 is created" -ForegroundColor White
Write-Host "  2. Create program entry in DynamoDB" -ForegroundColor White
Write-Host "  3. Save program_url with CloudFront URL`n" -ForegroundColor White
