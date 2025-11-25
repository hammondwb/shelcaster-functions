@echo off
setlocal
set PROFILE=shelcaster-admin
set REGION=us-east-1
set API_ID=td0dn99gi2
set ACCOUNT_ID=124355640062

echo ========================================
echo Adding Virtual Participant API Routes
echo ========================================

REM Get authorizer ID
for /f %%i in ('aws apigatewayv2 get-authorizers --api-id %API_ID% --profile %PROFILE% --region %REGION% --query "Items[0].AuthorizerId" --output text') do set AUTHORIZER_ID=%%i

echo.
echo [1/3] Creating route: POST /shows/{showId}/virtual-participant/invite
aws apigatewayv2 create-route --api-id %API_ID% --route-key "POST /shows/{showId}/virtual-participant/invite" --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --target "integrations/$(aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:shelcaster-invite-virtual-participant/invocations --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query IntegrationId --output text)" --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
echo   Created invite route

echo [2/3] Creating route: POST /shows/{showId}/virtual-participant/control
aws apigatewayv2 create-route --api-id %API_ID% --route-key "POST /shows/{showId}/virtual-participant/control" --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --target "integrations/$(aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:shelcaster-control-virtual-participant/invocations --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query IntegrationId --output text)" --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
echo   Created control route

echo [3/3] Adding Lambda permissions
aws lambda add-permission --function-name shelcaster-invite-virtual-participant --statement-id apigateway-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*" --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-control-virtual-participant --statement-id apigateway-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*" --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
echo   Added Lambda permissions

echo.
echo ========================================
echo API Routes Added Successfully!
echo ========================================

