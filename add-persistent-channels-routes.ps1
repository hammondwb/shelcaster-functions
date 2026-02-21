# Add API Gateway routes for Persistent IVS Channels
# This script creates HTTP API routes for all persistent channel Lambda functions

$ErrorActionPreference = "Stop"

$API_ID = "td0dn99gi2"  # shelcaster-app-api (existing API Gateway)
$REGION = "us-east-1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Adding Persistent Channels API Routes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Define routes
$routes = @(
    @{
        Path = "/admin/channels"
        Method = "POST"
        Function = "shelcaster-create-persistent-channel"
        Description = "Create persistent IVS channel"
    },
    @{
        Path = "/admin/channels"
        Method = "GET"
        Function = "shelcaster-list-channels"
        Description = "List all persistent channels"
    },
    @{
        Path = "/admin/channels/{channelId}/assign"
        Method = "POST"
        Function = "shelcaster-assign-channel"
        Description = "Assign channel to host"
    },
    @{
        Path = "/admin/channels/{channelId}/assign/{hostUserId}"
        Method = "DELETE"
        Function = "shelcaster-unassign-channel"
        Description = "Unassign channel from host"
    },
    @{
        Path = "/admin/channels/{channelId}/stats"
        Method = "GET"
        Function = "shelcaster-get-channel-stats"
        Description = "Get channel statistics"
    },
    @{
        Path = "/admin/channels/{channelId}/state"
        Method = "PUT"
        Function = "shelcaster-update-channel-state"
        Description = "Update channel state"
    },
    @{
        Path = "/admin/channels/capacity"
        Method = "GET"
        Function = "shelcaster-get-channel-capacity"
        Description = "Get channel capacity info"
    },
    @{
        Path = "/hosts/{hostUserId}/channel"
        Method = "GET"
        Function = "shelcaster-get-host-channel"
        Description = "Get host's assigned channel"
    }
)

$successCount = 0
$failCount = 0

foreach ($route in $routes) {
    Write-Host "Creating route: $($route.Method) $($route.Path)" -ForegroundColor Yellow
    Write-Host "  Function: $($route.Function)" -ForegroundColor Gray
    
    try {
        # Get Lambda function ARN
        $functionArn = aws lambda get-function `
            --function-name $route.Function `
            --region $REGION `
            --query 'Configuration.FunctionArn' `
            --output text
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to get function ARN"
        }
        
        # Create integration
        $integrationId = aws apigatewayv2 create-integration `
            --api-id $API_ID `
            --integration-type AWS_PROXY `
            --integration-uri $functionArn `
            --payload-format-version 2.0 `
            --region $REGION `
            --query 'IntegrationId' `
            --output text
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create integration"
        }
        
        # Create route
        $routeKey = "$($route.Method) $($route.Path)"
        aws apigatewayv2 create-route `
            --api-id $API_ID `
            --route-key $routeKey `
            --target "integrations/$integrationId" `
            --region $REGION | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create route"
        }
        
        # Grant API Gateway permission to invoke Lambda
        $statementId = "apigateway-$($route.Function)-$(Get-Random)"
        aws lambda add-permission `
            --function-name $route.Function `
            --statement-id $statementId `
            --action lambda:InvokeFunction `
            --principal apigateway.amazonaws.com `
            --source-arn "arn:aws:execute-api:${REGION}:124355640062:${API_ID}/*/*" `
            --region $REGION 2>$null | Out-Null
        
        Write-Host "  ✓ Route created successfully" -ForegroundColor Green
        $successCount++
        
    } catch {
        Write-Host "  ✗ Failed to create route: $_" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Route Creation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "All routes created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "API Base URL: https://$API_ID.execute-api.$REGION.amazonaws.com" -ForegroundColor Cyan
} else {
    Write-Host "Some routes failed to create. Check the output above." -ForegroundColor Yellow
}
