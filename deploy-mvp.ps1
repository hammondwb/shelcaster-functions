$ErrorActionPreference = "Stop"
$PROFILE = "shelcaster-admin"
$REGION = "us-east-1"
$ROLE_ARN = "arn:aws:iam::124355640062:role/lambda-dynamodb-role"

# Load environment variables from .env.medialive
$MEDIALIVE_ROLE_ARN = $null
if (Test-Path ".env.medialive") {
    $envVars = @{}
    Get-Content ".env.medialive" | Where-Object { $_ -match '=' } | ForEach-Object {
        $parts = $_ -split '=', 2
        $envVars[$parts[0].Trim()] = $parts[1].Trim()
    }
    $MEDIALIVE_ROLE_ARN = $envVars['MEDIALIVE_ROLE_ARN']
    Write-Host "Loaded .env.medialive" -ForegroundColor Gray
} else {
    Write-Host "WARNING: .env.medialive not found" -ForegroundColor Yellow
}

function Create-LambdaZip {
    param([string]$FunctionDir, [string]$IndexFile)
    Push-Location $FunctionDir
    if (Test-Path function.zip) { Remove-Item function.zip }
    if (Test-Path node_modules) {
        $items = @($IndexFile)
        if (Test-Path package.json) { $items += "package.json" }
        $items += "node_modules"
        tar -a -c -f function.zip @items
        Write-Host "    Zipped with node_modules" -ForegroundColor Gray
    } else {
        tar -a -c -f function.zip $IndexFile
        Write-Host "    Zipped $IndexFile only" -ForegroundColor Gray
    }
    Pop-Location
}

function Deploy-Function {
    param(
        [string]$FunctionName,
        [string]$IndexFile,
        [hashtable]$EnvVars = $null,
        [switch]$InstallDeps
    )
    Write-Host ""
    Write-Host "  Deploying $FunctionName..." -ForegroundColor Cyan
    if ($InstallDeps -and (Test-Path "$FunctionName/package.json")) {
        Write-Host "    npm install --omit=dev" -ForegroundColor Yellow
        Push-Location $FunctionName
        npm install --omit=dev 2>&1 | Out-Null
        Pop-Location
    }
    Create-LambdaZip $FunctionName $IndexFile
    aws lambda get-function --function-name $FunctionName --profile $PROFILE --region $REGION 2>&1 | Out-Null
    $functionExists = $LASTEXITCODE -eq 0
    if ($functionExists) {
        Write-Host "    Updating code..." -ForegroundColor Yellow
        aws lambda update-function-code --function-name $FunctionName --zip-file "fileb://$FunctionName/function.zip" --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "    FAILED to update code" -ForegroundColor Red
            return $false
        }
        Start-Sleep -Seconds 3
        if ($EnvVars -and $EnvVars.Count -gt 0) {
            $pairs = @()
            foreach ($kv in $EnvVars.GetEnumerator()) { $pairs += "$($kv.Key)=$($kv.Value)" }
            $envString = $pairs -join ','
            Write-Host "    Updating env: $envString" -ForegroundColor Yellow
            aws lambda update-function-configuration --function-name $FunctionName --environment "Variables={$envString}" --profile $PROFILE --region $REGION --no-cli-pager | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "    FAILED to update env" -ForegroundColor Red
                return $false
            }
        }
    } else {
        Write-Host "    Creating new function..." -ForegroundColor Yellow
        $createCmd = "aws lambda create-function --function-name $FunctionName --runtime nodejs22.x --role $ROLE_ARN --handler index.handler"
        $createCmd += " --zip-file fileb://$FunctionName/function.zip --timeout 30 --memory-size 256"
        $createCmd += " --profile $PROFILE --region $REGION --no-cli-pager"
        if ($EnvVars -and $EnvVars.Count -gt 0) {
            $pairs = @()
            foreach ($kv in $EnvVars.GetEnumerator()) { $pairs += "$($kv.Key)=$($kv.Value)" }
            $envString = $pairs -join ','
            $createCmd += " --environment ""Variables={$envString}"""
        }
        Invoke-Expression $createCmd | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "    FAILED to create function" -ForegroundColor Red
            return $false
        }
    }
    Remove-Item "$FunctionName/function.zip" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $status = aws lambda get-function --function-name $FunctionName --profile $PROFILE --region $REGION --query "Configuration.LastUpdateStatus" --output text
    if ($status -eq "Successful") {
        Write-Host "    OK" -ForegroundColor Green
    } else {
        Write-Host "    Status: $status" -ForegroundColor Yellow
    }
    return $true
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor White
Write-Host "  Deploying MVP Lambda functions - 5 total" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor White
$results = @()
$results += Deploy-Function -FunctionName "shelcaster-start-composition" -IndexFile "index.mjs" -InstallDeps
$envStreaming = @{}
if ($MEDIALIVE_ROLE_ARN) { $envStreaming['MEDIALIVE_ROLE_ARN'] = $MEDIALIVE_ROLE_ARN }
$results += Deploy-Function -FunctionName "shelcaster-start-streaming" -IndexFile "index.js" -EnvVars $envStreaming -InstallDeps
$results += Deploy-Function -FunctionName "shelcaster-session-command" -IndexFile "index.mjs" -InstallDeps
$envChannel = @{}
if ($MEDIALIVE_ROLE_ARN) { $envChannel['MEDIALIVE_ROLE_ARN'] = $MEDIALIVE_ROLE_ARN }
$results += Deploy-Function -FunctionName "shelcaster-create-medialive-channel" -IndexFile "index.mjs" -EnvVars $envChannel
$results += Deploy-Function -FunctionName "shelcaster-end-session" -IndexFile "index.mjs"

Write-Host ""
Write-Host "========================================================" -ForegroundColor White
$passed = @($results | Where-Object { $_ -eq $true }).Count
$total = $results.Count
if ($passed -eq $total) {
    Write-Host "  All $total functions deployed successfully" -ForegroundColor Green
} else {
    $failed = $total - $passed
    Write-Host "  $passed of $total deployed - $failed failed" -ForegroundColor Red
}
Write-Host "========================================================" -ForegroundColor White

