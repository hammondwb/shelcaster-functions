@echo off
REM Create MediaLive API Gateway Routes

set API_ID=td0dn99gi2
set REGION=us-east-1
set ACCOUNT_ID=124355640062

echo Creating MediaLive API Gateway Routes...
echo.

REM 1. Create MediaLive Channel
echo 1. POST /shows/{showId}/medialive-channel
aws apigatewayv2 create-route ^
  --api-id %API_ID% ^
  --route-key "POST /shows/{showId}/medialive-channel" ^
  --target "integrations/$(aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:shelcaster-create-medialive-channel/invocations --payload-format-version 2.0 --query IntegrationId --output text)" ^
  --region %REGION%

REM 2. Start Streaming
echo 2. POST /sessions/{sessionId}/streaming/start
aws apigatewayv2 create-route ^
  --api-id %API_ID% ^
  --route-key "POST /sessions/{sessionId}/streaming/start" ^
  --target "integrations/$(aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:shelcaster-start-streaming/invocations --payload-format-version 2.0 --query IntegrationId --output text)" ^
  --region %REGION%

REM 3. Stop Streaming
echo 3. POST /sessions/{sessionId}/streaming/stop
aws apigatewayv2 create-route ^
  --api-id %API_ID% ^
  --route-key "POST /sessions/{sessionId}/streaming/stop" ^
  --target "integrations/$(aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:shelcaster-stop-streaming/invocations --payload-format-version 2.0 --query IntegrationId --output text)" ^
  --region %REGION%

REM 4. Start Recording
echo 4. POST /sessions/{sessionId}/recording/start
aws apigatewayv2 create-route ^
  --api-id %API_ID% ^
  --route-key "POST /sessions/{sessionId}/recording/start" ^
  --target "integrations/$(aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:shelcaster-start-recording/invocations --payload-format-version 2.0 --query IntegrationId --output text)" ^
  --region %REGION%

REM 5. Stop Recording
echo 5. POST /sessions/{sessionId}/recording/stop
aws apigatewayv2 create-route ^
  --api-id %API_ID% ^
  --route-key "POST /sessions/{sessionId}/recording/stop" ^
  --target "integrations/$(aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:shelcaster-stop-recording/invocations --payload-format-version 2.0 --query IntegrationId --output text)" ^
  --region %REGION%

echo.
echo Done! Routes created.
