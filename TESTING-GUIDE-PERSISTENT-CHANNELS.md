# Testing Guide: Persistent IVS Channels

This guide walks you through testing the Phase 1 implementation of persistent IVS channels.

## Prerequisites

1. AWS CLI configured with credentials
2. PowerShell (for deployment scripts)
3. Access to AWS Lambda, API Gateway, and DynamoDB
4. The Lambda functions must be created in AWS (if not, see "Initial Setup" below)

## Initial Setup (First Time Only)

If the Lambda functions don't exist in AWS yet, you'll need to create them first:

### Step 1: Create Lambda Functions in AWS Console

For each function, create a Lambda function with these settings:
- Runtime: Node.js 18.x or later
- Architecture: x86_64
- Execution role: Use existing role with DynamoDB and IVS permissions

Functions to create:
1. `shelcaster-create-persistent-channel`
2. `shelcaster-assign-channel`
3. `shelcaster-unassign-channel`
4. `shelcaster-get-host-channel`
5. `shelcaster-list-channels`
6. `shelcaster-get-channel-stats`
7. `shelcaster-get-channel-capacity`
8. `shelcaster-update-channel-state`

### Step 2: Ensure DynamoDB GSI Exists

The functions require a Global Secondary Index on the `shelcaster-app` table:

**Index Name**: `entityType-index`
**Partition Key**: `entityType` (String)
**Projection**: ALL

To check if it exists:
```powershell
aws dynamodb describe-table --table-name shelcaster-app --query "Table.GlobalSecondaryIndexes[?IndexName=='entityType-index']"
```

If it doesn't exist, create it:
```powershell
aws dynamodb update-table `
  --table-name shelcaster-app `
  --attribute-definitions AttributeName=entityType,AttributeType=S `
  --global-secondary-index-updates "[{\"Create\":{\"IndexName\":\"entityType-index\",\"KeySchema\":[{\"AttributeName\":\"entityType\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}}]"
```

## Testing Steps

### Step 1: Deploy Lambda Functions

Navigate to the functions directory and run the deployment script:

```powershell
cd e:\projects\shelcaster-functions
.\deploy-persistent-channels.ps1
```

Expected output:
```
========================================
Deploying Persistent Channels Lambdas
========================================

Deploying shelcaster-create-persistent-channel...
✓ shelcaster-create-persistent-channel deployed successfully

Deploying shelcaster-assign-channel...
✓ shelcaster-assign-channel deployed successfully

... (continues for all 8 functions)

========================================
Deployment Summary
========================================
Successful: 8
Failed: 0

All functions deployed successfully!
```

### Step 2: Create API Gateway Routes

Run the route creation script:

```powershell
.\add-persistent-channels-routes.ps1
```

Expected output:
```
========================================
Adding Persistent Channels API Routes
========================================

Creating route: POST /admin/channels
  Function: shelcaster-create-persistent-channel
  ✓ Route created successfully

... (continues for all 8 routes)

========================================
Route Creation Summary
========================================
Successful: 8
Failed: 0

All routes created successfully!

API Base URL: https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com
```

### Step 3: Run Automated Tests

Run the test script:

```powershell
.\test-persistent-channels.ps1
```

This script will:
1. Get current channel capacity
2. Create a new persistent channel
3. List all channels
4. Filter channels by state
5. Get channel statistics
6. Assign channel to a test host
7. Get host's assigned channel
8. Update channel state to LIVE
9. Update channel state back to IDLE
10. Unassign channel from host
11. Verify host has no channel (404 expected)

Expected output:
```
========================================
Testing Persistent Channels API
========================================

API Base URL: https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com
Test User ID: test-user-1234

Test 1: Get Channel Capacity
GET /admin/channels/capacity
✓ Success
  Current Channels: 0
  Max Limit: 20
  Remaining: 20
  Utilization: 0.00%

Test 2: Create Persistent Channel
POST /admin/channels
✓ Success
  Channel ID: abc123...
  Channel ARN: arn:aws:ivs:...
  Playback URL: https://...
  State: IDLE

... (continues for all tests)

========================================
Testing Complete
========================================
```

### Step 4: Manual Testing with cURL (Optional)

If you prefer manual testing, here are example cURL commands:

#### Create a Channel
```bash
curl -X POST https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com/admin/channels \
  -H "Content-Type: application/json" \
  -d '{"name":"My Test Channel","recordingEnabled":true}'
```

#### List Channels
```bash
curl https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com/admin/channels
```

#### Assign Channel to Host
```bash
curl -X POST https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com/admin/channels/{channelId}/assign \
  -H "Content-Type: application/json" \
  -d '{"hostUserId":"user-123"}'
```

#### Get Host's Channel
```bash
curl https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com/hosts/user-123/channel
```

### Step 5: Verify in AWS Console

#### Check DynamoDB Records

1. Go to AWS DynamoDB Console
2. Select `shelcaster-app` table
3. Click "Explore table items"
4. Look for items with:
   - `pk` starting with `channel#` (channel records)
   - `pk` starting with `host#` and `sk` = `channel#assignment` (assignment records)

#### Check IVS Channels

1. Go to AWS IVS Console
2. Click "Channels"
3. Look for channels with names starting with `persistent-`
4. Verify the channel has:
   - Recording configuration attached
   - Playback URL
   - Ingest endpoint

#### Check CloudWatch Logs

1. Go to AWS CloudWatch Console
2. Click "Log groups"
3. Find log groups for each Lambda function:
   - `/aws/lambda/shelcaster-create-persistent-channel`
   - `/aws/lambda/shelcaster-assign-channel`
   - etc.
4. Check for any errors or warnings

## Troubleshooting

### Error: "Function not found"
- Ensure Lambda functions are created in AWS
- Run deployment script again
- Check function names match exactly

### Error: "Access Denied" or "Unauthorized"
- Check Lambda execution role has permissions for:
  - DynamoDB: GetItem, PutItem, UpdateItem, DeleteItem, Query
  - IVS: CreateChannel, DeleteChannel
- Check API Gateway has permission to invoke Lambda functions

### Error: "Table not found" or "Index not found"
- Verify `shelcaster-app` table exists
- Verify `entityType-index` GSI exists
- Check region is `us-east-1`

### Error: "Maximum channel limit reached"
- You've hit the 20 channel limit
- Delete unused channels from IVS Console
- Or request limit increase from AWS Support

### Test Script Fails
- Check API Gateway URL is correct in script
- Verify routes were created successfully
- Check CloudWatch logs for specific errors
- Try manual cURL commands to isolate issue

## Success Criteria

Phase 1 is successfully deployed and tested when:

- ✅ All 8 Lambda functions deploy without errors
- ✅ All 8 API routes are created
- ✅ Test script completes all 11 tests successfully
- ✅ Channel records appear in DynamoDB
- ✅ IVS channels are created with recording enabled
- ✅ Assignment records are created and deleted correctly
- ✅ Channel state transitions work (IDLE → LIVE → IDLE)
- ✅ No errors in CloudWatch logs

## Next Steps

Once Phase 1 testing is complete:

1. **Phase 2**: Modify session creation/cleanup to use persistent channels
2. **Phase 3**: Build Program Manager Group Editor UI
3. **Phase 4**: Build Vista Stream channel approval UI

## Cleanup

To remove test data:

### Delete Test Channels from IVS
```powershell
# List channels
aws ivs list-channels --region us-east-1

# Delete specific channel
aws ivs delete-channel --arn "arn:aws:ivs:..." --region us-east-1
```

### Delete Test Records from DynamoDB
```powershell
# Delete channel record
aws dynamodb delete-item `
  --table-name shelcaster-app `
  --key '{"pk":{"S":"channel#abc123"},"sk":{"S":"info"}}'

# Delete assignment record
aws dynamodb delete-item `
  --table-name shelcaster-app `
  --key '{"pk":{"S":"host#test-user-123"},"sk":{"S":"channel#assignment"}}'
```
