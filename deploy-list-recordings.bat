@echo off
echo Deploying shelcaster-list-recordings Lambda function...

cd shelcaster-list-recordings
if exist function.zip del function.zip
tar -a -c -f function.zip index.mjs

echo Checking if function exists...
aws lambda get-function --function-name shelcaster-list-recordings --region us-east-1 >nul 2>&1

if %errorlevel% equ 0 (
    echo Function exists, updating...
    aws lambda update-function-code --function-name shelcaster-list-recordings --zip-file fileb://function.zip --region us-east-1
) else (
    echo Function does not exist, creating...
    aws lambda create-function --function-name shelcaster-list-recordings --runtime nodejs20.x --role arn:aws:iam::124355640062:role/shelcaster-lambda-role --handler index.handler --zip-file fileb://function.zip --timeout 30 --memory-size 256 --region us-east-1
)

del function.zip
cd ..

echo.
echo Lambda function deployed successfully!
echo.
echo Next: Run add-list-recordings-route.bat to add API Gateway route
pause
