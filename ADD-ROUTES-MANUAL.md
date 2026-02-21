# Manual Route Addition Guide

The persistent channels API routes need to be added to the existing API Gateway.

## Quick Fix

Run this PowerShell command to add all routes at once:

```powershell
cd shelcaster-functions

# Set execution policy for this session
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Run the script
.\add-persistent-channels-routes.ps1
```

## Alternative: Add Routes One by One

If the script doesn't work, add each route manually:

### 1. Create Persistent Channel
```powershell
$API_ID = "td0dn99gi2"
$REGION = "us-east-1"
$FUNCTION = "shelcaster-create-persistent-channel"

$functionArn = aws lambda get-function --function-name $FUNCTION --region $REGION --query 'Configuration.FunctionArn' --output text

$integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text

aws apigatewayv2 create-route --api-id $API_ID --route-key "POST /admin/channels" --target "integrations/$integrationId" --region $REGION

aws lambda add-permission --function-name $FUNCTION --statement-id "apigateway-$FUNCTION-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:124355640062:${API_ID}/*/*" --region $REGION
```

### 2. List Channels
```powershell
$FUNCTION = "shelcaster-list-channels"
$functionArn = aws lambda get-function --function-name $FUNCTION --region $REGION --query 'Configuration.FunctionArn' --output text
$integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /admin/channels" --target "integrations/$integrationId" --region $REGION
aws lambda add-permission --function-name $FUNCTION --statement-id "apigateway-$FUNCTION-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:124355640062:${API_ID}/*/*" --region $REGION
```

### 3. Assign Channel
```powershell
$FUNCTION = "shelcaster-assign-channel"
$functionArn = aws lambda get-function --function-name $FUNCTION --region $REGION --query 'Configuration.FunctionArn' --output text
$integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
aws apigatewayv2 create-route --api-id $API_ID --route-key "POST /admin/channels/{channelId}/assign" --target "integrations/$integrationId" --region $REGION
aws lambda add-permission --function-name $FUNCTION --statement-id "apigateway-$FUNCTION-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:124355640062:${API_ID}/*/*" --region $REGION
```

### 4. Unassign Channel
```powershell
$FUNCTION = "shelcaster-unassign-channel"
$functionArn = aws lambda get-function --function-name $FUNCTION --region $REGION --query 'Configuration.FunctionArn' --output text
$integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
aws apigatewayv2 create-route --api-id $API_ID --route-key "DELETE /admin/channels/{channelId}/assign/{hostUserId}" --target "integrations/$integrationId" --region $REGION
aws lambda add-permission --function-name $FUNCTION --statement-id "apigateway-$FUNCTION-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:124355640062:${API_ID}/*/*" --region $REGION
```

### 5. Get Channel Stats
```powershell
$FUNCTION = "shelcaster-get-channel-stats"
$functionArn = aws lambda get-function --function-name $FUNCTION --region $REGION --query 'Configuration.FunctionArn' --output text
$integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /admin/channels/{channelId}/stats" --target "integrations/$integrationId" --region $REGION
aws lambda add-permission --function-name $FUNCTION --statement-id "apigateway-$FUNCTION-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:124355640062:${API_ID}/*/*" --region $REGION
```

### 6. Update Channel State
```powershell
$FUNCTION = "shelcaster-update-channel-state"
$functionArn = aws lambda get-function --function-name $FUNCTION --region $REGION --query 'Configuration.FunctionArn' --output text
$integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
aws apigatewayv2 create-route --api-id $API_ID --route-key "PUT /admin/channels/{channelId}/state" --target "integrations/$integrationId" --region $REGION
aws lambda add-permission --function-name $FUNCTION --statement-id "apigateway-$FUNCTION-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:124355640062:${API_ID}/*/*" --region $REGION
```

### 7. Get Channel Capacity
```powershell
$FUNCTION = "shelcaster-get-channel-capacity"
$functionArn = aws lambda get-function --function-name $FUNCTION --region $REGION --query 'Configuration.FunctionArn' --output text
$integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /admin/channels/capacity" --target "integrations/$integrationId" --region $REGION
aws lambda add-permission --function-name $FUNCTION --statement-id "apigateway-$FUNCTION-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:124355640062:${API_ID}/*/*" --region $REGION
```

### 8. Get Host Channel
```powershell
$FUNCTION = "shelcaster-get-host-channel"
$functionArn = aws lambda get-function --function-name $FUNCTION --region $REGION --query 'Configuration.FunctionArn' --output text
$integrationId = aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri $functionArn --payload-format-version 2.0 --region $REGION --query 'IntegrationId' --output text
aws apigatewayv2 create-route --api-id $API_ID --route-key "GET /hosts/{hostUserId}/channel" --target "integrations/$integrationId" --region $REGION
aws lambda add-permission --function-name $FUNCTION --statement-id "apigateway-$FUNCTION-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:124355640062:${API_ID}/*/*" --region $REGION
```

## Verify Routes

After adding all routes, verify they exist:

```powershell
aws apigatewayv2 get-routes --api-id td0dn99gi2 --region us-east-1 --query 'Items[?contains(RouteKey, `admin/channels`) || contains(RouteKey, `hosts`)].RouteKey' --output table
```

You should see:
- POST /admin/channels
- GET /admin/channels
- POST /admin/channels/{channelId}/assign
- DELETE /admin/channels/{channelId}/assign/{hostUserId}
- GET /admin/channels/{channelId}/stats
- PUT /admin/channels/{channelId}/state
- GET /admin/channels/capacity
- GET /hosts/{hostUserId}/channel

## Test the API

```powershell
# Test capacity endpoint
Invoke-RestMethod -Uri "https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/admin/channels/capacity" -Method Get
```

If this works, your routes are configured correctly!
