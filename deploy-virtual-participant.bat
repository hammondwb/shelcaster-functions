@echo off
setlocal
set PROFILE=shelcaster-admin
set REGION=us-east-1
set ROLE=arn:aws:iam::124355640062:role/lambda-dynamodb-role

echo ========================================
echo Deploying Virtual Participant Functions
echo ========================================

REM shelcaster-invite-virtual-participant
echo.
echo [1/2] Deploying shelcaster-invite-virtual-participant...
cd shelcaster-invite-virtual-participant
call npm install --production >nul 2>&1
powershell Compress-Archive -Path * -DestinationPath ../shelcaster-invite-vp.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-invite-virtual-participant --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-invite-virtual-participant --zip-file fileb://shelcaster-invite-vp.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-invite-virtual-participant
) else (
    aws lambda create-function --function-name shelcaster-invite-virtual-participant --runtime nodejs20.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-invite-vp.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-invite-virtual-participant
)
del shelcaster-invite-vp.zip >nul 2>&1

REM shelcaster-control-virtual-participant
echo [2/2] Deploying shelcaster-control-virtual-participant...
cd shelcaster-control-virtual-participant
call npm install --production >nul 2>&1
powershell Compress-Archive -Path * -DestinationPath ../shelcaster-control-vp.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-control-virtual-participant --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-control-virtual-participant --zip-file fileb://shelcaster-control-vp.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-control-virtual-participant
) else (
    aws lambda create-function --function-name shelcaster-control-virtual-participant --runtime nodejs20.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-control-vp.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-control-virtual-participant
)
del shelcaster-control-vp.zip >nul 2>&1

echo.
echo ========================================
echo Deployment Complete!
echo Virtual Participant functions deployed
echo ========================================
echo.
echo Next steps:
echo 1. Add API Gateway routes (see DEPLOYMENT-CHECKLIST.md)
echo 2. Update IAM permissions for IVS
echo 3. Test from frontend

