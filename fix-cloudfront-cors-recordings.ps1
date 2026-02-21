# Fix CloudFront CORS for recordings/* path
# This script updates the CloudFront cache behavior to forward Origin header

$PROFILE = "shelcaster-admin"
$DISTRIBUTION_ID = "E3VKQYQ9J8Y8YJ"  # Update this if different

Write-Host "Finding CloudFront distribution..." -ForegroundColor Cyan

# Get the distribution config
$config = aws cloudfront get-distribution-config --id $DISTRIBUTION_ID --profile $PROFILE --output json | ConvertFrom-Json

if (-not $config) {
    Write-Host "Failed to get distribution config" -ForegroundColor Red
    exit 1
}

$etag = $config.ETag
$distConfig = $config.DistributionConfig

Write-Host "Current distribution: $($distConfig.Comment)" -ForegroundColor Green
Write-Host "ETag: $etag" -ForegroundColor Yellow

# Find the recordings/* cache behavior
$recordingsBehavior = $distConfig.CacheBehaviors.Items | Where-Object { $_.PathPattern -eq "recordings/*" }

if (-not $recordingsBehavior) {
    Write-Host "No recordings/* cache behavior found. Creating one..." -ForegroundColor Yellow
    Write-Host "This requires manual configuration in AWS Console." -ForegroundColor Red
    Write-Host ""
    Write-Host "Go to CloudFront > Distribution > Behaviors > Create Behavior" -ForegroundColor Cyan
    Write-Host "Path pattern: recordings/*" -ForegroundColor White
    Write-Host "Origin: shelcaster-media-manager origin" -ForegroundColor White
    Write-Host "Cache policy: Create new with Origin header forwarding" -ForegroundColor White
    exit 1
}

Write-Host "Found recordings/* behavior" -ForegroundColor Green
Write-Host "Cache Policy ID: $($recordingsBehavior.CachePolicyId)" -ForegroundColor Yellow

Write-Host ""
Write-Host "=== MANUAL FIX REQUIRED ===" -ForegroundColor Red
Write-Host ""
Write-Host "Go to AWS Console > CloudFront > Distribution $DISTRIBUTION_ID" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Click 'Behaviors' tab" -ForegroundColor White
Write-Host "2. Select the 'recordings/*' behavior (or default if no recordings/* exists)" -ForegroundColor White
Write-Host "3. Click 'Edit'" -ForegroundColor White
Write-Host "4. Under 'Cache key and origin requests':" -ForegroundColor White
Write-Host "   - Select 'Legacy cache settings' OR" -ForegroundColor White
Write-Host "   - Create/Edit Cache Policy to include:" -ForegroundColor White
Write-Host "     * Headers: Origin, Access-Control-Request-Headers, Access-Control-Request-Method" -ForegroundColor Yellow
Write-Host "5. Under 'Response headers policy':" -ForegroundColor White
Write-Host "   - Create new policy with CORS settings:" -ForegroundColor White
Write-Host "     * Access-Control-Allow-Origin: *" -ForegroundColor Yellow
Write-Host "     * Access-Control-Allow-Methods: GET, HEAD, OPTIONS" -ForegroundColor Yellow
Write-Host "     * Access-Control-Allow-Headers: *" -ForegroundColor Yellow
Write-Host "     * Access-Control-Expose-Headers: Content-Length, Content-Range" -ForegroundColor Yellow
Write-Host "6. Save changes" -ForegroundColor White
Write-Host "7. Wait 5-15 minutes for deployment" -ForegroundColor White
Write-Host ""
Write-Host "After deployment, clear browser cache and test again." -ForegroundColor Cyan
