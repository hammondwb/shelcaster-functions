# Test program-controller deployment
# This script checks if a new ECS task starts and successfully joins the IVS stage

$ErrorActionPreference = "Stop"

Write-Host "Waiting for new ECS task to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

Write-Host "`nChecking for running tasks..." -ForegroundColor Cyan
$tasks = aws ecs list-tasks --cluster shelcaster-cluster --region us-east-1 | ConvertFrom-Json

if ($tasks.taskArns.Count -eq 0) {
    Write-Host "No tasks running. You need to trigger a new session from the frontend." -ForegroundColor Yellow
    Write-Host "1. Go to /podcast in the browser" -ForegroundColor Gray
    Write-Host "2. Click 'Go Live' button" -ForegroundColor Gray
    Write-Host "3. This will call create-session Lambda which starts the ECS task" -ForegroundColor Gray
    exit 0
}

$taskArn = $tasks.taskArns[0]
Write-Host "Found task: $taskArn" -ForegroundColor Green

Write-Host "`nWaiting 30 seconds for task to initialize..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

Write-Host "`nFetching logs..." -ForegroundColor Cyan
$logEvents = aws logs get-log-events `
    --log-group-name "/ecs/shelcaster-program-controller" `
    --log-stream-name "ecs/program-controller/$($taskArn.Split('/')[-1])" `
    --limit 50 `
    --region us-east-1 | ConvertFrom-Json

Write-Host "`nRecent logs:" -ForegroundColor Cyan
foreach ($event in $logEvents.events) {
    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).ToString("HH:mm:ss")
    Write-Host "[$timestamp] $($event.message)"
}

Write-Host "`n" -ForegroundColor Cyan
Write-Host "Looking for success indicators..." -ForegroundColor Cyan
$joinSuccess = $logEvents.events | Where-Object { $_.message -like "*Step 10: Successfully joined IVS stage*" }
$pollingStarted = $logEvents.events | Where-Object { $_.message -like "*Step 12: Starting SQS polling*" }

if ($joinSuccess) {
    Write-Host "✓ Task successfully joined IVS stage!" -ForegroundColor Green
} else {
    Write-Host "✗ Task has not joined IVS stage yet" -ForegroundColor Red
}

if ($pollingStarted) {
    Write-Host "✓ SQS polling started!" -ForegroundColor Green
} else {
    Write-Host "✗ SQS polling not started yet" -ForegroundColor Red
}
