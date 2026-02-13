#!/usr/bin/env pwsh

# Add API Gateway routes for MediaLive functions

$ErrorActionPreference = "Stop"
$profile = "shelcaster-admin"
$region = "us-east-1"
$apiId = "td0dn99gi2"
$accountId = "124355640062"

Write-Host "Adding MediaLive API Gateway routes..." -ForegroundColor Cyan

function Add-Route {
    param(
        [string]$RouteKey,
        [string]$FunctionName
    )
    
    Write-Host "`nAdding route: $RouteKey" -ForegroundColor Yellow
    
    # Create integration
    $integrationId = aws apigatewayv2 create-integration `
        --api-id $apiId `
        --integration-type AWS_PROXY `
        --integration-uri "arn:aws:lambda:${region}:${accountId}:function:${FunctionName}" `
        --payload-format-version 2.0 `
        --profile $profile `
        --region $region `
        --query 'IntegrationId' `
        --output text
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to create integration" -ForegroundColor Red
        return
    }
    
    # Create route
    aws apigatewayv2 create-route `
        --api-id $apiId `
        --route-key $RouteKey `
        --target "integrations/$integrationId" `
        --authorization-type JWT `
        --authorizer-id "kgzok8" `
        --profile $profile `
        --region $region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Route added: $RouteKey" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to add route" -ForegroundColor Red
    }
    
    # Add Lambda permission
    aws lambda add-permission `
        --function-name $FunctionName `
        --statement-id "apigateway-${FunctionName}-$(Get-Random)" `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:${region}:${accountId}:${apiId}/*" `
        --profile $profile `
        --region $region 2>$null
}

# Add routes
Add-Route "POST /sessions/{sessionId}/medialive" "shelcaster-create-medialive-channel"
Add-Route "POST /sessions/{sessionId}/streaming/start" "shelcaster-start-streaming"
Add-Route "POST /sessions/{sessionId}/streaming/stop" "shelcaster-stop-streaming"
Add-Route "POST /sessions/{sessionId}/recording/start" "shelcaster-start-recording"
Add-Route "POST /sessions/{sessionId}/recording/stop" "shelcaster-stop-recording"

Write-Host "`n✓ All routes added successfully!" -ForegroundColor Green
Write-Host "`nAPI Endpoints:" -ForegroundColor Cyan
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/medialive"
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/streaming/start"
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/streaming/stop"
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/recording/start"
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/recording/stop"
