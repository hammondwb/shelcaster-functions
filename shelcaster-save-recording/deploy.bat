@echo off
echo Installing dependencies...
call npm install

echo Creating deployment package...
powershell -ExecutionPolicy Bypass -Command "Compress-Archive -Path index.mjs,node_modules,package.json -DestinationPath deploy.zip -Force"

echo Deploying to AWS Lambda...
aws lambda create-function --function-name shelcaster-save-recording --runtime nodejs22.x --role arn:aws:iam::124355640062:role/lambda-dynamodb-role --handler index.handler --zip-file fileb://deploy.zip --timeout 30 --memory-size 256 --profile shelcaster-admin --region us-east-1 2>nul

if %ERRORLEVEL% NEQ 0 (
    echo Function exists, updating...
    aws lambda update-function-code --function-name shelcaster-save-recording --zip-file fileb://deploy.zip --profile shelcaster-admin --region us-east-1
)

echo Done!
del deploy.zip

