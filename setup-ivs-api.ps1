$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$API_ID = "td0dn99gi2"
$AUTHORIZER_ID = "hnk3sf"
$ACCOUNT_ID = "124355640062"
$ROLE_NAME = "lambda-dynamodb-role"

Write-Host "Setting up IVS API and Permissions..." -ForegroundColor Cyan

# Step 1: Add IVS permissions to Lambda role
Write-Host "`n[1/2] Adding IVS permissions to Lambda role..." -ForegroundColor Green

$policyDocument = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ivs:CreateChannel",
        "ivs:GetChannel",
        "ivs:GetStream",
        "ivs:StopStream",
        "ivs:CreateStreamKey",
        "ivs:GetStreamKey",
        "ivs:CreateRecordingConfiguration",
        "ivs:GetRecordingConfiguration"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::shelcaster-media-bucket/*",
        "arn:aws:s3:::shelcaster-media-bucket"
      ]
    }
  ]
}
"@

$policyDocument | Out-File -FilePath ivs-policy.json -Encoding utf8

# Create or update the policy
$policyArn = "arn:aws:iam::${ACCOUNT_ID}:policy/LambdaIVSPolicy"
$policyExists = aws iam get-policy --policy-arn $policyArn --profile $PROFILE 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Policy exists, creating new version..." -ForegroundColor Yellow
    aws iam create-policy-version --policy-arn $policyArn --policy-document file://ivs-policy.json --set-as-default --profile $PROFILE --no-cli-pager | Out-Null
} else {
    Write-Host "  Creating new policy..." -ForegroundColor Yellow
    aws iam create-policy --policy-name LambdaIVSPolicy --policy-document file://ivs-policy.json --profile $PROFILE --no-cli-pager | Out-Null
}

# Attach policy to role
Write-Host "  Attaching policy to role..." -ForegroundColor Yellow
aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn $policyArn --profile $PROFILE 2>&1 | Out-Null

Remove-Item ivs-policy.json

# Step 2: Create API Gateway route
Write-Host "`n[2/2] Creating API Gateway route..." -ForegroundColor Green

# Get Lambda ARN
$LAMBDA_ARN = aws lambda get-function --function-name shelcaster-create-ivs-channel --profile $PROFILE --region $REGION --query "Configuration.FunctionArn" --output text

# Create integration
Write-Host "  Creating integration..." -ForegroundColor Yellow
$INTEGRATION_ID = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $LAMBDA_ARN --payload-format-version 2.0 --profile $PROFILE --region $REGION --query "IntegrationId" --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Integration may already exist, trying to find it..." -ForegroundColor Yellow
    $integrations = aws apigatewayv2 get-integrations --api-id $API_ID --profile $PROFILE --region $REGION --query "Items[?IntegrationUri=='$LAMBDA_ARN'].IntegrationId" --output text
    if ($integrations) {
        $INTEGRATION_ID = $integrations
        Write-Host "  Found existing integration: $INTEGRATION_ID" -ForegroundColor Yellow
    }
}

# Create route
Write-Host "  Creating route..." -ForegroundColor Yellow
aws apigatewayv2 create-route --api-id $API_ID --route-key "POST /shows/{showId}/ivs-channel" --target "integrations/$INTEGRATION_ID" --authorization-type JWT --authorizer-id $AUTHORIZER_ID --profile $PROFILE --region $REGION --no-cli-pager 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Route may already exist" -ForegroundColor Yellow
}

# Add Lambda permission
Write-Host "  Adding Lambda permission..." -ForegroundColor Yellow
aws lambda add-permission --function-name shelcaster-create-ivs-channel --statement-id apigateway-create-ivs-channel --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/shows/*/ivs-channel" --profile $PROFILE --region $REGION 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Permission may already exist" -ForegroundColor Yellow
}

Write-Host "`nSetup complete!" -ForegroundColor Green
Write-Host "`nAPI Endpoint:" -ForegroundColor Yellow
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/ivs-channel" -ForegroundColor Cyan

