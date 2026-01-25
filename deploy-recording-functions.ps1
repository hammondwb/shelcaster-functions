# Deploy Recording Lambda Functions
# This script deploys the Lambda functions needed for recording management

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"

Write-Host "Deploying Recording Lambda Functions..." -ForegroundColor Green

# Function to deploy a Lambda with dependencies
function Deploy-LambdaWithDeps {
    param (
        [string]$FunctionName,
        [int]$Index,
        [int]$Total
    )
    
    Write-Host "`n[$Index/$Total] Deploying $FunctionName..." -ForegroundColor Yellow
    
    # Navigate to function directory
    $functionPath = "..\$FunctionName"
    Push-Location $functionPath
    
    # Install dependencies if package.json exists
    if (Test-Path "package.json") {
        Write-Host "  Installing dependencies..." -ForegroundColor Cyan
        npm install --silent 2>&1 | Out-Null
    }
    
    # Create deployment package
    Write-Host "  Creating deployment package..." -ForegroundColor Cyan
    $zipPath = "..\shelcaster-functions\$FunctionName.zip"
    if (Test-Path $zipPath) {
        Remove-Item $zipPath
    }
    
    # Zip the function code and node_modules
    if (Test-Path "node_modules") {
        Compress-Archive -Path index.mjs,node_modules -DestinationPath $zipPath -Force
    } else {
        Compress-Archive -Path index.mjs -DestinationPath $zipPath -Force
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
            --region $REGION | Out-Null
        Write-Host "  ✅ Function updated successfully" -ForegroundColor Green
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
            --memory-size 256 `
            --profile $PROFILE `
            --region $REGION | Out-Null
        Write-Host "  ✅ Function created successfully" -ForegroundColor Green
    }
    
    # Clean up zip file
    Remove-Item "$FunctionName.zip" -Force
}

# Deploy the functions
Deploy-LambdaWithDeps -FunctionName "shelcaster-get-recordings" -Index 1 -Total 2
Deploy-LambdaWithDeps -FunctionName "shelcaster-save-recording" -Index 2 -Total 2

Write-Host "`n✅ All Recording Lambda functions deployed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Add API Gateway routes for recording endpoints" -ForegroundColor Cyan
Write-Host "2. Test the recording functionality in the show-creator-studio" -ForegroundColor Cyan

