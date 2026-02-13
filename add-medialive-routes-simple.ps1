$profile = "shelcaster-admin"
$region = "us-east-1"
$apiId = "td0dn99gi2"
$accountId = "124355640062"

Write-Host "Adding MediaLive API Gateway routes..." -ForegroundColor Cyan

$routes = @(
    @{Key="POST /sessions/{sessionId}/medialive"; Function="shelcaster-create-medialive-channel"},
    @{Key="POST /sessions/{sessionId}/streaming/start"; Function="shelcaster-start-streaming"},
    @{Key="POST /sessions/{sessionId}/streaming/stop"; Function="shelcaster-stop-streaming"},
    @{Key="POST /sessions/{sessionId}/recording/start"; Function="shelcaster-start-recording"},
    @{Key="POST /sessions/{sessionId}/recording/stop"; Function="shelcaster-stop-recording"}
)

foreach ($route in $routes) {
    Write-Host "`nAdding route: $($route.Key)" -ForegroundColor Yellow
    
    $integrationId = aws apigatewayv2 create-integration --api-id $apiId --integration-type AWS_PROXY --integration-uri "arn:aws:lambda:${region}:${accountId}:function:$($route.Function)" --payload-format-version 2.0 --profile $profile --region $region --query 'IntegrationId' --output text
    
    aws apigatewayv2 create-route --api-id $apiId --route-key $route.Key --target "integrations/$integrationId" --authorization-type JWT --authorizer-id "kgzok8" --profile $profile --region $region
    
    aws lambda add-permission --function-name $route.Function --statement-id "apigateway-$($route.Function)-$(Get-Random)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${region}:${accountId}:${apiId}/*" --profile $profile --region $region 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Route added" -ForegroundColor Green
    }
}

Write-Host "`n[OK] All routes added!" -ForegroundColor Green
Write-Host "`nAPI Endpoints:" -ForegroundColor Cyan
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/medialive"
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/streaming/start"
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/streaming/stop"
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/recording/start"
Write-Host "POST https://${apiId}.execute-api.${region}.amazonaws.com/sessions/{sessionId}/recording/stop"
