# Diagnose IVS Recording to S3 Issue
# This script checks all components needed for IVS Real-Time composition recording

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$BUCKET = "shelcaster-media-manager"
$STORAGE_CONFIG_ARN = "arn:aws:ivs:us-east-1:124355640062:storage-configuration/yxxsKmccqsDL"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "IVS Recording Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Check S3 Bucket
Write-Host "[1/5] Checking S3 Bucket..." -ForegroundColor Yellow
$bucketCheck = aws s3api head-bucket --bucket $BUCKET --profile $PROFILE --region $REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK S3 bucket exists: $BUCKET" -ForegroundColor Green
} else {
    Write-Host "  ERROR S3 bucket not found!" -ForegroundColor Red
    exit 1
}

# 2. Check S3 Bucket Policy
Write-Host "`n[2/5] Checking S3 Bucket Policy..." -ForegroundColor Yellow
$policy = aws s3api get-bucket-policy --bucket $BUCKET --profile $PROFILE --region $REGION --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    $policyJson = $policy | ConvertFrom-Json
    $policyDoc = $policyJson.Policy | ConvertFrom-Json
    
    $hasIVSComposite = $false
    foreach ($statement in $policyDoc.Statement) {
        if ($statement.Principal.Service -eq "ivs-composite.us-east-1.amazonaws.com") {
            $hasIVSComposite = $true
            Write-Host "  OK ivs-composite.us-east-1.amazonaws.com has PutObject permission" -ForegroundColor Green
            break
        }
    }
    
    if (-not $hasIVSComposite) {
        Write-Host "  ERROR Missing ivs-composite.us-east-1.amazonaws.com permission!" -ForegroundColor Red
        Write-Host "  This is the root cause - IVS Real-Time cannot write to S3" -ForegroundColor Red
    }
} else {
    Write-Host "  ERROR Cannot read bucket policy!" -ForegroundColor Red
}

# 3. Check Storage Configuration ARN in Lambda
Write-Host "`n[3/5] Checking Lambda Environment Variables..." -ForegroundColor Yellow
$lambdaEnv = aws lambda get-function-configuration --function-name shelcaster-start-composition --profile $PROFILE --region $REGION --query "Environment.Variables" --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    $env = $lambdaEnv | ConvertFrom-Json
    if ($env.STORAGE_CONFIGURATION_ARN) {
        Write-Host "  OK STORAGE_CONFIGURATION_ARN is set: $($env.STORAGE_CONFIGURATION_ARN)" -ForegroundColor Green
    } else {
        Write-Host "  ERROR STORAGE_CONFIGURATION_ARN not set!" -ForegroundColor Red
    }
} else {
    Write-Host "  ERROR Cannot read Lambda configuration!" -ForegroundColor Red
}

# 4. List recent compositions
Write-Host "`n[4/5] Checking Recent Compositions..." -ForegroundColor Yellow
Write-Host "  Note: AWS CLI does not support listing IVS Real-Time compositions" -ForegroundColor Gray
Write-Host "  Check CloudWatch Logs for composition details" -ForegroundColor Gray

# 5. Check S3 for recent recordings
Write-Host "`n[5/5] Checking S3 for Recent Recordings..." -ForegroundColor Yellow
$recentFiles = aws s3 ls s3://$BUCKET/ --recursive --profile $PROFILE --region $REGION 2>&1 | Select-Object -Last 10
if ($recentFiles) {
    Write-Host "  Recent files in S3:" -ForegroundColor Green
    $recentFiles | ForEach-Object { Write-Host "    $_" -ForegroundColor Cyan }
} else {
    Write-Host "  WARNING No recent files found in S3" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Diagnostic Summary" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Common Issues:" -ForegroundColor Yellow
Write-Host "  1. Missing ivs-composite.us-east-1.amazonaws.com in S3 bucket policy" -ForegroundColor White
Write-Host "  2. Storage configuration ARN not set in Lambda" -ForegroundColor White
Write-Host "  3. Storage configuration pointing to wrong S3 bucket" -ForegroundColor White
Write-Host "  4. S3 bucket in different region than IVS" -ForegroundColor White

Write-Host "`nIf recordings are stuck in STARTING state:" -ForegroundColor Yellow
Write-Host "  - This means IVS cannot write to S3" -ForegroundColor White
Write-Host "  - Check S3 bucket policy has ivs-composite service principal" -ForegroundColor White
Write-Host "  - Verify storage configuration was created with correct bucket" -ForegroundColor White
Write-Host ""
