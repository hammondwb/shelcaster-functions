# Add API Gateway route for participant compositions

$API_ID = "td0dn99gi2"
$FUNCTION_NAME = "shelcaster-create-participant-compositions"
$ACCOUNT_ID = "124355640062"

Write-Host "Adding API Gateway route for compositions" -ForegroundColor Cyan

# Create integration
Write-Host "`nCreating integration..." -ForegroundColor Yellow

$integration = aws apigatewayv2 create-integration `
  --api-id $API_ID `
  --integration-type AWS_PROXY `
  --integration-uri "arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:${FUNCTION_NAME}" `
  --payload-format-version 2.0 `
  --profile shelcaster-admin `
  --region us-east-1 `
  --output json | ConvertFrom-Json

$INTEGRATION_ID = $integration.IntegrationId

Write-Host "Integration ID: $INTEGRATION_ID" -ForegroundColor Yellow

# Create route
Write-Host "`nCreating route..." -ForegroundColor Yellow

aws apigatewayv2 create-route `
  --api-id $API_ID `
  --route-key "POST /sessions/{sessionId}/compositions" `
  --target "integrations/$INTEGRATION_ID" `
  --profile shelcaster-admin `
  --region us-east-1

# Add Lambda permission
Write-Host "`nAdding Lambda permission..." -ForegroundColor Yellow

aws lambda add-permission `
  --function-name $FUNCTION_NAME `
  --statement-id apigateway-invoke `
  --action lambda:InvokeFunction `
  --principal apigateway.amazonaws.com `
  --source-arn "arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/*" `
  --profile shelcaster-admin `
  --region us-east-1

Write-Host "`n✅ API Gateway route added!" -ForegroundColor Green
Write-Host "Endpoint: POST https://${API_ID}.execute-api.us-east-1.amazonaws.com/sessions/{sessionId}/compositions" -ForegroundColor Cyan
