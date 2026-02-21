# Manual Deployment Guide: List Recordings Feature

## Step 1: Create Deployment Package

```cmd
cd E:\projects\shelcaster-functions\shelcaster-list-recordings
del function.zip
tar -a -c -f function.zip index.mjs
```

## Step 2: Deploy Lambda Function

Check if function exists:
```cmd
aws lambda get-function --function-name shelcaster-list-recordings --region us-east-1
```

If function exists, update it:
```cmd
aws lambda update-function-code --function-name shelcaster-list-recordings --zip-file fileb://function.zip --region us-east-1
```

If function doesn't exist, create it:
```cmd
aws lambda create-function --function-name shelcaster-list-recordings --runtime nodejs20.x --role arn:aws:iam::124355640062:role/shelcaster-lambda-role --handler index.handler --zip-file fileb://function.zip --timeout 30 --memory-size 256 --region us-east-1
```

## Step 3: Get API Gateway Resources

```cmd
aws apigateway get-resources --rest-api-id td0dn99gi2 --region us-east-1 > resources.json
```

Open `resources.json` and find:
- `users` resource ID
- `{userId}` resource ID (child of users)

## Step 4: Create Recordings Resource

Replace `<userId-resource-id>` with the actual ID from Step 3:

```cmd
aws apigateway create-resource --rest-api-id td0dn99gi2 --parent-id <userId-resource-id> --path-part recordings --region us-east-1
```

Note the `id` from the response - this is your `<recordings-resource-id>`

## Step 5: Add GET Method

Replace `<recordings-resource-id>`:

```cmd
aws apigateway put-method --rest-api-id td0dn99gi2 --resource-id <recordings-resource-id> --http-method GET --authorization-type COGNITO_USER_POOLS --authorizer-id arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:124355640062:function:shelcaster-authorizer/invocations --region us-east-1
```

## Step 6: Add Lambda Integration

```cmd
aws apigateway put-integration --rest-api-id td0dn99gi2 --resource-id <recordings-resource-id> --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:124355640062:function:shelcaster-list-recordings/invocations --region us-east-1
```

## Step 7: Add Lambda Permission

```cmd
aws lambda add-permission --function-name shelcaster-list-recordings --statement-id apigateway-list-recordings-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:124355640062:td0dn99gi2/*/GET/users/{userId}/recordings --region us-east-1
```

## Step 8: Add CORS (OPTIONS Method)

```cmd
aws apigateway put-method --rest-api-id td0dn99gi2 --resource-id <recordings-resource-id> --http-method OPTIONS --authorization-type NONE --region us-east-1
```

```cmd
aws apigateway put-integration --rest-api-id td0dn99gi2 --resource-id <recordings-resource-id> --http-method OPTIONS --type MOCK --request-templates "{\"application/json\": \"{\\\"statusCode\\\": 200}\"}" --region us-east-1
```

```cmd
aws apigateway put-method-response --rest-api-id td0dn99gi2 --resource-id <recordings-resource-id> --http-method OPTIONS --status-code 200 --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" --region us-east-1
```

```cmd
aws apigateway put-integration-response --rest-api-id td0dn99gi2 --resource-id <recordings-resource-id> --http-method OPTIONS --status-code 200 --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'GET,OPTIONS'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" --region us-east-1
```

## Step 9: Deploy API

```cmd
aws apigateway create-deployment --rest-api-id td0dn99gi2 --stage-name prod --region us-east-1
```

## Step 10: Test

```cmd
curl -H "Authorization: Bearer <your-token>" https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/prod/users/<your-user-id>/recordings
```

## Verification

The endpoint should return:
```json
{
  "files": [...],
  "count": <number>
}
```

Once deployed, the Saved Shows section in the Content Library will display all IVS recordings.
