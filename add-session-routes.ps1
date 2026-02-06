$API_ID = "td0dn99gi2"
$REGION = "us-east-1"
$PROFILE = "shelcaster-admin"
$ACCOUNT_ID = "124355640062"

Write-Host "Adding LiveSession API routes..." -ForegroundColor Cyan

# Get Lambda function ARNs
Write-Host "`nGetting Lambda function ARNs..." -ForegroundColor Yellow
$CREATE_SESSION_ARN = aws lambda get-function --function-name shelcaster-create-session --profile $PROFILE --region $REGION --query 'Configuration.FunctionArn' --output text
$SESSION_COMMAND_ARN = aws lambda get-function --function-name shelcaster-session-command --profile $PROFILE --region $REGION --query 'Configuration.FunctionArn' --output text

Write-Host "Create Session Function ARN: $CREATE_SESSION_ARN" -ForegroundColor Gray
Write-Host "Session Command Function ARN: $SESSION_COMMAND_ARN" -ForegroundColor Gray

# Create integration for shelcaster-create-session
Write-Host "`nCreating integration for create-session..." -ForegroundColor Yellow
$CREATE_SESSION_INTEGRATION_ID = aws apigatewayv2 create-integration `
    --api-id $API_ID `
    --integration-type AWS_PROXY `
    --integration-uri $CREATE_SESSION_ARN `
    --payload-format-version 2.0 `
    --profile $PROFILE `
    --region $REGION `
    --query 'IntegrationId' `
    --output text

Write-Host "Integration ID: $CREATE_SESSION_INTEGRATION_ID" -ForegroundColor Gray

# Create route for create-session
Write-Host "Creating route POST /sessions..." -ForegroundColor Yellow
aws apigatewayv2 create-route `
    --api-id $API_ID `
    --route-key "POST /sessions" `
    --target "integrations/$CREATE_SESSION_INTEGRATION_ID" `
    --authorization-type JWT `
    --authorizer-id "hnk3sf" `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager | Out-Null

# Create integration for shelcaster-session-command
Write-Host "`nCreating integration for session-command..." -ForegroundColor Yellow
$SESSION_COMMAND_INTEGRATION_ID = aws apigatewayv2 create-integration `
    --api-id $API_ID `
    --integration-type AWS_PROXY `
    --integration-uri $SESSION_COMMAND_ARN `
    --payload-format-version 2.0 `
    --profile $PROFILE `
    --region $REGION `
    --query 'IntegrationId' `
    --output text

Write-Host "Integration ID: $SESSION_COMMAND_INTEGRATION_ID" -ForegroundColor Gray

# Create route for session-command
Write-Host "Creating route POST /sessions/{sessionId}/commands..." -ForegroundColor Yellow
aws apigatewayv2 create-route `
    --api-id $API_ID `
    --route-key "POST /sessions/{sessionId}/commands" `
    --target "integrations/$SESSION_COMMAND_INTEGRATION_ID" `
    --authorization-type JWT `
    --authorizer-id "hnk3sf" `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager | Out-Null

# Grant API Gateway permission to invoke the Lambda functions
Write-Host "`nGranting API Gateway permissions..." -ForegroundColor Yellow
$SOURCE_ARN = "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*"

aws lambda add-permission `
    --function-name shelcaster-create-session `
    --statement-id apigateway-invoke-create-session `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn $SOURCE_ARN `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager 2>$null | Out-Null

aws lambda add-permission `
    --function-name shelcaster-session-command `
    --statement-id apigateway-invoke-session-command `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn $SOURCE_ARN `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager 2>$null | Out-Null

Write-Host "`nAPI routes added successfully!" -ForegroundColor Green
Write-Host "Routes available:" -ForegroundColor Cyan
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions" -ForegroundColor Gray
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/{sessionId}/commands" -ForegroundColor Gray

