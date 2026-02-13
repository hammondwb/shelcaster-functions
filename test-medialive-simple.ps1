$profile = "shelcaster-admin"
$region = "us-east-1"
$sessionId = "test-session-$(Get-Random)"

Write-Host "Testing MediaLive Lambda Functions..." -ForegroundColor Cyan
Write-Host "Session ID: $sessionId" -ForegroundColor Gray

# Create test payload file
$payload = @"
{
  "pathParameters": {
    "sessionId": "$sessionId"
  },
  "body": "{\"ivsIngestEndpoint\": \"rtmps://test.ivs.ingest.endpoint/app\"}"
}
"@

$payload | Out-File -FilePath "test-payload.json" -Encoding UTF8

Write-Host "`n1. Testing shelcaster-create-medialive-channel..." -ForegroundColor Yellow
Write-Host "Payload:" -ForegroundColor Gray
Get-Content test-payload.json

Write-Host "`nInvoking Lambda..." -ForegroundColor Gray
aws lambda invoke --function-name shelcaster-create-medialive-channel --payload file://test-payload.json --profile $profile --region $region response.json

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Lambda invoked" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor Cyan
    Get-Content response.json | ConvertFrom-Json | ConvertTo-Json -Depth 5
} else {
    Write-Host "[ERROR] Failed" -ForegroundColor Red
}

Write-Host "`n2. Listing MediaLive channels..." -ForegroundColor Yellow
aws medialive list-channels --profile $profile --region $region --query "Channels[*].{Name:Name,Id:Id,State:State}" --output table

Write-Host "`n3. Listing MediaLive inputs..." -ForegroundColor Yellow
aws medialive list-inputs --profile $profile --region $region --query "Inputs[*].{Name:Name,Id:Id,Type:Type}" --output table

Write-Host "`nTest complete!" -ForegroundColor Green
