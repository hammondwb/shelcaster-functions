# Add API Gateway Routes for Recording Endpoints
# This script creates the API Gateway routes for recording management

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$API_ID = "td0dn99gi2"
$AUTHORIZER_ID = "hnk3sf"
$ACCOUNT_ID = "124355640062"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Creating Recording API Gateway Routes" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

# Function to create integration and route
function Add-Route {
    param (
        [string]$RouteKey,
        [string]$FunctionName,
        [string]$Description
    )
    
    Write-Host "Creating route: $RouteKey" -ForegroundColor Cyan
    
    # Create integration
    $integrationId = aws apigatewayv2 create-integration `
        --api-id $API_ID `
        --integration-type AWS_PROXY `
        --integration-uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FunctionName}/invocations" `
        --payload-format-version 2.0 `
        --profile $PROFILE `
        --region $REGION `
        --query 'IntegrationId' `
        --output text
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Failed to create integration" -ForegroundColor Red
        return
    }
    
    # Create route
    aws apigatewayv2 create-route `
        --api-id $API_ID `
        --route-key $RouteKey `
        --target "integrations/$integrationId" `
        --authorization-type JWT `
        --authorizer-id $AUTHORIZER_ID `
        --profile $PROFILE `
        --region $REGION | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Failed to create route" -ForegroundColor Red
        return
    }
    
    # Add Lambda permission
    $sourceArn = "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*"
    aws lambda add-permission `
        --function-name $FunctionName `
        --statement-id "apigateway-$($RouteKey.Replace('/', '-').Replace('{', '').Replace('}', ''))" `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn $sourceArn `
        --profile $PROFILE `
        --region $REGION 2>&1 | Out-Null
    
    Write-Host "  ✅ Created $RouteKey" -ForegroundColor Green
}

# Add routes
Add-Route -RouteKey "GET /shows/{showId}/recordings" -FunctionName "shelcaster-get-recordings" -Description "Get recordings for a show"
Add-Route -RouteKey "GET /recordings" -FunctionName "shelcaster-get-recordings" -Description "Get recordings for a user"
Add-Route -RouteKey "POST /shows/{showId}/recordings" -FunctionName "shelcaster-save-recording" -Description "Start a new recording"
Add-Route -RouteKey "POST /shows/{showId}/recordings/{recordingId}" -FunctionName "shelcaster-save-recording" -Description "Update or stop a recording"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ All routes created successfully!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "API Endpoints:" -ForegroundColor Yellow
Write-Host "  GET  https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/recordings" -ForegroundColor Cyan
Write-Host "  GET  https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/recordings?userId={userId}" -ForegroundColor Cyan
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/recordings" -ForegroundColor Cyan
Write-Host "  POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/{showId}/recordings/{recordingId}" -ForegroundColor Cyan

