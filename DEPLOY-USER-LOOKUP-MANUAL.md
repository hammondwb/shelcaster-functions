# Manual Deployment: User Lookup Function

Follow these steps one at a time in PowerShell.

## Step 1: Install Dependencies

```powershell
cd E:\projects\shelcaster-functions\shelcaster-lookup-user-by-email
npm install
```

## Step 2: Create Deployment Package

```powershell
# Still in shelcaster-lookup-user-by-email directory
if (Test-Path function.zip) { Remove-Item function.zip }
Compress-Archive -Path * -DestinationPath function.zip
```

## Step 3: Check if Function Exists

```powershell
aws lambda get-function --function-name shelcaster-lookup-user-by-email --region us-east-1
```

**If you get an error** (function doesn't exist), go to Step 4a.
**If you get a response** (function exists), go to Step 4b.

## Step 4a: Create New Function (if doesn't exist)

```powershell
aws lambda create-function `
    --function-name shelcaster-lookup-user-by-email `
    --runtime nodejs20.x `
    --role arn:aws:iam::124355640062:role/lambda-dynamodb-role `
    --handler index.handler `
    --zip-file fileb://function.zip `
    --timeout 30 `
    --memory-size 256 `
    --environment "Variables={USER_POOL_ID=us-east-1_VYdYII5Yw}" `
    --region us-east-1
```

Then skip to Step 5.

## Step 4b: Update Existing Function (if exists)

```powershell
# Update code
aws lambda update-function-code `
    --function-name shelcaster-lookup-user-by-email `
    --zip-file fileb://function.zip `
    --region us-east-1

# Update configuration
aws lambda update-function-configuration `
    --function-name shelcaster-lookup-user-by-email `
    --environment "Variables={USER_POOL_ID=us-east-1_VYdYII5Yw}" `
    --timeout 30 `
    --memory-size 256 `
    --region us-east-1
```

## Step 5: Get Function ARN

```powershell
$functionArn = aws lambda get-function `
    --function-name shelcaster-lookup-user-by-email `
    --region us-east-1 `
    --query 'Configuration.FunctionArn' `
    --output text

Write-Host "Function ARN: $functionArn"
```

## Step 6: Create API Gateway Integration

```powershell
$integrationId = aws apigatewayv2 create-integration `
    --api-id td0dn99gi2 `
    --integration-type AWS_PROXY `
    --integration-uri $functionArn `
    --payload-format-version 2.0 `
    --region us-east-1 `
    --query 'IntegrationId' `
    --output text

Write-Host "Integration ID: $integrationId"
```

## Step 7: Create API Gateway Route

```powershell
aws apigatewayv2 create-route `
    --api-id td0dn99gi2 `
    --route-key "GET /admin/users/lookup" `
    --target "integrations/$integrationId" `
    --region us-east-1
```

## Step 8: Grant API Gateway Permission

```powershell
aws lambda add-permission `
    --function-name shelcaster-lookup-user-by-email `
    --statement-id "apigateway-lookup-$(Get-Random)" `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn "arn:aws:execute-api:us-east-1:124355640062:td0dn99gi2/*/*" `
    --region us-east-1
```

## Step 9: Test the Endpoint

```powershell
cd E:\projects\shelcaster-functions

Invoke-RestMethod -Uri "https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/admin/users/lookup?email=hammond@sheldonmedia.com" -Method Get
```

You should get a response with the user's information including their `userId` (which is the Cognito sub).

## Troubleshooting

### Error: "ResourceNotFoundException"
The function doesn't exist yet. Use Step 4a to create it.

### Error: "AccessDeniedException" 
The IAM role doesn't have permission to access Cognito. Add this policy to the lambda-dynamodb-role:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cognito-idp:ListUsers"
            ],
            "Resource": "arn:aws:cognito-idp:us-east-1:124355640062:userpool/us-east-1_VYdYII5Yw"
        }
    ]
}
```

### Error: "ConflictException" when creating route
The route already exists. You can skip this step or delete the old route first:

```powershell
# List routes to find the route ID
aws apigatewayv2 get-routes --api-id td0dn99gi2 --region us-east-1 --query 'Items[?RouteKey==`GET /admin/users/lookup`]'

# Delete the route (replace ROUTE_ID with actual ID)
aws apigatewayv2 delete-route --api-id td0dn99gi2 --route-id ROUTE_ID --region us-east-1
```

Then try Step 7 again.

### CORS Error in Browser
Make sure the Lambda function includes CORS headers (it should already be in the code).

## Success!

If Step 9 returns user data, you're done! Now try assigning a channel in Vista Stream using an email address.
