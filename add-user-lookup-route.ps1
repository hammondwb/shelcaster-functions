# Add user lookup route to API Gateway

$ErrorActionPreference = "Stop"

$API_ID = "td0dn99gi2"
$REGION = "us-east-1"
$ACCOUNT_ID = "124355640062"
$FUNCTION_NAME = "shelcaster-lookup-user-by-email"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Adding User Lookup Route" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Creating route: GET /admin/users/lookup" -ForegroundColor Yellow

try {
    # Get function ARN
    $functionArn = aws lambda get-function `
        --function-name $FUNCTION_NAME `
        --region $REGION `
        --query 'Configuration.FunctionArn' `
        --output text
    
    Write-Host "  Function ARN: $functionArn" -ForegroundColor Gray
    
    # Create integration
    $integrationId = aws apigatewayv2 create-integration `
        --api-id $API_ID `
        --integration-type AWS_PROXY `
        --integration-uri $functionArn `
        --payload-format-version 2.0 `
        --region $REGION `
        --query 'IntegrationId' `
        --output text
    
    Write-Host "  Integration ID: $integrationId" -ForegroundColor Gray
    
    # Create route
    aws apigatewayv2 create-route `
        --api-id $API_ID `
        --route-key "GET /admin/users/lookup" `
        --target "integrations/$integrationId" `
        --region $REGION | Out-Null
    
    Write-Host "  Route created" -ForegroundColor Gray
    
    # Grant permission
    $statementId = "apigateway-lookup-$(Get-Random)"
    aws lambda add-permission `
        --function-name $FUNCTION_NAME `
        --statement-id $statementId `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" `
        --region $REGION 2>$null | Out-Null
    
    Write-Host "  ✓ Success!" -ForegroundColor Green
    
} catch {
    Write-Host "  ✗ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test with:" -ForegroundColor Yellow
Write-Host "Invoke-RestMethod -Uri 'https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/admin/users/lookup?email=hammond@sheldonmedia.com' -Method Get" -ForegroundColor Gray
