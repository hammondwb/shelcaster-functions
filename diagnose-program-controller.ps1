# Diagnose Program Controller Issues
Write-Host "Diagnosing Program Controller..." -ForegroundColor Cyan

# 1. Check if task is running
Write-Host "`n1. Checking ECS task status..." -ForegroundColor Yellow
$tasks = aws ecs list-tasks --cluster shelcaster-cluster --region us-east-1 --profile shelcaster-admin | ConvertFrom-Json
if ($tasks.taskArns.Count -gt 0) {
    Write-Host "   Task running: $($tasks.taskArns[0])" -ForegroundColor Green
    $taskId = $tasks.taskArns[0].Split("/")[-1]
} else {
    Write-Host "   No tasks running!" -ForegroundColor Red
    exit
}

# 2. Check SQS queue for messages
Write-Host "`n2. Checking SQS queue..." -ForegroundColor Yellow
$queueUrl = "https://sqs.us-east-1.amazonaws.com/124355640062/shelcaster-program-commands"
$messages = aws sqs get-queue-attributes --queue-url $queueUrl --attribute-names ApproximateNumberOfMessages --region us-east-1 --profile shelcaster-admin | ConvertFrom-Json
Write-Host "   Messages in queue: $($messages.Attributes.ApproximateNumberOfMessages)" -ForegroundColor Cyan

# 3. Get recent log streams
Write-Host "`n3. Getting recent log streams..." -ForegroundColor Yellow
$streams = aws logs describe-log-streams --log-group-name /ecs/shelcaster-program-controller --order-by LastEventTime --descending --max-items 1 --region us-east-1 --profile shelcaster-admin | ConvertFrom-Json
$latestStream = $streams.logStreams[0].logStreamName
Write-Host "   Latest stream: $latestStream" -ForegroundColor Cyan

# 4. Check for errors in logs
Write-Host "`n4. Checking for errors..." -ForegroundColor Yellow
Write-Host "   (Saving logs to program-controller-logs.txt)" -ForegroundColor Gray
aws logs get-log-events --log-group-name /ecs/shelcaster-program-controller --log-stream-name $latestStream --limit 100 --region us-east-1 --profile shelcaster-admin --output text > program-controller-logs.txt

$errorCount = (Select-String -Path program-controller-logs.txt -Pattern "ERROR|Error|error|Failed|failed" | Measure-Object).Count
if ($errorCount -gt 0) {
    Write-Host "   Found $errorCount error messages" -ForegroundColor Red
    Write-Host "   Check program-controller-logs.txt for details" -ForegroundColor Yellow
} else {
    Write-Host "   No errors found" -ForegroundColor Green
}

# 5. Check if task joined stage
$joinedStage = (Select-String -Path program-controller-logs.txt -Pattern "Joined IVS stage|Successfully joined" | Measure-Object).Count
if ($joinedStage -gt 0) {
    Write-Host "   Task successfully joined IVS stage" -ForegroundColor Green
} else {
    Write-Host "   Task may not have joined IVS stage" -ForegroundColor Red
}

# 6. Check if media is playing
$playingMedia = (Select-String -Path program-controller-logs.txt -Pattern "Playing media|Media playing" | Measure-Object).Count
if ($playingMedia -gt 0) {
    Write-Host "   Task is playing media" -ForegroundColor Green
} else {
    Write-Host "   No media playback detected" -ForegroundColor Yellow
}

Write-Host "`nDiagnostics complete. Check program-controller-logs.txt for full logs." -ForegroundColor Cyan
