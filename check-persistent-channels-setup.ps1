# Check Persistent Channels Setup
# This script verifies that all prerequisites are in place before testing

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking Persistent Channels Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check 1: AWS CLI installed
Write-Host "1. Checking AWS CLI..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version 2>&1
    Write-Host "   ✓ AWS CLI installed: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ AWS CLI not found. Please install AWS CLI." -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 2: AWS credentials configured
Write-Host "2. Checking AWS credentials..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
    Write-Host "   ✓ AWS credentials configured" -ForegroundColor Green
    Write-Host "     Account: $($identity.Account)" -ForegroundColor Gray
    Write-Host "     User: $($identity.Arn)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ AWS credentials not configured. Run 'aws configure'" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 3: DynamoDB table exists
Write-Host "3. Checking DynamoDB table..." -ForegroundColor Yellow
try {
    $table = aws dynamodb describe-table --table-name shelcaster-app --region us-east-1 2>&1 | ConvertFrom-Json
    Write-Host "   ✓ Table 'shelcaster-app' exists" -ForegroundColor Green
    Write-Host "     Status: $($table.Table.TableStatus)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Table 'shelcaster-app' not found" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 4: DynamoDB GSI exists
Write-Host "4. Checking DynamoDB GSI..." -ForegroundColor Yellow
try {
    $table = aws dynamodb describe-table --table-name shelcaster-app --region us-east-1 2>&1 | ConvertFrom-Json
    $gsi = $table.Table.GlobalSecondaryIndexes | Where-Object { $_.IndexName -eq "entityType-index" }
    
    if ($gsi) {
        Write-Host "   ✓ GSI 'entityType-index' exists" -ForegroundColor Green
        Write-Host "     Status: $($gsi.IndexStatus)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ GSI 'entityType-index' not found" -ForegroundColor Red
        Write-Host "     Create it with:" -ForegroundColor Yellow
        Write-Host "     aws dynamodb update-table --table-name shelcaster-app --attribute-definitions AttributeName=entityType,AttributeType=S --global-secondary-index-updates '[{""Create"":{""IndexName"":""entityType-index"",""KeySchema"":[{""AttributeName"":""entityType"",""KeyType"":""HASH""}],""Projection"":{""ProjectionType"":""ALL""},""ProvisionedThroughput"":{""ReadCapacityUnits"":5,""WriteCapacityUnits"":5}}}]'" -ForegroundColor Gray
        $allGood = $false
    }
} catch {
    Write-Host "   ✗ Could not check GSI" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 5: Lambda functions exist
Write-Host "5. Checking Lambda functions..." -ForegroundColor Yellow
$functions = @(
    "shelcaster-create-persistent-channel",
    "shelcaster-assign-channel",
    "shelcaster-unassign-channel",
    "shelcaster-get-host-channel",
    "shelcaster-list-channels",
    "shelcaster-get-channel-stats",
    "shelcaster-get-channel-capacity",
    "shelcaster-update-channel-state"
)

$existingFunctions = 0
$missingFunctions = @()

foreach ($func in $functions) {
    try {
        aws lambda get-function --function-name $func --region us-east-1 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $existingFunctions++
        } else {
            $missingFunctions += $func
        }
    } catch {
        $missingFunctions += $func
    }
}

if ($existingFunctions -eq $functions.Count) {
    Write-Host "   ✓ All $($functions.Count) Lambda functions exist" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Only $existingFunctions/$($functions.Count) Lambda functions exist" -ForegroundColor Yellow
    Write-Host "     Missing functions:" -ForegroundColor Gray
    foreach ($func in $missingFunctions) {
        Write-Host "       - $func" -ForegroundColor Gray
    }
    Write-Host "     You need to create these functions in AWS Lambda Console first" -ForegroundColor Yellow
    Write-Host "     Then run: .\deploy-persistent-channels.ps1" -ForegroundColor Yellow
}
Write-Host ""

# Check 6: API Gateway exists
Write-Host "6. Checking API Gateway..." -ForegroundColor Yellow
try {
    $api = aws apigatewayv2 get-api --api-id qvhxb7wnp3 --region us-east-1 2>&1 | ConvertFrom-Json
    Write-Host "   ✓ API Gateway exists" -ForegroundColor Green
    Write-Host "     Name: $($api.Name)" -ForegroundColor Gray
    Write-Host "     Endpoint: $($api.ApiEndpoint)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ API Gateway not found (ID: qvhxb7wnp3)" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 7: API routes exist
Write-Host "7. Checking API routes..." -ForegroundColor Yellow
try {
    $routes = aws apigatewayv2 get-routes --api-id qvhxb7wnp3 --region us-east-1 2>&1 | ConvertFrom-Json
    $channelRoutes = $routes.Items | Where-Object { $_.RouteKey -like "*channel*" }
    
    if ($channelRoutes.Count -gt 0) {
        Write-Host "   ✓ Found $($channelRoutes.Count) channel-related routes" -ForegroundColor Green
        foreach ($route in $channelRoutes) {
            Write-Host "     - $($route.RouteKey)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠ No channel routes found" -ForegroundColor Yellow
        Write-Host "     Run: .\add-persistent-channels-routes.ps1" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Could not check API routes" -ForegroundColor Red
}
Write-Host ""

# Check 8: IVS recording configuration exists
Write-Host "8. Checking IVS recording configuration..." -ForegroundColor Yellow
try {
    $recordingArn = "arn:aws:ivs:us-east-1:124355640062:recording-configuration/NgV3p8AlWTTF"
    $recording = aws ivs get-recording-configuration --arn $recordingArn --region us-east-1 2>&1 | ConvertFrom-Json
    Write-Host "   ✓ Recording configuration exists" -ForegroundColor Green
    Write-Host "     ARN: $recordingArn" -ForegroundColor Gray
    Write-Host "     State: $($recording.recordingConfiguration.state)" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠ Recording configuration not found or not accessible" -ForegroundColor Yellow
    Write-Host "     Channels will be created without recording" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Check Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($allGood -and $existingFunctions -eq $functions.Count) {
    Write-Host "✓ All prerequisites are in place!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Deploy Lambda functions: .\deploy-persistent-channels.ps1" -ForegroundColor Gray
    Write-Host "2. Create API routes: .\add-persistent-channels-routes.ps1" -ForegroundColor Gray
    Write-Host "3. Run tests: .\test-persistent-channels.ps1" -ForegroundColor Gray
} else {
    Write-Host "⚠ Some prerequisites are missing" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please address the issues above before proceeding." -ForegroundColor Yellow
}
Write-Host ""
