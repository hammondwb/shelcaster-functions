# Simple script to add persistent channels routes one at a time
# Run this in PowerShell

$API_ID = "td0dn99gi2"
$REGION = "us-east-1"
$ACCOUNT_ID = "124355640062"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Adding Persistent Channels API Routes" -ForegroundColor Cyan
Write-Host "API Gateway: $API_ID" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Route 1: POST /admin/channels (Create Channel)
Write-Host "1. Creating route: POST /admin/channels" -ForegroundColor Yellow
try {
    $functionArn = aws lambda get-function --function-name shelcaster-create-persistent-channel --region $REGION --query 'Configuration.FunctionArn' --output text
    $integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
    aws apigatewayv2 create-route --api-id $API_ID --route-key "POST /admin/channels" --target "integrations/$integrationId" --region $REGION | Out-Null
    aws lambda add-permission --function-name shelcaster-create-persistent-channel --statement-id "apigateway-create-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" --region $REGION 2>$null | Out-Null
    Write-Host "   ✓ Success" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error: $_" -ForegroundColor Red
}

# Route 2: GET /admin/channels (List Channels)
Write-Host "2. Creating route: GET /admin/channels" -ForegroundColor Yellow
try {
    $functionArn = aws lambda get-function --function-name shelcaster-list-channels --region $REGION --query 'Configuration.FunctionArn' --output text
    $integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
    aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /admin/channels" --target "integrations/$integrationId" --region $REGION | Out-Null
    aws lambda add-permission --function-name shelcaster-list-channels --statement-id "apigateway-list-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" --region $REGION 2>$null | Out-Null
    Write-Host "   ✓ Success" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error: $_" -ForegroundColor Red
}

# Route 3: POST /admin/channels/{channelId}/assign (Assign Channel)
Write-Host "3. Creating route: POST /admin/channels/{channelId}/assign" -ForegroundColor Yellow
try {
    $functionArn = aws lambda get-function --function-name shelcaster-assign-channel --region $REGION --query 'Configuration.FunctionArn' --output text
    $integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
    aws apigatewayv2 create-route --api-id $API_ID --route-key "POST /admin/channels/{channelId}/assign" --target "integrations/$integrationId" --region $REGION | Out-Null
    aws lambda add-permission --function-name shelcaster-assign-channel --statement-id "apigateway-assign-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" --region $REGION 2>$null | Out-Null
    Write-Host "   ✓ Success" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error: $_" -ForegroundColor Red
}

# Route 4: DELETE /admin/channels/{channelId}/assign/{hostUserId} (Unassign Channel)
Write-Host "4. Creating route: DELETE /admin/channels/{channelId}/assign/{hostUserId}" -ForegroundColor Yellow
try {
    $functionArn = aws lambda get-function --function-name shelcaster-unassign-channel --region $REGION --query 'Configuration.FunctionArn' --output text
    $integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
    aws apigatewayv2 create-route --api-id $API_ID --route-key "DELETE /admin/channels/{channelId}/assign/{hostUserId}" --target "integrations/$integrationId" --region $REGION | Out-Null
    aws lambda add-permission --function-name shelcaster-unassign-channel --statement-id "apigateway-unassign-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" --region $REGION 2>$null | Out-Null
    Write-Host "   ✓ Success" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error: $_" -ForegroundColor Red
}

# Route 5: GET /admin/channels/{channelId}/stats (Get Channel Stats)
Write-Host "5. Creating route: GET /admin/channels/{channelId}/stats" -ForegroundColor Yellow
try {
    $functionArn = aws lambda get-function --function-name shelcaster-get-channel-stats --region $REGION --query 'Configuration.FunctionArn' --output text
    $integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
    aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /admin/channels/{channelId}/stats" --target "integrations/$integrationId" --region $REGION | Out-Null
    aws lambda add-permission --function-name shelcaster-get-channel-stats --statement-id "apigateway-stats-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" --region $REGION 2>$null | Out-Null
    Write-Host "   ✓ Success" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error: $_" -ForegroundColor Red
}

# Route 6: PUT /admin/channels/{channelId}/state (Update Channel State)
Write-Host "6. Creating route: PUT /admin/channels/{channelId}/state" -ForegroundColor Yellow
try {
    $functionArn = aws lambda get-function --function-name shelcaster-update-channel-state --region $REGION --query 'Configuration.FunctionArn' --output text
    $integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
    aws apigatewayv2 create-route --api-id $API_ID --route-key "PUT /admin/channels/{channelId}/state" --target "integrations/$integrationId" --region $REGION | Out-Null
    aws lambda add-permission --function-name shelcaster-update-channel-state --statement-id "apigateway-state-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" --region $REGION 2>$null | Out-Null
    Write-Host "   ✓ Success" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error: $_" -ForegroundColor Red
}

# Route 7: GET /admin/channels/capacity (Get Channel Capacity)
Write-Host "7. Creating route: GET /admin/channels/capacity" -ForegroundColor Yellow
try {
    $functionArn = aws lambda get-function --function-name shelcaster-get-channel-capacity --region $REGION --query 'Configuration.FunctionArn' --output text
    $integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
    aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /admin/channels/capacity" --target "integrations/$integrationId" --region $REGION | Out-Null
    aws lambda add-permission --function-name shelcaster-get-channel-capacity --statement-id "apigateway-capacity-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" --region $REGION 2>$null | Out-Null
    Write-Host "   ✓ Success" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error: $_" -ForegroundColor Red
}

# Route 8: GET /hosts/{hostUserId}/channel (Get Host Channel)
Write-Host "8. Creating route: GET /hosts/{hostUserId}/channel" -ForegroundColor Yellow
try {
    $functionArn = aws lambda get-function --function-name shelcaster-get-host-channel --region $REGION --query 'Configuration.FunctionArn' --output text
    $integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
    aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /hosts/{hostUserId}/channel" --target "integrations/$integrationId" --region $REGION | Out-Null
    aws lambda add-permission --function-name shelcaster-get-host-channel --statement-id "apigateway-hostchannel-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" --region $REGION 2>$null | Out-Null
    Write-Host "   ✓ Success" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "API Base URL: https://$API_ID.execute-api.$REGION.amazonaws.com" -ForegroundColor Green
Write-Host ""
Write-Host "Test with:" -ForegroundColor Yellow
Write-Host "Invoke-RestMethod -Uri 'https://$API_ID.execute-api.$REGION.amazonaws.com/admin/channels/capacity' -Method Get" -ForegroundColor Gray
