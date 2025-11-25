# Deploy IVS-related Lambda functions
# This script deploys the Lambda functions needed for AWS IVS streaming

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"

Write-Host "Deploying IVS Lambda Functions..." -ForegroundColor Green

# Function to deploy a Lambda with dependencies
function Deploy-LambdaWithDeps {
    param (
        [string]$FunctionName,
        [int]$Index,
        [int]$Total
    )
    
    Write-Host "`n[$Index/$Total] Deploying $FunctionName..." -ForegroundColor Yellow
    
    # Navigate to function directory
    Push-Location $FunctionName
    
    # Install dependencies if package.json exists
    if (Test-Path "package.json") {
        Write-Host "  Installing dependencies..." -ForegroundColor Cyan
        npm install --silent 2>&1 | Out-Null
    }
    
    # Create deployment package
    Write-Host "  Creating deployment package..." -ForegroundColor Cyan
    if (Test-Path "../$FunctionName.zip") {
        Remove-Item "../$FunctionName.zip"
    }
    
    # Zip the function code and node_modules
    if (Test-Path "node_modules") {
        Compress-Archive -Path index.mjs,node_modules -DestinationPath "../$FunctionName.zip" -Force
    } else {
        Compress-Archive -Path index.mjs -DestinationPath "../$FunctionName.zip" -Force
    }
    
    Pop-Location
    
    # Check if function exists
    $functionExists = aws lambda get-function --function-name $FunctionName --profile $PROFILE --region $REGION 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        # Update existing function
        Write-Host "  Updating function code..." -ForegroundColor Cyan
        aws lambda update-function-code `
            --function-name $FunctionName `
            --zip-file "fileb://$FunctionName.zip" `
            --profile $PROFILE `
            --region $REGION `
            --no-cli-pager | Out-Null
        
        Write-Host "  ✓ Updated $FunctionName" -ForegroundColor Green
    } else {
        # Create new function
        Write-Host "  Creating new function..." -ForegroundColor Cyan
        aws lambda create-function `
            --function-name $FunctionName `
            --runtime nodejs22.x `
            --role $ROLE_ARN `
            --handler index.handler `
            --zip-file "fileb://$FunctionName.zip" `
            --timeout 30 `
            --memory-size 512 `
            --profile $PROFILE `
            --region $REGION `
            --no-cli-pager | Out-Null
        
        Write-Host "  ✓ Created $FunctionName" -ForegroundColor Green
    }
    
    # Clean up zip file
    Remove-Item "$FunctionName.zip" -ErrorAction SilentlyContinue
}

# Deploy the functions
Deploy-LambdaWithDeps -FunctionName "shelcaster-create-ivs-channel" -Index 1 -Total 3
Deploy-LambdaWithDeps -FunctionName "shelcaster-start-broadcast" -Index 2 -Total 3
Deploy-LambdaWithDeps -FunctionName "shelcaster-stop-broadcast" -Index 3 -Total 3

Write-Host "`n✅ All IVS Lambda functions deployed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run setup-ivs-recording.ps1 to configure IVS recording to S3" -ForegroundColor Cyan
Write-Host "2. Add API Gateway route: POST /shows/{showId}/ivs-channel" -ForegroundColor Cyan
Write-Host "3. Update the broadcast studio frontend to use IVS" -ForegroundColor Cyan

