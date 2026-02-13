$ErrorActionPreference = "Stop"
$profile = "shelcaster-admin"
$region = "us-east-1"

Write-Host "`n=== MediaLive Auto-Create Deployment Verification ===" -ForegroundColor Cyan

# Check if function exists
Write-Host "`n1. Checking if Lambda function exists..." -ForegroundColor Yellow
try {
    $function = aws lambda get-function --function-name shelcaster-start-streaming --profile $profile --region $region 2>$null | ConvertFrom-Json
    Write-Host "   [OK] Function exists" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Function not found" -ForegroundColor Red
    exit 1
}

# Check environment variables
Write-Host "`n2. Checking environment variables..." -ForegroundColor Yellow
$config = aws lambda get-function-configuration --function-name shelcaster-start-streaming --profile $profile --region $region | ConvertFrom-Json

$envVars = $config.Environment.Variables
if ($envVars.MEDIALIVE_ROLE_ARN) {
    Write-Host "   [OK] MEDIALIVE_ROLE_ARN: $($envVars.MEDIALIVE_ROLE_ARN)" -ForegroundColor Green
} else {
    Write-Host "   [ERROR] MEDIALIVE_ROLE_ARN not set" -ForegroundColor Red
}

if ($envVars.MEDIALIVE_INPUT_SECURITY_GROUP_ID) {
    Write-Host "   [OK] MEDIALIVE_INPUT_SECURITY_GROUP_ID: $($envVars.MEDIALIVE_INPUT_SECURITY_GROUP_ID)" -ForegroundColor Green
} else {
    Write-Host "   [ERROR] MEDIALIVE_INPUT_SECURITY_GROUP_ID not set" -ForegroundColor Red
}

# Check function runtime and handler
Write-Host "`n3. Checking function configuration..." -ForegroundColor Yellow
Write-Host "   Runtime: $($config.Runtime)" -ForegroundColor Gray
Write-Host "   Handler: $($config.Handler)" -ForegroundColor Gray
Write-Host "   Timeout: $($config.Timeout)s" -ForegroundColor Gray
Write-Host "   Memory: $($config.MemorySize)MB" -ForegroundColor Gray

# Check last modified
Write-Host "`n4. Checking last update..." -ForegroundColor Yellow
Write-Host "   Last Modified: $($config.LastModified)" -ForegroundColor Gray

# Check IAM role
Write-Host "`n5. Checking IAM role..." -ForegroundColor Yellow
Write-Host "   Role: $($config.Role)" -ForegroundColor Gray

# Check if MediaLive role exists
Write-Host "`n6. Checking MediaLive IAM role..." -ForegroundColor Yellow
try {
    $roleArn = $envVars.MEDIALIVE_ROLE_ARN
    $roleName = $roleArn.Split('/')[-1]
    aws iam get-role --role-name $roleName --profile $profile --region $region 2>$null | Out-Null
    Write-Host "   [OK] MediaLive role exists: $roleName" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] MediaLive role not found: $roleName" -ForegroundColor Red
}

# Check if Input Security Group exists
Write-Host "`n7. Checking MediaLive Input Security Group..." -ForegroundColor Yellow
try {
    $sgId = $envVars.MEDIALIVE_INPUT_SECURITY_GROUP_ID
    $sg = aws medialive describe-input-security-group --input-security-group-id $sgId --profile $profile --region $region 2>$null | ConvertFrom-Json
    Write-Host "   [OK] Security Group exists: $sgId" -ForegroundColor Green
    Write-Host "   State: $($sg.State)" -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Security Group not found: $sgId" -ForegroundColor Red
}

Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Join a stage in the frontend" -ForegroundColor White
Write-Host "2. Click 'Go Live' button" -ForegroundColor White
Write-Host "3. Check CloudWatch logs for 'MediaLive channel not found, creating...'" -ForegroundColor White
Write-Host "4. Verify channel created in AWS Console -> MediaLive" -ForegroundColor White
