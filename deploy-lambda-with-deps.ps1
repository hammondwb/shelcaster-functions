# Deploy Lambda function with node_modules using .NET compression
# This avoids the PowerShell Compress-Archive issues with package.json

param(
    [string]$FunctionName = "shelcaster-create-session",
    [string]$SourceDir = "shelcaster-create-session",
    [string]$ZipFile = "function-with-deps.zip"
)

Write-Host "Deploying $FunctionName with dependencies..." -ForegroundColor Cyan

# Remove old zip if exists
if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
    Write-Host "Removed old zip file" -ForegroundColor Yellow
}

# Create zip using .NET System.IO.Compression
Write-Host "Creating zip file..." -ForegroundColor Yellow
Add-Type -AssemblyName System.IO.Compression.FileSystem

try {
    # Create the zip file
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        (Resolve-Path $SourceDir).Path,
        (Join-Path (Get-Location) $ZipFile),
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )
    
    Write-Host "Zip file created successfully" -ForegroundColor Green
    
    # Deploy to Lambda
    Write-Host "Uploading to Lambda..." -ForegroundColor Yellow
    aws lambda update-function-code `
        --function-name $FunctionName `
        --zip-file fileb://$ZipFile `
        --region us-east-1 `
        --profile shelcaster-admin `
        --no-cli-pager
    
    Write-Host "Deployment complete!" -ForegroundColor Green
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clean up
    if (Test-Path $ZipFile) {
        Remove-Item $ZipFile -Force
        Write-Host "Cleaned up zip file" -ForegroundColor Yellow
    }
}

# Wait for Lambda to be ready
Write-Host "Waiting for Lambda to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$status = aws lambda get-function `
    --function-name $FunctionName `
    --region us-east-1 `
    --profile shelcaster-admin `
    --query 'Configuration.LastUpdateStatus' `
    --output text

Write-Host "Lambda status: $status" -ForegroundColor $(if ($status -eq "Successful") { "Green" } else { "Yellow" })

