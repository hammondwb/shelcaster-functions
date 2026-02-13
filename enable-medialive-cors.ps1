# Enable CORS for MediaLive Routes
$API_ID = "td0dn99gi2"
$REGION = "us-east-1"

Write-Host "Enabling CORS for MediaLive Routes..." -ForegroundColor Cyan
Write-Host ""

# Route IDs from the query
$routes = @(
    @{Id="3a2c7lp"; Key="POST /sessions/{sessionId}/streaming/start"},
    @{Id="m0xpcb1"; Key="POST /sessions/{sessionId}/streaming/stop"},
    @{Id="9h3znvl"; Key="POST /sessions/{sessionId}/recording/start"},
    @{Id="436myua"; Key="POST /sessions/{sessionId}/recording/stop"},
    @{Id="iw12wgm"; Key="POST /shows/{showId}/medialive-channel"}
)

foreach ($route in $routes) {
    Write-Host "Updating: $($route.Key)" -ForegroundColor Yellow
    
    aws apigatewayv2 update-route `
        --api-id $API_ID `
        --route-id $route.Id `
        --region $REGION `
        --cors-configuration "AllowOrigins=*,AllowHeaders=*,AllowMethods=POST,OPTIONS,MaxAge=300" `
        --output text | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  CORS enabled" -ForegroundColor Green
    } else {
        Write-Host "  Failed" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done! CORS enabled on all MediaLive routes." -ForegroundColor Green
Write-Host "Changes are live immediately (no deployment needed for HTTP API)" -ForegroundColor Cyan
