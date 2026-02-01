$API_ID = "td0dn99gi2"
$REGION = "us-east-1"
$PROFILE = "shelcaster-admin"
$ACCOUNT_ID = "124355640062"

Write-Host "Adding Broadcast API routes..." -ForegroundColor Cyan

# Get Lambda function ARNs
Write-Host "`nGetting Lambda function ARNs..." -ForegroundColor Yellow
$START_BROADCAST_ARN = aws lambda get-function --function-name shelcaster-start-broadcast --profile $PROFILE --region $REGION --query 'Configuration.FunctionArn' --output text
$STOP_BROADCAST_ARN = aws lambda get-function --function-name shelcaster-stop-broadcast --profile $PROFILE --region $REGION --query 'Configuration.FunctionArn' --output text
$START_COMPOSITION_ARN = aws lambda get-function --function-name shelcaster-start-composition --profile $PROFILE --region $REGION --query 'Configuration.FunctionArn' --output text

Write-Host "  shelcaster-start-broadcast: $START_BROADCAST_ARN" -ForegroundColor Green
Write-Host "  shelcaster-stop-broadcast: $STOP_BROADCAST_ARN" -ForegroundColor Green
Write-Host "  shelcaster-start-composition: $START_COMPOSITION_ARN" -ForegroundColor Green

# Create integrations
Write-Host "`nCreating API Gateway integrations..." -ForegroundColor Yellow

# Start Broadcast Integration
Write-Host "  Creating start-broadcast integration..." -ForegroundColor Cyan
$START_BROADCAST_INTEGRATION = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $START_BROADCAST_ARN --payload-format-version 2.0 --profile $PROFILE --region $REGION --query 'IntegrationId' --output text
Write-Host "    Integration ID: $START_BROADCAST_INTEGRATION" -ForegroundColor Green

# Stop Broadcast Integration
Write-Host "  Creating stop-broadcast integration..." -ForegroundColor Cyan
$STOP_BROADCAST_INTEGRATION = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $STOP_BROADCAST_ARN --payload-format-version 2.0 --profile $PROFILE --region $REGION --query 'IntegrationId' --output text
Write-Host "    Integration ID: $STOP_BROADCAST_INTEGRATION" -ForegroundColor Green

# Start Composition Integration
Write-Host "  Creating start-composition integration..." -ForegroundColor Cyan
$START_COMPOSITION_INTEGRATION = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $START_COMPOSITION_ARN --payload-format-version 2.0 --profile $PROFILE --region $REGION --query 'IntegrationId' --output text
Write-Host "    Integration ID: $START_COMPOSITION_INTEGRATION" -ForegroundColor Green

# Create routes
Write-Host "`nCreating API Gateway routes..." -ForegroundColor Yellow

# Start Broadcast Route
Write-Host "  Creating POST /shows/{showId}/start-broadcast route..." -ForegroundColor Cyan
$START_BROADCAST_ROUTE = aws apigatewayv2 create-route --api-id $API_ID --route-key "POST /shows/{showId}/start-broadcast" --target "integrations/$START_BROADCAST_INTEGRATION" --authorization-type JWT --authorizer-id hnk3sf --profile $PROFILE --region $REGION --query 'RouteId' --output text
Write-Host "    Route ID: $START_BROADCAST_ROUTE" -ForegroundColor Green

# Stop Broadcast Route
Write-Host "  Creating POST /shows/{showId}/stop-broadcast route..." -ForegroundColor Cyan
$STOP_BROADCAST_ROUTE = aws apigatewayv2 create-route --api-id $API_ID --route-key "POST /shows/{showId}/stop-broadcast" --target "integrations/$STOP_BROADCAST_INTEGRATION" --authorization-type JWT --authorizer-id hnk3sf --profile $PROFILE --region $REGION --query 'RouteId' --output text
Write-Host "    Route ID: $STOP_BROADCAST_ROUTE" -ForegroundColor Green

# Start Composition Route
Write-Host "  Creating POST /shows/{showId}/start-composition route..." -ForegroundColor Cyan
$START_COMPOSITION_ROUTE = aws apigatewayv2 create-route --api-id $API_ID --route-key "POST /shows/{showId}/start-composition" --target "integrations/$START_COMPOSITION_INTEGRATION" --authorization-type JWT --authorizer-id hnk3sf --profile $PROFILE --region $REGION --query 'RouteId' --output text
Write-Host "    Route ID: $START_COMPOSITION_ROUTE" -ForegroundColor Green

# Add Lambda permissions
Write-Host "`nAdding Lambda permissions..." -ForegroundColor Yellow

Write-Host "  Adding permission for start-broadcast..." -ForegroundColor Cyan
aws lambda add-permission --function-name shelcaster-start-broadcast --statement-id apigateway-start-broadcast --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/shows/*/start-broadcast" --profile $PROFILE --region $REGION 2>&1 | Out-Null

Write-Host "  Adding permission for stop-broadcast..." -ForegroundColor Cyan
aws lambda add-permission --function-name shelcaster-stop-broadcast --statement-id apigateway-stop-broadcast --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/shows/*/stop-broadcast" --profile $PROFILE --region $REGION 2>&1 | Out-Null

Write-Host "  Adding permission for start-composition..." -ForegroundColor Cyan
aws lambda add-permission --function-name shelcaster-start-composition --statement-id apigateway-start-composition --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/shows/*/start-composition" --profile $PROFILE --region $REGION 2>&1 | Out-Null

Write-Host "`n✅ Broadcast routes created successfully!" -ForegroundColor Green
Write-Host "`nAPI Endpoints:" -ForegroundColor Yellow
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/start-broadcast" -ForegroundColor Cyan
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/stop-broadcast" -ForegroundColor Cyan
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/start-composition" -ForegroundColor Cyan

