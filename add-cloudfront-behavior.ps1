# Add CloudFront Cache Behavior for IVS Real-Time Recordings
# IVS Real-Time recordings are at root level: {stageId}/{channelId}/{compositionId}/composite/...
# Need to route these paths to shelcaster-media-manager bucket

$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$DISTRIBUTION_ID = "E34KC6MODUKR5U"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Add CloudFront Cache Behavior for IVS Recordings" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Problem: CloudFront only routes /recordings/* to media-manager bucket" -ForegroundColor Yellow
Write-Host "IVS Real-Time recordings are at: {stageId}/{channelId}/{compositionId}/composite/..." -ForegroundColor Yellow
Write-Host "Result: 403 Forbidden when trying to play recordings`n" -ForegroundColor Yellow

# Get current distribution config
Write-Host "[1/3] Getting current CloudFront configuration..." -ForegroundColor Yellow
aws cloudfront get-distribution-config --id $DISTRIBUTION_ID --profile $PROFILE --region $REGION --output json > cf-config.json

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR Failed to get CloudFront config" -ForegroundColor Red
    exit 1
}

$config = Get-Content cf-config.json | ConvertFrom-Json
$etag = $config.ETag
$distConfig = $config.DistributionConfig

Write-Host "  OK Current ETag: $etag" -ForegroundColor Green

# Add new cache behavior for */composite/* paths
Write-Host "`n[2/3] Adding cache behavior for */composite/* paths..." -ForegroundColor Yellow

$newBehavior = @{
    PathPattern = "*/composite/*"
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
if (-not $distConfig.CacheBehaviors) {
    $distConfig.CacheBehaviors = @{
        Quantity = 0
        Items = @()
    }
}

$distConfig.CacheBehaviors.Items += $newBehavior
$distConfig.CacheBehaviors.Quantity = $distConfig.CacheBehaviors.Items.Count

Write-Host "  OK Added cache behavior for */composite/*" -ForegroundColor Green

# Save updated config
$distConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath "cf-config-updated.json" -Encoding utf8

# Update CloudFront distribution
Write-Host "`n[3/3] Updating CloudFront distribution..." -ForegroundColor Yellow
aws cloudfront update-distribution `
    --id $DISTRIBUTION_ID `
    --distribution-config file://cf-config-updated.json `
    --if-match $etag `
    --profile $PROFILE `
    --region $REGION `
    --no-cli-pager

if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK CloudFront distribution updated" -ForegroundColor Green
} else {
    Write-Host "  ERROR Failed to update CloudFront" -ForegroundColor Red
    Write-Host "`nManual steps:" -ForegroundColor Yellow
    Write-Host "1. Go to CloudFront console" -ForegroundColor White
    Write-Host "2. Edit distribution E34KC6MODUKR5U" -ForegroundColor White
    Write-Host "3. Add cache behavior:" -ForegroundColor White
    Write-Host "   Path: */composite/*" -ForegroundColor White
    Write-Host "   Origin: shelcaster-media-manager.s3.us-east-1.amazonaws.com" -ForegroundColor White
    exit 1
}

# Cleanup
Remove-Item cf-config.json, cf-config-updated.json -ErrorAction SilentlyContinue

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "OK CloudFront Updated!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "Cache behavior added for: */composite/*" -ForegroundColor Green
Write-Host "Origin: shelcaster-media-manager bucket" -ForegroundColor Green
Write-Host "`nNote: CloudFront changes take 5-10 minutes to propagate" -ForegroundColor Yellow
Write-Host "Test URL after propagation:" -ForegroundColor Yellow
Write-Host "https://d2kyyx47f0bavc.cloudfront.net/Y0RCqjLWBmzu/BIaAta7gzmjC/Uaxw8QzyMCS0/composite/media/hls/multivariant.m3u8`n" -ForegroundColor Cyan
