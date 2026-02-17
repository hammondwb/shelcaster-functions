# Add CloudFront cache behavior for IVS recordings
$DISTRIBUTION_ID = "E34KC6MODUKR5U"

Write-Host "Adding CloudFront cache behavior for /ivs/* path..." -ForegroundColor Cyan

# Get current distribution config
Write-Host "Fetching current distribution config..." -ForegroundColor Yellow
aws cloudfront get-distribution-config --id $DISTRIBUTION_ID --output json > cf-config-temp.json

# Extract ETag and config
$config = Get-Content cf-config-temp.json | ConvertFrom-Json
$etag = $config.ETag
$distConfig = $config.DistributionConfig

Write-Host "Current ETag: $etag" -ForegroundColor Gray

# Add new cache behavior for /ivs/*
$newBehavior = @{
    PathPattern = "ivs/*"
    TargetOriginId = "shelcaster-media-manager.s3.us-east-1.amazonaws.com"
    ViewerProtocolPolicy = "redirect-to-https"
    AllowedMethods = @{
        Quantity = 2
        Items = @("GET", "HEAD")
        CachedMethods = @{
            Quantity = 2
            Items = @("GET", "HEAD")
        }
    }
    Compress = $true
    CachePolicyId = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # CachingOptimized
    OriginRequestPolicyId = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"  # CORS-S3Origin
}

# Add to cache behaviors
$distConfig.CacheBehaviors.Items += $newBehavior
$distConfig.CacheBehaviors.Quantity = $distConfig.CacheBehaviors.Items.Count

# Save updated config
$distConfig | ConvertTo-Json -Depth 10 | Set-Content cf-config-updated.json

# Update distribution
Write-Host "Updating CloudFront distribution..." -ForegroundColor Yellow
aws cloudfront update-distribution --id $DISTRIBUTION_ID --distribution-config file://cf-config-updated.json --if-match $etag

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success - CloudFront cache behavior added for /ivs/*" -ForegroundColor Green
    Write-Host "Distribution is updating... This may take 5-10 minutes." -ForegroundColor Yellow
} else {
    Write-Host "Failed to update CloudFront distribution" -ForegroundColor Red
}

# Cleanup
Remove-Item cf-config-temp.json -ErrorAction SilentlyContinue
Remove-Item cf-config-updated.json -ErrorAction SilentlyContinue
