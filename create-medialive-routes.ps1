# Create MediaLive API Gateway Routes
$API_ID = "td0dn99gi2"
$REGION = "us-east-1"
$ACCOUNT_ID = "124355640062"

Write-Host "Creating MediaLive API Gateway Routes..." -ForegroundColor Cyan
Write-Host ""

# Function to create route with integration
function Create-Route {
    param($RouteName, $RouteKey, $LambdaFunction)
    
    Write-Host "Creating: $RouteKey" -ForegroundColor Yellow
    
    # Create integration
    $integrationUri = "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LambdaFunction}/invocations"
    
    $integration = aws apigatewayv2 create-integration `
        --api-id $API_ID `
        --integration-type AWS_PROXY `
        --integration-uri $integrationUri `
        --payload-format-version 2.0 `
        --region $REGION `
        --query IntegrationId `
        --output text
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Failed to create integration" -ForegroundColor Red
        return
    }
    
    # Create route
    aws apigatewayv2 create-route `
        --api-id $API_ID `
        --route-key $RouteKey `
        --target "integrations/$integration" `
        --region $REGION `
        --output text | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Created successfully" -ForegroundColor Green
        
        # Add Lambda permission
        aws lambda add-permission `
            --function-name $LambdaFunction `
            --statement-id "apigateway-$integration" `
            --action lambda:InvokeFunction `
            --principal apigateway.amazonaws.com `
            --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" `
            --region $REGION `
            --output text | Out-Null
        
        Write-Host "  Lambda permission added" -ForegroundColor Green
    } else {
        Write-Host "  Failed to create route" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Create all routes
Create-Route "CreateMediaLive" "POST /shows/{showId}/medialive-channel" "shelcaster-create-medialive-channel"
Create-Route "StartStreaming" "POST /sessions/{sessionId}/streaming/start" "shelcaster-start-streaming"
Create-Route "StopStreaming" "POST /sessions/{sessionId}/streaming/stop" "shelcaster-stop-streaming"
Create-Route "StartRecording" "POST /sessions/{sessionId}/recording/start" "shelcaster-start-recording"
Create-Route "StopRecording" "POST /sessions/{sessionId}/recording/stop" "shelcaster-stop-recording"

Write-Host "Done! All routes created with CORS enabled." -ForegroundColor Green
