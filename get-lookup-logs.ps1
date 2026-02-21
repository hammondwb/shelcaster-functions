# Get recent logs for user lookup function

$FUNCTION_NAME = "shelcaster-lookup-user-by-email"
$REGION = "us-east-1"

Write-Host "Fetching recent logs for $FUNCTION_NAME..." -ForegroundColor Yellow
Write-Host ""

# Get the latest log stream
$logStream = aws logs describe-log-streams `
    --log-group-name "/aws/lambda/$FUNCTION_NAME" `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --region $REGION `
    --query 'logStreams[0].logStreamName' `
    --output text

if ($logStream) {
    Write-Host "Latest log stream: $logStream" -ForegroundColor Gray
    Write-Host ""
    
    # Get the log events
    aws logs get-log-events `
        --log-group-name "/aws/lambda/$FUNCTION_NAME" `
        --log-stream-name $logStream `
        --region $REGION `
        --query 'events[*].message' `
        --output text
} else {
    Write-Host "No log streams found" -ForegroundColor Red
}
