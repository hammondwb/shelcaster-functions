#!/usr/bin/env pwsh

$ErrorActionPreference = "Stop"
$profile = "shelcaster-admin"
$region = "us-east-1"
$accountId = "124355640062"

Write-Host "Setting up MediaLive prerequisites..." -ForegroundColor Cyan

Write-Host "`n1. Creating MediaLive IAM Role..." -ForegroundColor Yellow

$roleExists = $false
try {
    aws iam get-role --role-name MediaLiveAccessRole --profile $profile --region $region 2>$null
    $roleExists = $true
    Write-Host "   Role already exists" -ForegroundColor Gray
} catch {}

if (-not $roleExists) {
    Write-Host "   Creating role..." -ForegroundColor Gray
    aws iam create-role --role-name MediaLiveAccessRole --assume-role-policy-document file://medialive-trust-policy.json --profile $profile --region $region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Role created" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] Failed to create role" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "   Attaching permissions..." -ForegroundColor Gray
    aws iam put-role-policy --role-name MediaLiveAccessRole --policy-name MediaLivePermissions --policy-document file://medialive-permissions.json --profile $profile --region $region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Permissions attached" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] Failed to attach permissions" -ForegroundColor Red
        exit 1
    }
}

$roleArn = "arn:aws:iam::${accountId}:role/MediaLiveAccessRole"
Write-Host "   Role ARN: $roleArn" -ForegroundColor Cyan

Write-Host "`n2. Creating Input Security Group..." -ForegroundColor Yellow

$inputSecurityGroupId = aws medialive create-input-security-group --whitelist-rules Cidr=0.0.0.0/0 --profile $profile --region $region --query 'SecurityGroup.Id' --output text

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Input Security Group created" -ForegroundColor Green
    Write-Host "   Security Group ID: $inputSecurityGroupId" -ForegroundColor Cyan
} else {
    Write-Host "   [ERROR] Failed to create Input Security Group" -ForegroundColor Red
    exit 1
}

Write-Host "`n3. Saving configuration..." -ForegroundColor Yellow

$envContent = "MEDIALIVE_ROLE_ARN=$roleArn`nMEDIALIVE_INPUT_SECURITY_GROUP_ID=$inputSecurityGroupId`nAWS_ACCOUNT_ID=$accountId`nAWS_REGION=$region"
$envContent | Out-File -FilePath ".env.medialive" -Encoding ASCII
Write-Host "   [OK] Configuration saved to .env.medialive" -ForegroundColor Green

Write-Host "`n4. Updating Lambda functions with environment variables..." -ForegroundColor Yellow

$functions = @(
    "shelcaster-create-medialive-channel",
    "shelcaster-start-streaming",
    "shelcaster-stop-streaming",
    "shelcaster-start-recording",
    "shelcaster-stop-recording"
)

foreach ($func in $functions) {
    Write-Host "   Updating $func..." -ForegroundColor Gray
    
    aws lambda update-function-configuration --function-name $func --environment "Variables={MEDIALIVE_ROLE_ARN=$roleArn,MEDIALIVE_INPUT_SECURITY_GROUP_ID=$inputSecurityGroupId,AWS_ACCOUNT_ID=$accountId}" --profile $profile --region $region 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] $func updated" -ForegroundColor Green
    }
}

Write-Host "`n[OK] Setup complete!" -ForegroundColor Green
Write-Host "`nConfiguration:" -ForegroundColor Cyan
Write-Host "  Role ARN: $roleArn"
Write-Host "  Input Security Group ID: $inputSecurityGroupId"
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Deploy Lambda functions: .\deploy-medialive-functions.ps1"
Write-Host "2. Add API routes: .\add-medialive-routes.ps1"
Write-Host "3. Test MediaLive channel creation"
