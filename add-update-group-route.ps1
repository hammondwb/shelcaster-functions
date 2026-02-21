# Add update-group API route
$API_ID = "td0dn99gi2"
$REGION = "us-east-1"
$ACCOUNT_ID = "124355640062"
$LAMBDA_NAME = "shelcaster-update-group"

Write-Host "Adding update-group API route..." -ForegroundColor Cyan

# Get all resources
$resources = aws apigateway get-resources --rest-api-id $API_ID --region $REGION | ConvertFrom-Json

# Find the users resource
$usersResource = $resources.items | Where-Object { $_.pathPart -eq "users" }
if (-not $usersResource) {
    Write-Host "✗ users resource not found" -ForegroundColor Red
    exit 1
}

# Find the {userId} resource
$userIdResource = $resources.items | Where-Object { 
    $_.pathPart -eq "{userId}" -and $_.parentId -eq $usersResource.id 
}
if (-not $userIdResource) {
    Write-Host "✗ {userId} resource not found" -ForegroundColor Red
    exit 1
}

# Find or create groups resource
$groupsResource = $resources.items | Where-Object { 
    $_.pathPart -eq "groups" -and $_.parentId -eq $userIdResource.id 
}

if (-not $groupsResource) {
    Write-Host "Creating groups resource..." -ForegroundColor Yellow
    $groupsResource = aws apigateway create-resource `
        --rest-api-id $API_ID `
        --parent-id $userIdResource.id `
        --path-part "groups" `
        --region $REGION | ConvertFrom-Json
    Write-Host "✓ Created groups resource" -ForegroundColor Green
}

# Find or create {groupId} resource
$groupIdResource = $resources.items | Where-Object { 
    $_.pathPart -eq "{groupId}" -and $_.parentId -eq $groupsResource.id 
}

if (-not $groupIdResource) {
    Write-Host "Creating {groupId} resource..." -ForegroundColor Yellow
    $groupIdResource = aws apigateway create-resource `
        --rest-api-id $API_ID `
        --parent-id $groupsResource.id `
        --path-part "{groupId}" `
        --region $REGION | ConvertFrom-Json
    Write-Host "✓ Created {groupId} resource" -ForegroundColor Green
}

# Add PATCH method
Write-Host "Adding PATCH method..." -ForegroundColor Yellow
aws apigateway put-method `
    --rest-api-id $API_ID `
    --resource-id $groupIdResource.id `
    --http-method PATCH `
    --authorization-type "COGNITO_USER_POOLS" `
    --authorizer-id "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:shelcaster-authorizer/invocations" `
    --region $REGION

# Add integration
Write-Host "Adding Lambda integration..." -ForegroundColor Yellow
$lambdaUri = "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}/invocations"

aws apigateway put-integration `
    --rest-api-id $API_ID `
    --resource-id $groupIdResource.id `
    --http-method PATCH `
    --type AWS_PROXY `
    --integration-http-method POST `
    --uri $lambdaUri `
    --region $REGION

# Add Lambda permission
Write-Host "Adding Lambda permission..." -ForegroundColor Yellow
$sourceArn = "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/PATCH/users/{userId}/groups/{groupId}"

aws lambda add-permission `
    --function-name $LAMBDA_NAME `
    --statement-id "apigateway-update-group-$(Get-Date -Format 'yyyyMMddHHmmss')" `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn $sourceArn `
    --region $REGION 2>$null

# Add OPTIONS method for CORS
Write-Host "Adding OPTIONS method for CORS..." -ForegroundColor Yellow
aws apigateway put-method `
    --rest-api-id $API_ID `
    --resource-id $groupIdResource.id `
    --http-method OPTIONS `
    --authorization-type NONE `
    --region $REGION 2>$null

aws apigateway put-integration `
    --rest-api-id $API_ID `
    --resource-id $groupIdResource.id `
    --http-method OPTIONS `
    --type MOCK `
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' `
    --region $REGION 2>$null

aws apigateway put-method-response `
    --rest-api-id $API_ID `
    --resource-id $groupIdResource.id `
    --http-method OPTIONS `
    --status-code 200 `
    --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" `
    --region $REGION 2>$null

aws apigateway put-integration-response `
    --rest-api-id $API_ID `
    --resource-id $groupIdResource.id `
    --http-method OPTIONS `
    --status-code 200 `
    --response-parameters '{\"method.response.header.Access-Control-Allow-Headers\":\"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'\",\"method.response.header.Access-Control-Allow-Methods\":\"'"'"'GET,POST,PUT,PATCH,DELETE,OPTIONS'"'"'\",\"method.response.header.Access-Control-Allow-Origin\":\"'"'"'*'"'"'\"}' `
    --region $REGION 2>$null

# Deploy the API
Write-Host "Deploying API..." -ForegroundColor Yellow
aws apigateway create-deployment `
    --rest-api-id $API_ID `
    --stage-name prod `
    --region $REGION

Write-Host "✓ API route added and deployed successfully!" -ForegroundColor Green
Write-Host "Endpoint: PATCH https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod/users/{userId}/groups/{groupId}" -ForegroundColor Cyan
