$API_ID = "td0dn99gi2"
$REGION = "us-east-1"
$PROFILE = "shelcaster-admin"
$ACCOUNT_ID = "124355640062"

Write-Host "Adding IVS Real-Time API routes..." -ForegroundColor Cyan

# Get Lambda function ARNs
Write-Host "`nGetting Lambda function ARNs..." -ForegroundColor Yellow
$STAGE_FUNCTION_ARN = aws lambda get-function --function-name shelcaster-create-stage --profile $PROFILE --region $REGION --query 'Configuration.FunctionArn' --output text
$CALLER_FUNCTION_ARN = aws lambda get-function --function-name shelcaster-create-caller-token --profile $PROFILE --region $REGION --query 'Configuration.FunctionArn' --output text

Write-Host "Stage Function ARN: $STAGE_FUNCTION_ARN" -ForegroundColor Gray
Write-Host "Caller Token Function ARN: $CALLER_FUNCTION_ARN" -ForegroundColor Gray

# Create integration for shelcaster-create-stage
Write-Host "`nCreating integration for create-stage..." -ForegroundColor Yellow
$STAGE_INTEGRATION_ID = aws apigatewayv2 create-integration `
    --api-id $API_ID `
    --integration-type AWS_PROXY `
    --integration-uri $STAGE_FUNCTION_ARN `
    --payload-format-version 2.0 `
    --profile $PROFILE `
    --region $REGION `
    --query 'IntegrationId' `
    --output text

Write-Host "Integration ID: $STAGE_INTEGRATION_ID" -ForegroundColor Gray

# Create route for create-stage
Write-Host "Creating route POST /shows/{showId}/stage..." -ForegroundColor Yellow
aws apigatewayv2 create-route `
    --api-id $API_ID `
    --route-key "POST /shows/{showId}/stage" `
    --target "integrations/$STAGE_INTEGRATION_ID" `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager | Out-Null

# Create integration for shelcaster-create-caller-token
Write-Host "`nCreating integration for create-caller-token..." -ForegroundColor Yellow
$CALLER_INTEGRATION_ID = aws apigatewayv2 create-integration `
    --api-id $API_ID `
    --integration-type AWS_PROXY `
    --integration-uri $CALLER_FUNCTION_ARN `
    --payload-format-version 2.0 `
    --profile $PROFILE `
    --region $REGION `
    --query 'IntegrationId' `
    --output text

Write-Host "Integration ID: $CALLER_INTEGRATION_ID" -ForegroundColor Gray

# Create route for create-caller-token
Write-Host "Creating route POST /shows/{showId}/caller-token..." -ForegroundColor Yellow
aws apigatewayv2 create-route `
    --api-id $API_ID `
    --route-key "POST /shows/{showId}/caller-token" `
    --target "integrations/$CALLER_INTEGRATION_ID" `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager | Out-Null

# Grant API Gateway permission to invoke the Lambda functions
Write-Host "`nGranting API Gateway permissions..." -ForegroundColor Yellow
$SOURCE_ARN = "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*"

aws lambda add-permission `
    --function-name shelcaster-create-stage `
    --statement-id apigateway-invoke-stage `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn $SOURCE_ARN `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager 2>$null | Out-Null

aws lambda add-permission `
    --function-name shelcaster-create-caller-token `
    --statement-id apigateway-invoke-caller `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn $SOURCE_ARN `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager 2>$null | Out-Null

Write-Host "`nAPI routes added successfully!" -ForegroundColor Green
Write-Host "Routes available:" -ForegroundColor Cyan
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/stage" -ForegroundColor Gray
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/caller-token" -ForegroundColor Gray

