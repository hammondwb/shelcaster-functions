# Simple Route Setup for List Recordings

The Lambda function is deployed. Now we just need to add the API route.

**IMPORTANT: Add `--profile shelcaster-admin` to all commands!**

## Step 1: Get Resource IDs

Run this command:
```cmd
aws apigateway get-resources --rest-api-id td0dn99gi2 --region us-east-1 --profile shelcaster-admin
```

Look for:
- The resource with `"pathPart": "users"` - note its `"id"`
- The resource with `"pathPart": "{userId}"` that has the users resource as parent - note its `"id"`

Let's call the {userId} resource ID: `USER_ID_RESOURCE_ID`

## Step 2: Create recordings resource

Replace `USER_ID_RESOURCE_ID` with the actual ID from Step 1:

```cmd
aws apigateway create-resource --rest-api-id td0dn99gi2 --parent-id USER_ID_RESOURCE_ID --path-part recordings --region us-east-1 --profile shelcaster-admin
```

Note the `"id"` from the response. Let's call it: `RECORDINGS_RESOURCE_ID`

## Step 3: Add GET method

Replace `RECORDINGS_RESOURCE_ID`:

```cmd
aws apigateway put-method --rest-api-id td0dn99gi2 --resource-id RECORDINGS_RESOURCE_ID --http-method GET --authorization-type COGNITO_USER_POOLS --authorizer-id arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:124355640062:function:shelcaster-authorizer/invocations --region us-east-1 --profile shelcaster-admin
```

## Step 4: Add Lambda integration

```cmd
aws apigateway put-integration --rest-api-id td0dn99gi2 --resource-id RECORDINGS_RESOURCE_ID --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:124355640062:function:shelcaster-list-recordings/invocations --region us-east-1 --profile shelcaster-admin
```

## Step 5: Add Lambda permission

```cmd
aws lambda add-permission --function-name shelcaster-list-recordings --statement-id apigateway-invoke-recordings --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:us-east-1:124355640062:td0dn99gi2/*/GET/users/{userId}/recordings" --region us-east-1 --profile shelcaster-admin
```

## Step 6: Add CORS

```cmd
aws apigateway put-method --rest-api-id td0dn99gi2 --resource-id RECORDINGS_RESOURCE_ID --http-method OPTIONS --authorization-type NONE --region us-east-1 --profile shelcaster-admin

aws apigateway put-integration --rest-api-id td0dn99gi2 --resource-id RECORDINGS_RESOURCE_ID --http-method OPTIONS --type MOCK --request-templates "{\"application/json\":\"{\\\"statusCode\\\":200}\"}" --region us-east-1 --profile shelcaster-admin

aws apigateway put-method-response --rest-api-id td0dn99gi2 --resource-id RECORDINGS_RESOURCE_ID --http-method OPTIONS --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" --region us-east-1 --profile shelcaster-admin

aws apigateway put-integration-response --rest-api-id td0dn99gi2 --resource-id RECORDINGS_RESOURCE_ID --http-method OPTIONS --status-code 200 --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'GET,OPTIONS'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" --region us-east-1 --profile shelcaster-admin
```

## Step 7: Deploy

```cmd
aws apigateway create-deployment --rest-api-id td0dn99gi2 --stage-name prod --region us-east-1 --profile shelcaster-admin
```

## Done!

The endpoint will be available at:
```
GET https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/prod/users/{userId}/recordings
```

Refresh your Content Library page and the Saved Shows section should now display your IVS recordings!
