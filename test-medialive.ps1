$profile = "shelcaster-admin"
$region = "us-east-1"

Write-Host "Testing MediaLive Lambda Functions..." -ForegroundColor Cyan

# Test 1: Create MediaLive Channel
Write-Host "`n1. Testing shelcaster-create-medialive-channel..." -ForegroundColor Yellow

$testEvent = @{
    pathParameters = @{
        sessionId = "test-session-$(Get-Random)"
    }
    body = @{
        ivsIngestEndpoint = "rtmps://test.ivs.ingest.endpoint/app"
    } | ConvertTo-Json
} | ConvertTo-Json -Depth 3

Write-Host "Test event:" -ForegroundColor Gray
Write-Host $testEvent

Write-Host "`nInvoking Lambda..." -ForegroundColor Gray
$result = aws lambda invoke `
    --function-name shelcaster-create-medialive-channel `
    --payload $testEvent `
    --profile $profile `
    --region $region `
    response.json

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Lambda invoked successfully" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor Cyan
    Get-Content response.json | ConvertFrom-Json | ConvertTo-Json -Depth 5
} else {
    Write-Host "[ERROR] Lambda invocation failed" -ForegroundColor Red
    Get-Content response.json
}

# Check for errors in response
$response = Get-Content response.json | ConvertFrom-Json
if ($response.errorMessage) {
    Write-Host "`n[ERROR] Lambda returned error:" -ForegroundColor Red
    Write-Host $response.errorMessage
    Write-Host "`nStack trace:" -ForegroundColor Gray
    Write-Host $response.errorType
    Write-Host $response.trace
}

# Test 2: List MediaLive Channels
Write-Host "`n2. Listing MediaLive channels..." -ForegroundColor Yellow
aws medialive list-channels --profile $profile --region $region --query "Channels[*].{Name:Name,Id:Id,State:State}" --output table

# Test 3: List MediaLive Inputs
Write-Host "`n3. Listing MediaLive inputs..." -ForegroundColor Yellow
aws medialive list-inputs --profile $profile --region $region --query "Inputs[*].{Name:Name,Id:Id,Type:Type,State:State}" --output table

Write-Host "`nTest complete!" -ForegroundColor Green
Write-Host "`nNote: If channel was created, remember to delete it to avoid charges:" -ForegroundColor Yellow
Write-Host "aws medialive delete-channel --channel-id <CHANNEL_ID> --profile $profile --region $region"
