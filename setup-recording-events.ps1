# Setup IVS Recording Event Processing
# This script creates a Lambda function and EventBridge rule to process IVS recording events

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$FUNCTION_NAME = "shelcaster-process-recording-event"
$ROLE_ARN = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"
$ACCOUNT_ID = "124355640062"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Setting up IVS Recording Event Processing" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

# Step 1: Deploy Lambda function
Write-Host "[1/4] Deploying Lambda function..." -ForegroundColor Yellow

Set-Location E:\projects\shelcaster-functions\shelcaster-process-recording-event

# Check if function exists
$functionExists = aws lambda get-function --function-name $FUNCTION_NAME --profile $PROFILE --region $REGION 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Updating existing function..." -ForegroundColor Yellow
    Compress-Archive -Path index.mjs -DestinationPath deploy.zip -Force
    aws lambda update-function-code --function-name $FUNCTION_NAME --zip-file fileb://deploy.zip --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
    Remove-Item deploy.zip
    Write-Host "  ✅ Lambda function updated" -ForegroundColor Green
} else {
    Write-Host "  Creating new function..." -ForegroundColor Yellow
    Compress-Archive -Path index.mjs -DestinationPath deploy.zip -Force
    
    aws lambda create-function `
        --function-name $FUNCTION_NAME `
        --runtime nodejs22.x `
        --role $ROLE_ARN `
        --handler index.handler `
        --zip-file fileb://deploy.zip `
        --timeout 30 `
        --memory-size 256 `
        --profile $PROFILE `
        --region $REGION `
        --no-cli-pager | Out-Null
    
    Remove-Item deploy.zip
    Write-Host "  ✅ Lambda function created" -ForegroundColor Green
}

# Step 2: Add S3 permissions to Lambda role (if not already present)
Write-Host "`n[2/4] Checking Lambda permissions..." -ForegroundColor Yellow

$s3PolicyArn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
aws iam attach-role-policy --role-name lambda-dynamodb-role --policy-arn $s3PolicyArn --profile $PROFILE 2>&1 | Out-Null
Write-Host "  ✅ S3 read permissions attached" -ForegroundColor Green

# Step 3: Create EventBridge rule
Write-Host "`n[3/4] Creating EventBridge rule..." -ForegroundColor Yellow

$eventPattern = @"
{
  "source": ["aws.ivs"],
  "detail-type": ["IVS Recording State Change"],
  "detail": {
    "recording_status": ["Recording End"]
  }
}
"@

$eventPattern | Out-File -FilePath "event-pattern.json" -Encoding utf8

$ruleExists = aws events describe-rule --name ivs-recording-complete --profile $PROFILE --region $REGION 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  EventBridge rule already exists" -ForegroundColor Green
} else {
    aws events put-rule `
        --name ivs-recording-complete `
        --event-pattern file://event-pattern.json `
        --state ENABLED `
        --description "Trigger when IVS recording completes" `
        --profile $PROFILE `
        --region $REGION `
        --no-cli-pager | Out-Null
    
    Write-Host "  ✅ EventBridge rule created" -ForegroundColor Green
}

Remove-Item event-pattern.json

# Step 4: Add Lambda as target for EventBridge rule
Write-Host "`n[4/4] Connecting EventBridge to Lambda..." -ForegroundColor Yellow

# Add permission for EventBridge to invoke Lambda
aws lambda add-permission `
    --function-name $FUNCTION_NAME `
    --statement-id eventbridge-invoke-recording-processor `
    --action lambda:InvokeFunction `
    --principal events.amazonaws.com `
    --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/ivs-recording-complete" `
    --profile $PROFILE `
    --region $REGION 2>&1 | Out-Null

# Add Lambda as target
$lambdaArn = "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

aws events put-targets `
    --rule ivs-recording-complete `
    --targets "Id=1,Arn=$lambdaArn" `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager | Out-Null

Write-Host "  ✅ EventBridge connected to Lambda" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ Recording Event Processing Setup Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
Write-Host "How it works:" -ForegroundColor Yellow
Write-Host "  1. When you stop streaming, IVS sends a 'Recording End' event" -ForegroundColor Cyan
Write-Host "  2. EventBridge triggers the Lambda function" -ForegroundColor Cyan
Write-Host "  3. Lambda finds the recording in S3 and updates DynamoDB" -ForegroundColor Cyan
Write-Host "  4. Recording status changes from 'recording' to 'completed'" -ForegroundColor Cyan
Write-Host "  5. Playback URL is automatically added`n" -ForegroundColor Cyan

