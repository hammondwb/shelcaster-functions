@echo off
setlocal
set PROFILE=shelcaster-admin
set REGION=us-east-1
set ACCOUNT_ID=124355640062
set REPO_NAME=shelcaster-vp

echo ========================================
echo Building and Pushing VP Docker Image
echo ========================================

echo.
echo [1/4] Logging into ECR...
aws ecr get-login-password --region %REGION% --profile %PROFILE% | docker login --username AWS --password-stdin %ACCOUNT_ID%.dkr.ecr.%REGION%.amazonaws.com

echo.
echo [2/4] Building Docker image...
cd shelcaster-virtual-participant
docker build -t %REPO_NAME% .
cd ..

echo.
echo [3/4] Tagging image...
docker tag %REPO_NAME%:latest %ACCOUNT_ID%.dkr.ecr.%REGION%.amazonaws.com/%REPO_NAME%:latest

echo.
echo [4/4] Pushing to ECR...
docker push %ACCOUNT_ID%.dkr.ecr.%REGION%.amazonaws.com/%REPO_NAME%:latest

echo.
echo ========================================
echo Docker Image Pushed Successfully!
echo ========================================
echo Image URI: %ACCOUNT_ID%.dkr.ecr.%REGION%.amazonaws.com/%REPO_NAME%:latest

