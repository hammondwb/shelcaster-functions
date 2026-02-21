# Bash Testing Guide - Persistent IVS Channels

Quick guide for testing with bash scripts (Linux/Mac/Git Bash on Windows).

## Files Created

All bash scripts are in `shelcaster-functions/`:

- `check-persistent-channels-setup.sh` - Check prerequisites
- `deploy-persistent-channels.sh` - Deploy Lambda functions
- `add-persistent-channels-routes.sh` - Create API routes
- `test-persistent-channels.sh` - Run automated tests

## Quick Start

### 1. Navigate to the directory
```bash
cd /e/projects/shelcaster-functions
```

### 2. Check prerequisites
```bash
./check-persistent-channels-setup.sh
```

This checks:
- AWS CLI installed
- AWS credentials configured
- DynamoDB table exists
- entityType GSI exists
- Lambda functions exist
- API Gateway exists

### 3. Deploy Lambda functions
```bash
./deploy-persistent-channels.sh
```

This deploys all 8 Lambda functions.

### 4. Create API routes
```bash
./add-persistent-channels-routes.sh
```

This creates 8 API Gateway routes.

### 5. Run tests
```bash
./test-persistent-channels.sh
```

This runs 11 automated tests.

## Expected Output

### Check Setup
```
========================================
Checking Persistent Channels Setup
========================================

1. Checking AWS CLI...
   ✓ AWS CLI installed: aws-cli/2.x.x

2. Checking AWS credentials...
   ✓ AWS credentials configured
     Account: 124355640062
     User: arn:aws:iam::...

... (continues)
```

### Deploy Functions
```
========================================
Deploying Persistent Channels Lambdas
========================================

Deploying shelcaster-create-persistent-channel...
✓ shelcaster-create-persistent-channel deployed successfully

... (continues for all 8 functions)

========================================
Deployment Summary
========================================
Successful: 8
Failed: 0
```

### Run Tests
```
========================================
Testing Persistent Channels API
========================================

Test 1: Get Channel Capacity
GET /admin/channels/capacity
✓ Success
  Current Channels: 0
  Max Limit: 20

Test 2: Create Persistent Channel
POST /admin/channels
✓ Success
  Channel ID: abc-123-def-456
  Playback URL: https://...

... (continues for all 11 tests)
```

## Troubleshooting

### "Permission denied" error
Make scripts executable:
```bash
chmod +x *.sh
```

### "aws: command not found"
Install AWS CLI:
```bash
# On Mac with Homebrew
brew install awscli

# On Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# On Windows with Git Bash
# Download and install from: https://aws.amazon.com/cli/
```

### "zip: command not found"
Install zip:
```bash
# On Mac
brew install zip

# On Linux (Ubuntu/Debian)
sudo apt-get install zip

# On Windows with Git Bash
# zip should be included, if not install from: http://gnuwin32.sourceforge.net/packages/zip.htm
```

### AWS credentials not configured
```bash
aws configure
# Enter your:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1
# - Default output format: json
```

### Lambda functions don't exist
Create them in AWS Lambda Console first:
1. Go to https://console.aws.amazon.com/lambda
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: (see list in check script output)
5. Runtime: Node.js 18.x
6. Create function
7. Repeat for all 8 functions

Then run `./deploy-persistent-channels.sh`

### GSI doesn't exist
Create the entityType GSI:
```bash
aws dynamodb update-table \
  --table-name shelcaster-app \
  --attribute-definitions AttributeName=entityType,AttributeType=S \
  --global-secondary-index-updates '[{
    "Create": {
      "IndexName": "entityType-index",
      "KeySchema": [{"AttributeName": "entityType", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
    }
  }]'
```

Wait a few minutes for the GSI to become ACTIVE.

## Manual Testing with cURL

If you prefer manual testing:

```bash
# Set API URL
API_URL="https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com"

# Create a channel
curl -X POST "$API_URL/admin/channels" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Test Channel","recordingEnabled":true}'

# List channels
curl "$API_URL/admin/channels"

# Get capacity
curl "$API_URL/admin/channels/capacity"

# Assign channel (replace {channelId} with actual ID)
curl -X POST "$API_URL/admin/channels/{channelId}/assign" \
  -H "Content-Type: application/json" \
  -d '{"hostUserId":"user-123"}'

# Get host's channel
curl "$API_URL/hosts/user-123/channel"
```

## Cleanup

To remove test channels:

```bash
# List channels
aws ivs list-channels --region us-east-1

# Delete a channel (replace ARN)
aws ivs delete-channel --arn "arn:aws:ivs:..." --region us-east-1
```

## Next Steps

Once testing is complete:
1. Phase 2: Modify session creation/cleanup
2. Phase 3: Build Program Manager UI
3. Phase 4: Build Vista Stream UI

## Support

For issues:
1. Check CloudWatch logs: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups
2. Review error messages in script output
3. Verify AWS permissions
4. Check the main TESTING-GUIDE-PERSISTENT-CHANNELS.md for more details
