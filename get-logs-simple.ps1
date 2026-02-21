# Get logs for user lookup function - simple version

$logStreamName = "2026/02/20/[`$LATEST]ab63926f7d084a8f885e29556536887b"

Write-Host "Getting logs..." -ForegroundColor Yellow
Write-Host ""

aws logs get-log-events `
    --log-group-name "/aws/lambda/shelcaster-lookup-user-by-email" `
    --log-stream-name $logStreamName `
    --region us-east-1 `
    --limit 50
