# Deploy shelcaster-create-session Lambda with dependencies
# This script creates a proper zip file for Lambda deployment

Write-Host "Deploying shelcaster-create-session Lambda..." -ForegroundColor Cyan

# Navigate to Lambda directory
cd shelcaster-create-session

# Remove old zip if exists
if (Test-Path ../function.zip) {
    Remove-Item ../function.zip
}

# Create zip using 7-Zip if available, otherwise use native PowerShell
if (Get-Command 7z -ErrorAction SilentlyContinue) {
    Write-Host "Using 7-Zip for compression..." -ForegroundColor Yellow
    7z a -tzip ../function.zip index.mjs node_modules package.json -r
} else {
    Write-Host "Using PowerShell compression (may have issues)..." -ForegroundColor Yellow
    Write-Host "Consider installing 7-Zip for better compatibility" -ForegroundColor Gray
    
    # Use Add-Type to create zip with .NET
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zipPath = Resolve-Path "../function.zip" -ErrorAction SilentlyContinue
    if ($zipPath) { Remove-Item $zipPath }
    
    $zipPath = Join-Path (Get-Location).Parent.FullName "function.zip"
    $sourcePath = Get-Location
    
    [System.IO.Compression.ZipFile]::CreateFromDirectory($sourcePath, $zipPath, [System.IO.Compression.CompressionLevel]::Fastest, $false)
}

cd ..

# Upload to Lambda
Write-Host "Uploading to AWS Lambda..." -ForegroundColor Yellow
aws lambda update-function-code `
    --function-name shelcaster-create-session `
    --zip-file fileb://function.zip `
    --region us-east-1 `
    --profile shelcaster-admin `
    --no-cli-pager

# Clean up
Remove-Item function.zip

Write-Host "Deployment complete!" -ForegroundColor Green

