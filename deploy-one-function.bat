@echo off
setlocal

set FUNCTION_NAME=%1
set PROFILE=shelcaster-admin
set REGION=us-east-1
set ROLE=arn:aws:iam::124355640062:role/lambda-dynamodb-role
set RUNTIME=nodejs22.x

echo Deploying %FUNCTION_NAME%...

cd %FUNCTION_NAME%
powershell Compress-Archive -Path index.mjs -DestinationPath ../%FUNCTION_NAME%.zip -Force
cd ..

echo Checking if function exists...
aws lambda get-function --function-name %FUNCTION_NAME% --profile %PROFILE% --region %REGION% >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo Function exists - updating...
    aws lambda update-function-code --function-name %FUNCTION_NAME% --zip-file fileb://%FUNCTION_NAME%.zip --profile %PROFILE% --region %REGION% --no-cli-pager
) else (
    echo Function does not exist - creating...
    aws lambda create-function --function-name %FUNCTION_NAME% --runtime %RUNTIME% --role %ROLE% --handler index.handler --zip-file fileb://%FUNCTION_NAME%.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager
)

del %FUNCTION_NAME%.zip

echo Done!

