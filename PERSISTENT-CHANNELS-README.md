# Persistent IVS Channels - Phase 1 Implementation

## Overview

This implementation provides persistent IVS channels with static playback URLs for the Shelcaster platform. Unlike the current approach where channels are created and deleted for each broadcast, persistent channels remain active across multiple sessions, providing consistent streaming URLs for viewers.

## What's Included

### Lambda Functions (8 total)
1. **shelcaster-create-persistent-channel** - Creates new IVS channels
2. **shelcaster-assign-channel** - Assigns channels to hosts
3. **shelcaster-unassign-channel** - Removes channel assignments
4. **shelcaster-get-host-channel** - Gets a host's assigned channel
5. **shelcaster-list-channels** - Lists all channels with filtering
6. **shelcaster-get-channel-stats** - Returns channel usage statistics
7. **shelcaster-get-channel-capacity** - Returns capacity information
8. **shelcaster-update-channel-state** - Updates channel state (IDLE/LIVE/OFFLINE)

### Scripts
- **check-persistent-channels-setup.ps1** - Verifies prerequisites
- **deploy-persistent-channels.ps1** - Deploys all Lambda functions
- **add-persistent-channels-routes.ps1** - Creates API Gateway routes
- **test-persistent-channels.ps1** - Runs automated tests

### Documentation
- **TESTING-GUIDE-PERSISTENT-CHANNELS.md** - Step-by-step testing guide
- **PERSISTENT-CHANNELS-API-REFERENCE.md** - Complete API documentation
- **PERSISTENT-CHANNELS-PHASE1-COMPLETE.md** - Implementation summary

## Quick Start

### 1. Check Prerequisites
```powershell
cd e:\projects\shelcaster-functions
.\check-persistent-channels-setup.ps1
```

This verifies:
- AWS CLI is installed and configured
- DynamoDB table exists
- entityType GSI exists
- Lambda functions exist (or need to be created)
- API Gateway exists

### 2. Create Lambda Functions (First Time Only)

If Lambda functions don't exist, create them in AWS Console:

**For each function:**
1. Go to AWS Lambda Console
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: (see list above)
5. Runtime: Node.js 18.x
6. Architecture: x86_64
7. Execution role: Use existing role with permissions for:
   - DynamoDB (GetItem, PutItem, UpdateItem, DeleteItem, Query)
   - IVS (CreateChannel, DeleteChannel)
   - CloudWatch Logs

### 3. Deploy Lambda Code
```powershell
.\deploy-persistent-channels.ps1
```

This zips and uploads code to all 8 Lambda functions.

### 4. Create API Routes
```powershell
.\add-persistent-channels-routes.ps1
```

This creates 8 API Gateway routes and grants invoke permissions.

### 5. Run Tests
```powershell
.\test-persistent-channels.ps1
```

This runs 11 automated tests covering all functionality.

## Architecture

### Data Model

**Channel Record** (DynamoDB)
```
pk: channel#{channelId}
sk: info
entityType: persistentChannel
channelId: UUID
channelArn: AWS IVS ARN
channelName: Human-readable name
playbackUrl: Static HLS URL
ingestEndpoint: RTMP endpoint
streamKey: Stream authentication key
state: IDLE | LIVE | OFFLINE
recordingConfigurationArn: AWS recording config
currentSessionId: Active session (if LIVE)
totalBroadcasts: Count
totalStreamingMinutes: Total time
lastBroadcastAt: Last broadcast timestamp
createdAt: Creation timestamp
updatedAt: Last update timestamp
```

**Assignment Record** (DynamoDB)
```
pk: host#{userId}
sk: channel#assignment
entityType: channelAssignment
hostUserId: Cognito user ID
channelId: Assigned channel ID
channelArn: Denormalized
playbackUrl: Denormalized
ingestEndpoint: Denormalized
streamKey: Denormalized
assignedAt: Assignment timestamp
assignedBy: Admin user ID
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /admin/channels | POST | Create channel |
| /admin/channels | GET | List channels |
| /admin/channels/{id}/assign | POST | Assign to host |
| /admin/channels/{id}/assign/{userId} | DELETE | Unassign |
| /admin/channels/{id}/stats | GET | Get statistics |
| /admin/channels/{id}/state | PUT | Update state |
| /admin/channels/capacity | GET | Get capacity |
| /hosts/{userId}/channel | GET | Get host channel |

## Key Features

### 1. Static Playback URLs
Each channel has a permanent playback URL that works across all broadcasts. Viewers can bookmark the URL and it will automatically show live content when the host is broadcasting.

### 2. Channel State Management
Channels transition between states:
- **IDLE**: Not broadcasting, no charges
- **LIVE**: Actively broadcasting, charges apply
- **OFFLINE**: Disabled/unavailable

### 3. Flexible Assignment Models
Supports both:
- **1:1 (Host-Owned)**: Each host has their own channel
- **N:1 (Admin-Assigned)**: Multiple hosts can share a channel (with scheduling)

### 4. Recording Enabled
All channels are created with recording configuration attached, automatically saving broadcasts to S3.

### 5. Usage Statistics
Track total broadcasts, streaming hours, and last broadcast time per channel.

### 6. Capacity Management
Monitor channel usage against AWS limits (default: 20 channels).

## Testing

### Automated Tests
The test script (`test-persistent-channels.ps1`) performs:
1. Get channel capacity
2. Create a new channel
3. List all channels
4. Filter channels by state
5. Get channel statistics
6. Assign channel to host
7. Get host's assigned channel
8. Update state to LIVE
9. Update state back to IDLE
10. Unassign channel
11. Verify unassignment (404 expected)

### Manual Testing
Use the API reference document for cURL or Postman examples.

### Verification
Check AWS Console:
- **DynamoDB**: Look for `channel#` and `host#` records
- **IVS**: Look for channels with `persistent-` prefix
- **CloudWatch**: Check Lambda logs for errors

## Cost Considerations

### IVS Charges
- **Idle channels**: No hourly charges
- **Active streaming**: Charged per minute of streaming
- **Data transfer**: Charged per GB delivered to viewers
- **Recording**: S3 storage charges apply

### Channel Limits
- Default: 20 channels per AWS account
- Can be increased via AWS Support ticket
- No cost to have idle channels

## Security Notes

### Stream Keys
- Currently stored in plain text in DynamoDB
- **Production**: Should be encrypted using AWS KMS
- Never expose stream keys in API responses to non-admin users

### Authentication
- Phase 1: No authentication enforced
- **Production**: Use API Gateway JWT authorizer with Cognito
- Admin endpoints should require admin role
- Host endpoints should verify user identity

## Troubleshooting

### Common Issues

**"Function not found"**
- Create Lambda functions in AWS Console first
- Ensure function names match exactly

**"Index not found"**
- Create entityType GSI on shelcaster-app table
- Wait for GSI to become ACTIVE

**"Maximum channel limit reached"**
- Delete unused channels from IVS Console
- Or request limit increase from AWS Support

**"Access Denied"**
- Check Lambda execution role permissions
- Verify API Gateway has invoke permissions

### Debug Steps
1. Check CloudWatch logs for specific Lambda function
2. Verify DynamoDB records were created
3. Check IVS Console for channel creation
4. Test with cURL to isolate frontend vs backend issues

## Next Phases

### Phase 2: Session Integration
- Modify `shelcaster-create-session` to use persistent channels
- Modify `shelcaster-end-session` to preserve channels
- Update channel state during broadcasts
- Track usage statistics

### Phase 3: Program Manager UI
- Create Group Edit Form
- Add group image upload
- Implement "Create Channel from Group"
- Submit channel requests

### Phase 4: Vista Stream UI
- Create Channel Management page
- Display pending channel requests
- Implement approve/reject workflow
- Show active channels with state

## Support

For issues or questions:
1. Check CloudWatch logs for error details
2. Review the testing guide for common solutions
3. Verify all prerequisites are met
4. Check AWS service quotas and limits

## Files Reference

```
shelcaster-functions/
├── shelcaster-create-persistent-channel/
│   └── index.mjs
├── shelcaster-assign-channel/
│   └── index.mjs
├── shelcaster-unassign-channel/
│   └── index.mjs
├── shelcaster-get-host-channel/
│   └── index.mjs
├── shelcaster-list-channels/
│   └── index.mjs
├── shelcaster-get-channel-stats/
│   └── index.mjs
├── shelcaster-get-channel-capacity/
│   └── index.mjs
├── shelcaster-update-channel-state/
│   └── index.mjs
├── check-persistent-channels-setup.ps1
├── deploy-persistent-channels.ps1
├── add-persistent-channels-routes.ps1
├── test-persistent-channels.ps1
├── PERSISTENT-CHANNELS-README.md (this file)
├── TESTING-GUIDE-PERSISTENT-CHANNELS.md
├── PERSISTENT-CHANNELS-API-REFERENCE.md
└── PERSISTENT-CHANNELS-PHASE1-COMPLETE.md
```
