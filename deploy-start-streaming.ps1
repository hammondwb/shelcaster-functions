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

Write-Host "Deploying shelcaster-start-streaming..." -ForegroundColor Cyan
Write-Host "MediaLive Role ARN: $roleArn"
Write-Host "Security Group ID: $securityGroupId"

Set-Location "shelcaster-start-streaming"

if (Test-Path "function.zip") {
    Remove-Item "function.zip"
}

Compress-Archive -Path "index.js" -DestinationPath "function.zip"

Write-Host "Updating function code..." -ForegroundColor Yellow
aws lambda update-function-code --function-name shelcaster-start-streaming --zip-file fileb://function.zip --profile $profile --region $region

Start-Sleep -Seconds 2

Write-Host "Updating environment variables..." -ForegroundColor Yellow
aws lambda update-function-configuration --function-name shelcaster-start-streaming --environment "Variables={MEDIALIVE_ROLE_ARN=$roleArn,MEDIALIVE_INPUT_SECURITY_GROUP_ID=$securityGroupId}" --profile $profile --region $region

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] shelcaster-start-streaming deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Deployment failed" -ForegroundColor Red
}

Set-Location ..
