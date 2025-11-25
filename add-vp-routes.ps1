$API_ID = "td0dn99gi2"
$REGION = "us-east-1"
$PROFILE = "shelcaster-admin"
$ACCOUNT_ID = "124355640062"

Write-Host "Adding Virtual Participant API routes..." -ForegroundColor Cyan

# Get Lambda function ARNs
Write-Host "`nGetting Lambda function ARNs..." -ForegroundColor Yellow
$INVITE_FUNCTION_ARN = aws lambda get-function --function-name shelcaster-invite-virtual-participant --profile $PROFILE --region $REGION --query 'Configuration.FunctionArn' --output text
$CONTROL_FUNCTION_ARN = aws lambda get-function --function-name shelcaster-control-virtual-participant --profile $PROFILE --region $REGION --query 'Configuration.FunctionArn' --output text

Write-Host "Invite Function ARN: $INVITE_FUNCTION_ARN" -ForegroundColor Gray
Write-Host "Control Function ARN: $CONTROL_FUNCTION_ARN" -ForegroundColor Gray

# Create integration for shelcaster-invite-virtual-participant
Write-Host "`nCreating integration for invite-virtual-participant..." -ForegroundColor Yellow
$INVITE_INTEGRATION_ID = aws apigatewayv2 create-integration `
    --api-id $API_ID `
    --integration-type AWS_PROXY `
    --integration-uri $INVITE_FUNCTION_ARN `
    --payload-format-version 2.0 `
    --profile $PROFILE `
    --region $REGION `
    --query 'IntegrationId' `
    --output text

Write-Host "Integration ID: $INVITE_INTEGRATION_ID" -ForegroundColor Gray

# Create route for invite-virtual-participant
Write-Host "Creating route POST /shows/{showId}/virtual-participant/invite..." -ForegroundColor Yellow
aws apigatewayv2 create-route `
    --api-id $API_ID `
    --route-key "POST /shows/{showId}/virtual-participant/invite" `
    --target "integrations/$INVITE_INTEGRATION_ID" `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager | Out-Null

# Create integration for shelcaster-control-virtual-participant
Write-Host "`nCreating integration for control-virtual-participant..." -ForegroundColor Yellow
$CONTROL_INTEGRATION_ID = aws apigatewayv2 create-integration `
    --api-id $API_ID `
    --integration-type AWS_PROXY `
    --integration-uri $CONTROL_FUNCTION_ARN `
    --payload-format-version 2.0 `
    --profile $PROFILE `
    --region $REGION `
    --query 'IntegrationId' `
    --output text

Write-Host "Integration ID: $CONTROL_INTEGRATION_ID" -ForegroundColor Gray

# Create route for control-virtual-participant (POST)
Write-Host "Creating route POST /shows/{showId}/virtual-participant/control..." -ForegroundColor Yellow
aws apigatewayv2 create-route `
    --api-id $API_ID `
    --route-key "POST /shows/{showId}/virtual-participant/control" `
    --target "integrations/$CONTROL_INTEGRATION_ID" `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager | Out-Null

# Create route for control-virtual-participant (GET - status check)
Write-Host "Creating route GET /shows/{showId}/virtual-participant/status..." -ForegroundColor Yellow
aws apigatewayv2 create-route `
    --api-id $API_ID `
    --route-key "GET /shows/{showId}/virtual-participant/status" `
    --target "integrations/$CONTROL_INTEGRATION_ID" `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager | Out-Null

# Grant API Gateway permission to invoke the Lambda functions
Write-Host "`nGranting API Gateway permissions..." -ForegroundColor Yellow
$SOURCE_ARN = "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*"

aws lambda add-permission `
    --function-name shelcaster-invite-virtual-participant `
    --statement-id apigateway-invoke-vp-invite `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn $SOURCE_ARN `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager 2>$null | Out-Null

aws lambda add-permission `
    --function-name shelcaster-control-virtual-participant `
    --statement-id apigateway-invoke-vp-control `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn $SOURCE_ARN `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager 2>$null | Out-Null

Write-Host "`nAPI routes added successfully!" -ForegroundColor Green
Write-Host "Routes available:" -ForegroundColor Cyan
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/virtual-participant/invite" -ForegroundColor Gray
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/virtual-participant/control" -ForegroundColor Gray

