# Quick check if program-controller is working
$tasks = aws ecs list-tasks --cluster shelcaster-cluster --region us-east-1 | ConvertFrom-Json

if ($tasks.taskArns.Count -eq 0) {
    Write-Host "No task running. Go to /podcast and click 'Go Live'" -ForegroundColor Yellow
    exit
}

$taskId = $tasks.taskArns[0].Split('/')[-1]
Write-Host "Checking task: $taskId" -ForegroundColor Cyan

$logs = aws logs get-log-events `
    --log-group-name "/ecs/shelcaster-program-controller" `
    --log-stream-name "ecs/program-controller/$taskId" `
    --limit 100 `
    --region us-east-1 | ConvertFrom-Json

$joined = $logs.events | Where-Object { $_.message -like "*Successfully joined IVS stage*" }
$polling = $logs.events | Where-Object { $_.message -like "*Starting SQS polling*" }

if ($joined -and $polling) {
    Write-Host "`n✓ SUCCESS! Task joined stage and is polling for commands" -ForegroundColor Green
    Write-Host "You can now play tracks - audio should work!" -ForegroundColor Green
} else {
    Write-Host "`n✗ Task not ready yet. Recent logs:" -ForegroundColor Yellow
    $logs.events | Select-Object -Last 10 | ForEach-Object { Write-Host $_.message }
}
