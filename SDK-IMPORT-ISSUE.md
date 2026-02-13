# Lambda SDK Import Issue - RESOLVED WORKAROUND

## Problem
Node.js 22 Lambda runtime doesn't include AWS SDK v3 by default. When bundling `@aws-sdk/client-ivs` and `@aws-sdk/client-medialive` with the Lambda, the imports fail with "is not a constructor" errors.

## Root Cause
The AWS SDK v3 packages have complex module exports that don't work correctly when bundled with Lambda's Node.js 22 runtime.

## Attempted Solutions (Failed)
1. ❌ ES modules with named imports
2. ❌ CommonJS with destructured imports  
3. ❌ Default imports with destructuring
4. ❌ Namespace imports
5. ❌ Bundling node_modules with Lambda

## Working Solution
**Use DynamoDB SDK only** - DynamoDB client works fine, but IVS and MediaLive clients fail.

## Current Implementation
`shelcaster-start-streaming` Lambda:
- ✅ Gets session from DynamoDB
- ✅ Updates streaming state in DynamoDB
- ❌ Does NOT start MediaLive channel (pending fix)
- ❌ Does NOT start IVS channel (pending fix)

## Recommended Fix Options

### Option 1: Use Lambda Layer (Recommended)
Create a Lambda Layer with pre-built AWS SDK v3:
```powershell
mkdir lambda-layer
cd lambda-layer
npm init -y
npm install @aws-sdk/client-ivs @aws-sdk/client-medialive @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb
cd ..
powershell Compress-Archive -Path lambda-layer\\node_modules -DestinationPath aws-sdk-layer.zip
aws lambda publish-layer-version --layer-name aws-sdk-v3 --zip-file fileb://aws-sdk-layer.zip --compatible-runtimes nodejs22.x --region us-east-1
```

Then attach layer to Lambda:
```powershell
aws lambda update-function-configuration --function-name shelcaster-start-streaming --layers arn:aws:lambda:us-east-1:124355640062:layer:aws-sdk-v3:1 --region us-east-1
```

### Option 2: Use Node.js 18 Runtime
Node.js 18 includes AWS SDK v2 which has different import patterns:
```javascript
const AWS = require('aws-sdk');
const ivs = new AWS.IVS({ region: 'us-east-1' });
```

Change runtime:
```powershell
aws lambda update-function-configuration --function-name shelcaster-start-streaming --runtime nodejs18.x --region us-east-1
```

### Option 3: Use AWS SDK JavaScript v3 Bundler
Use esbuild to properly bundle the SDK:
```powershell
npm install -D esbuild
npx esbuild index.js --bundle --platform=node --target=node22 --outfile=dist/index.js
```

## Testing Status
- ✅ API Gateway routes created
- ✅ CORS enabled
- ✅ Lambda permissions configured
- ✅ DynamoDB operations working
- ⏳ IVS/MediaLive operations pending SDK fix

## Next Steps
1. Implement Option 1 (Lambda Layer) - most reliable
2. Test IVS channel start/stop
3. Test MediaLive channel start/stop
4. Complete recording start/stop Lambdas
5. Full end-to-end testing
