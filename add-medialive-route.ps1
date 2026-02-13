# Add API Gateway route for MediaLive channel creation

$API_ID = "td0dn99gi2"
$FUNCTION_NAME = "shelcaster-create-medialive-dynamic"
$ACCOUNT_ID = "124355640062"

Write-Host "Adding API Gateway route for MediaLive" -ForegroundColor Cyan

$integration = aws apigatewayv2 create-integration `
  --api-id $API_ID `
  --integration-type AWS_PROXY `
  --integration-uri "arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:${FUNCTION_NAME}" `
  --payload-format-version 2.0 `
  --profile shelcaster-admin `
  --region us-east-1 `
  --output json | ConvertFrom-Json

$INTEGRATION_ID = $integration.IntegrationId

aws apigatewayv2 create-route `
  --api-id $API_ID `
  --route-key "POST /sessions/{sessionId}/medialive" `
  --target "integrations/$INTEGRATION_ID" `
  --profile shelcaster-admin `
  --region us-east-1

aws lambda add-permission `
  --function-name $FUNCTION_NAME `
  --statement-id apigateway-medialive `
  --action lambda:InvokeFunction `
  --principal apigateway.amazonaws.com `
  --source-arn "arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/*" `
  --profile shelcaster-admin `
  --region us-east-1 2>$null

Write-Host "`n✅ API Gateway route added!" -ForegroundColor Green
Write-Host "Endpoint: POST https://${API_ID}.execute-api.us-east-1.amazonaws.com/sessions/{sessionId}/medialive" -ForegroundColor Cyan
