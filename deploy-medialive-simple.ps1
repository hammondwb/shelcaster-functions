$ErrorActionPreference = "Stop"
$profile = "shelcaster-admin"
$region = "us-east-1"
$role = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"

# Load environment variables
$envVars = Get-Content ".env.medialive" | ForEach-Object {
    $parts = $_ -split '=', 2
    @{$parts[0] = $parts[1]}
}
$roleArn = ($envVars | Where-Object { $_.Keys -contains 'MEDIALIVE_ROLE_ARN' }).MEDIALIVE_ROLE_ARN
$securityGroupId = ($envVars | Where-Object { $_.Keys -contains 'MEDIALIVE_INPUT_SECURITY_GROUP_ID' }).MEDIALIVE_INPUT_SECURITY_GROUP_ID
$accountId = ($envVars | Where-Object { $_.Keys -contains 'AWS_ACCOUNT_ID' }).AWS_ACCOUNT_ID

Write-Host "Deploying MediaLive Lambda Functions..." -ForegroundColor Cyan
Write-Host "Role ARN: $roleArn"
Write-Host "Security Group ID: $securityGroupId"

$functions = @(
    "shelcaster-create-medialive-channel",
    "shelcaster-start-streaming",
    "shelcaster-stop-streaming",
    "shelcaster-start-recording",
    "shelcaster-stop-recording"
)

foreach ($func in $functions) {
    Write-Host "`nDeploying $func..." -ForegroundColor Yellow
    
    Set-Location $func
    
    if (Test-Path "function.zip") {
        Remove-Item "function.zip"
    }
    
    Compress-Archive -Path "index.mjs","index.js" -DestinationPath "function.zip" -ErrorAction SilentlyContinue
    
    $functionExists = $false
    try {
        aws lambda get-function --function-name $func --profile $profile --region $region 2>$null
        $functionExists = $true
    } catch {}
    
    if ($functionExists) {
        Write-Host "Updating..." -ForegroundColor Gray
        aws lambda update-function-code --function-name $func --zip-file fileb://function.zip --profile $profile --region $region
    } else {
        Write-Host "Creating..." -ForegroundColor Gray
        aws lambda create-function --function-name $func --runtime nodejs22.x --role $role --handler index.handler --zip-file fileb://function.zip --timeout 30 --memory-size 256 --environment "Variables={MEDIALIVE_ROLE_ARN=$roleArn,MEDIALIVE_INPUT_SECURITY_GROUP_ID=$securityGroupId,AWS_ACCOUNT_ID=$accountId}" --profile $profile --region $region
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] $func deployed" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to deploy $func" -ForegroundColor Red
    }
    
    Set-Location ..
}

Write-Host "`n[OK] All functions deployed!" -ForegroundColor Green
