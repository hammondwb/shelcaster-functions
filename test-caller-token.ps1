$body = @{
    callerName = "Test Caller"
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/shows/20d1044b-a005-41fb-a39c-83238f71e1c1/caller-token" `
    -Method POST `
    -Headers @{'Content-Type'='application/json'} `
    -Body $body

Write-Host "Response:" -ForegroundColor Green
$response | ConvertTo-Json -Depth 10

