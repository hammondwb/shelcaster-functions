# Add tracklist API routes to API Gateway
$apiId = "td0dn99gi2"
$region = "us-east-1"

Write-Host "Adding tracklist API routes..." -ForegroundColor Cyan

# Get root resource
$rootResource = aws apigateway get-resources --rest-api-id $apiId --region $region --query "items[?path=='/'].id" --output text

# Get shows resource
$showsResource = aws apigateway get-resources --rest-api-id $apiId --region $region --query "items[?path=='/shows'].id" --output text
if (!$showsResource) {
    Write-Host "Creating /shows resource..." -ForegroundColor Yellow
    $showsResource = (aws apigateway create-resource --rest-api-id $apiId --region $region --parent-id $rootResource --path-part "shows" | ConvertFrom-Json).id
}

# Get {showId} resource
$showIdResource = aws apigateway get-resources --rest-api-id $apiId --region $region --query "items[?path=='/shows/{showId}'].id" --output text
if (!$showIdResource) {
    Write-Host "Creating /shows/{showId} resource..." -ForegroundColor Yellow
    $showIdResource = (aws apigateway create-resource --rest-api-id $apiId --region $region --parent-id $showsResource --path-part "{showId}" | ConvertFrom-Json).id
}

# Create /shows/{showId}/tracklist resource
Write-Host "Creating /shows/{showId}/tracklist resource..." -ForegroundColor Yellow
$tracklistResource = aws apigateway get-resources --rest-api-id $apiId --region $region --query "items[?path=='/shows/{showId}/tracklist'].id" --output text
if (!$tracklistResource) {
    $tracklistResource = (aws apigateway create-resource --rest-api-id $apiId --region $region --parent-id $showIdResource --path-part "tracklist" | ConvertFrom-Json).id
}

# Add GET method to /shows/{showId}/tracklist
Write-Host "Adding GET method to /shows/{showId}/tracklist..." -ForegroundColor Yellow
aws apigateway put-method --rest-api-id $apiId --region $region --resource-id $tracklistResource --http-method GET --authorization-type "COGNITO_USER_POOLS" --authorizer-id "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:124355640062:function:shelcaster-get-show-tracklist/invocations" 2>$null

# Add integration
$lambdaArn = "arn:aws:lambda:us-east-1:124355640062:function:shelcaster-get-show-tracklist"
aws apigateway put-integration --rest-api-id $apiId --region $region --resource-id $tracklistResource --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$lambdaArn/invocations" 2>$null

# Add Lambda permission
aws lambda add-permission --function-name shelcaster-get-show-tracklist --statement-id apigateway-get-show-tracklist --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:us-east-1:124355640062:$apiId/*/GET/shows/{showId}/tracklist" --region $region 2>$null

# Get tracklists resource
$tracklistsResource = aws apigateway get-resources --rest-api-id $apiId --region $region --query "items[?path=='/tracklists'].id" --output text
if (!$tracklistsResource) {
    Write-Host "Creating /tracklists resource..." -ForegroundColor Yellow
    $tracklistsResource = (aws apigateway create-resource --rest-api-id $apiId --region $region --parent-id $rootResource --path-part "tracklists" | ConvertFrom-Json).id
}

# Create /tracklists/{tracklistId} resource
$tracklistIdResource = aws apigateway get-resources --rest-api-id $apiId --region $region --query "items[?path=='/tracklists/{tracklistId}'].id" --output text
if (!$tracklistIdResource) {
    Write-Host "Creating /tracklists/{tracklistId} resource..." -ForegroundColor Yellow
    $tracklistIdResource = (aws apigateway create-resource --rest-api-id $apiId --region $region --parent-id $tracklistsResource --path-part "{tracklistId}" | ConvertFrom-Json).id
}

# Create /tracklists/{tracklistId}/programs resource
Write-Host "Creating /tracklists/{tracklistId}/programs resource..." -ForegroundColor Yellow
$programsResource = aws apigateway get-resources --rest-api-id $apiId --region $region --query "items[?path=='/tracklists/{tracklistId}/programs'].id" --output text
if (!$programsResource) {
    $programsResource = (aws apigateway create-resource --rest-api-id $apiId --region $region --parent-id $tracklistIdResource --path-part "programs" | ConvertFrom-Json).id
}

# Add GET method to /tracklists/{tracklistId}/programs
Write-Host "Adding GET method to /tracklists/{tracklistId}/programs..." -ForegroundColor Yellow
aws apigateway put-method --rest-api-id $apiId --region $region --resource-id $programsResource --http-method GET --authorization-type "COGNITO_USER_POOLS" --authorizer-id "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:124355640062:function:shelcaster-get-tracklist-programs/invocations" 2>$null

# Add integration
$lambdaArn2 = "arn:aws:lambda:us-east-1:124355640062:function:shelcaster-get-tracklist-programs"
aws apigateway put-integration --rest-api-id $apiId --region $region --resource-id $programsResource --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$lambdaArn2/invocations" 2>$null

# Add Lambda permission
aws lambda add-permission --function-name shelcaster-get-tracklist-programs --statement-id apigateway-get-tracklist-programs --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:us-east-1:124355640062:$apiId/*/GET/tracklists/{tracklistId}/programs" --region $region 2>$null

# Deploy API
Write-Host "Deploying API..." -ForegroundColor Yellow
aws apigateway create-deployment --rest-api-id $apiId --region $region --stage-name prod

Write-Host "`nTracklist routes added successfully!" -ForegroundColor Green
Write-Host "GET /shows/{showId}/tracklist" -ForegroundColor Cyan
Write-Host "GET /tracklists/{tracklistId}/programs" -ForegroundColor Cyan
