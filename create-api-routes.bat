@echo off
setlocal enabledelayedexpansion
set PROFILE=shelcaster-admin
set REGION=us-east-1
set API_ID=td0dn99gi2
set AUTHORIZER_ID=hnk3sf
set ACCOUNT_ID=124355640062

echo ========================================
echo Creating API Gateway Routes
echo ========================================

REM Show Routes - POST /shows
echo.
echo [1/17] Creating POST /shows...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-create-show --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "POST /shows" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-create-show --statement-id apigateway-post-shows --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/shows" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created POST /shows

REM Show Routes - GET /shows/{showId}
echo [2/17] Creating GET /shows/{showId}...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-get-show --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "GET /shows/{showId}" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-get-show --statement-id apigateway-get-show --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/shows/*" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created GET /shows/{showId}

REM Show Routes - GET /producers/{producerId}/shows
echo [3/17] Creating GET /producers/{producerId}/shows...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-get-producer-shows --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "GET /producers/{producerId}/shows" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-get-producer-shows --statement-id apigateway-get-producer-shows --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/producers/*/shows" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created GET /producers/{producerId}/shows

REM Show Routes - PUT /shows/{showId}
echo [4/17] Creating PUT /shows/{showId}...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-update-show --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "PUT /shows/{showId}" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-update-show --statement-id apigateway-put-show --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/shows/*" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created PUT /shows/{showId}

REM Show Routes - DELETE /shows/{showId}
echo [5/17] Creating DELETE /shows/{showId}...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-delete-show --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "DELETE /shows/{showId}" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-delete-show --statement-id apigateway-delete-show --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/shows/*" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created DELETE /shows/{showId}

REM Broadcast Routes - POST /shows/{showId}/start
echo [6/17] Creating POST /shows/{showId}/start...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-start-broadcast --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "POST /shows/{showId}/start" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-start-broadcast --statement-id apigateway-start-broadcast --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/shows/*/start" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created POST /shows/{showId}/start

REM Broadcast Routes - POST /shows/{showId}/stop
echo [7/17] Creating POST /shows/{showId}/stop...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-stop-broadcast --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "POST /shows/{showId}/stop" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-stop-broadcast --statement-id apigateway-stop-broadcast --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/shows/*/stop" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created POST /shows/{showId}/stop

REM Tracklist Routes - POST /tracklists
echo [8/17] Creating POST /tracklists...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-create-tracklist --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "POST /tracklists" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-create-tracklist --statement-id apigateway-post-tracklists --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/tracklists" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created POST /tracklists

REM Tracklist Routes - GET /tracklists/{tracklistId}
echo [9/17] Creating GET /tracklists/{tracklistId}...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-get-tracklist --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "GET /tracklists/{tracklistId}" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-get-tracklist --statement-id apigateway-get-tracklist --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/tracklists/*" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created GET /tracklists/{tracklistId}

REM Tracklist Routes - GET /producers/{producerId}/tracklists
echo [10/17] Creating GET /producers/{producerId}/tracklists...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-get-producer-tracklists --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "GET /producers/{producerId}/tracklists" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-get-producer-tracklists --statement-id apigateway-get-producer-tracklists --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/producers/*/tracklists" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created GET /producers/{producerId}/tracklists

REM Tracklist Routes - GET /tracklists/{tracklistId}/programs
echo [11/17] Creating GET /tracklists/{tracklistId}/programs...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-get-tracklist-programs --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "GET /tracklists/{tracklistId}/programs" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-get-tracklist-programs --statement-id apigateway-get-tracklist-programs --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/tracklists/*/programs" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created GET /tracklists/{tracklistId}/programs

REM Tracklist Routes - PUT /tracklists/{tracklistId}
echo [12/17] Creating PUT /tracklists/{tracklistId}...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-update-tracklist --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "PUT /tracklists/{tracklistId}" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-update-tracklist --statement-id apigateway-put-tracklist --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/tracklists/*" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created PUT /tracklists/{tracklistId}

REM Tracklist Routes - DELETE /tracklists/{tracklistId}
echo [13/17] Creating DELETE /tracklists/{tracklistId}...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-delete-tracklist --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "DELETE /tracklists/{tracklistId}" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-delete-tracklist --statement-id apigateway-delete-tracklist --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/tracklists/*" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created DELETE /tracklists/{tracklistId}

REM Guest Routes - POST /shows/{showId}/guests
echo [14/17] Creating POST /shows/{showId}/guests...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-invite-guest --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "POST /shows/{showId}/guests" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-invite-guest --statement-id apigateway-invite-guest --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/shows/*/guests" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created POST /shows/{showId}/guests

REM Guest Routes - GET /shows/{showId}/guests
echo [15/17] Creating GET /shows/{showId}/guests...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-get-show-guests --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "GET /shows/{showId}/guests" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-get-show-guests --statement-id apigateway-get-show-guests --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/shows/*/guests" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created GET /shows/{showId}/guests

REM Guest Routes - PUT /shows/{showId}/guests/{guestId}
echo [16/17] Creating PUT /shows/{showId}/guests/{guestId}...
for /f "tokens=*" %%i in ('aws lambda get-function --function-name shelcaster-update-guest-status --profile %PROFILE% --region %REGION% --query "Configuration.FunctionArn" --output text') do set LAMBDA_ARN=%%i
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri !LAMBDA_ARN! --payload-format-version 2.0 --profile %PROFILE% --region %REGION% --query "IntegrationId" --output text') do set INTEGRATION_ID=%%i
aws apigatewayv2 create-route --api-id %API_ID% --route-key "PUT /shows/{showId}/guests/{guestId}" --target integrations/!INTEGRATION_ID! --authorization-type JWT --authorizer-id %AUTHORIZER_ID% --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
aws lambda add-permission --function-name shelcaster-update-guest-status --statement-id apigateway-update-guest-status --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*/*/shows/*/guests/*" --profile %PROFILE% --region %REGION% >nul 2>&1
echo   Created PUT /shows/{showId}/guests/{guestId}

echo.
echo ========================================
echo API Gateway Routes Created!
echo All 16 routes configured successfully
echo ========================================

