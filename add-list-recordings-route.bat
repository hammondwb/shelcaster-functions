@echo off
echo Adding list-recordings API route...
echo.

set API_ID=td0dn99gi2
set REGION=us-east-1
set ACCOUNT_ID=124355640062
set LAMBDA_NAME=shelcaster-list-recordings

echo Step 1: Getting API Gateway resources...
aws apigateway get-resources --rest-api-id %API_ID% --region %REGION% > resources-temp.json

echo.
echo Step 2: Finding resource IDs...
echo Please check resources-temp.json to find:
echo   - users resource ID
echo   - {userId} resource ID (child of users)
echo.
echo Enter the {userId} resource ID:
set /p USER_ID_RESOURCE_ID=

echo.
echo Step 3: Creating recordings resource...
aws apigateway create-resource --rest-api-id %API_ID% --parent-id %USER_ID_RESOURCE_ID% --path-part recordings --region %REGION% > recordings-resource.json

echo.
echo Please check recordings-resource.json for the new resource ID
echo Enter the recordings resource ID:
set /p RECORDINGS_RESOURCE_ID=

echo.
echo Step 4: Adding GET method...
aws apigateway put-method --rest-api-id %API_ID% --resource-id %RECORDINGS_RESOURCE_ID% --http-method GET --authorization-type COGNITO_USER_POOLS --authorizer-id arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:shelcaster-authorizer/invocations --region %REGION%

echo.
echo Step 5: Adding Lambda integration...
aws apigateway put-integration --rest-api-id %API_ID% --resource-id %RECORDINGS_RESOURCE_ID% --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:%LAMBDA_NAME%/invocations --region %REGION%

echo.
echo Step 6: Adding Lambda permission...
aws lambda add-permission --function-name %LAMBDA_NAME% --statement-id apigateway-list-recordings-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/GET/users/{userId}/recordings --region %REGION%

echo.
echo Step 7: Adding OPTIONS method for CORS...
aws apigateway put-method --rest-api-id %API_ID% --resource-id %RECORDINGS_RESOURCE_ID% --http-method OPTIONS --authorization-type NONE --region %REGION%

aws apigateway put-integration --rest-api-id %API_ID% --resource-id %RECORDINGS_RESOURCE_ID% --http-method OPTIONS --type MOCK --request-templates "{\"application/json\": \"{\\\"statusCode\\\": 200}\"}" --region %REGION%

aws apigateway put-method-response --rest-api-id %API_ID% --resource-id %RECORDINGS_RESOURCE_ID% --http-method OPTIONS --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" --region %REGION%

aws apigateway put-integration-response --rest-api-id %API_ID% --resource-id %RECORDINGS_RESOURCE_ID% --http-method OPTIONS --status-code 200 --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'GET,OPTIONS'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" --region %REGION%

echo.
echo Step 8: Deploying API...
aws apigateway create-deployment --rest-api-id %API_ID% --stage-name prod --region %REGION%

echo.
echo ========================================
echo API route added and deployed successfully!
echo Endpoint: GET https://%API_ID%.execute-api.%REGION%.amazonaws.com/prod/users/{userId}/recordings
echo ========================================
echo.

del resources-temp.json
del recordings-resource.json

pause
