# Auto-Create MediaLive Channel Implementation

## Summary

MediaLive channels are now **automatically created** when the host clicks "Go Live" instead of requiring manual setup.

## What Changed

### Backend (`shelcaster-start-streaming/index.js`)

**Before:**
- Checked if MediaLive channel exists
- Started it if found
- Did nothing if not found

**After:**
- Checks if MediaLive channel exists
- If not found:
  - Creates RTMP input for host camera
  - Creates MediaLive channel with IVS and S3 outputs
  - Saves channel info to DynamoDB
- Starts the channel (new or existing)

### Key Code Changes

```javascript
// Auto-create MediaLive channel if it doesn't exist
if (!channelId) {
  console.log('MediaLive channel not found, creating...');
  
  // Create RTMP input
  const hostInput = await mediaLiveClient.send(new CreateInputCommand({
    Name: `shelcaster-host-${sessionId}`,
    Type: 'RTMP_PUSH',
    InputSecurityGroups: [INPUT_SECURITY_GROUP_ID],
    Destinations: [
      { StreamName: 'stream1' },
      { StreamName: 'stream2' }
    ]
  }));
  
  // Create MediaLive channel
  const channelResponse = await mediaLiveClient.send(new CreateChannelCommand({
    Name: `shelcaster-${sessionId}`,
    RoleArn: MEDIALIVE_ROLE_ARN,
    // ... full channel configuration
  }));
  
  channelId = channelResponse.Channel.Id;
  
  // Save to DynamoDB
  await dynamoDBClient.send(new UpdateItemCommand({
    // ... save mediaLive info to session
  }));
}

// Start the channel
await mediaLiveClient.send(new StartMLChannelCommand({
  ChannelId: channelId
}));
```

## Environment Variables Required

The Lambda function needs these environment variables:

```env
MEDIALIVE_ROLE_ARN=arn:aws:iam::124355640062:role/MediaLiveAccessRole
MEDIALIVE_INPUT_SECURITY_GROUP_ID=7480724
```

## Deployment

```powershell
cd e:\projects\shelcaster-functions
.\deploy-start-streaming.ps1
```

This script:
1. Loads environment variables from `.env.medialive`
2. Packages the Lambda function
3. Updates function code
4. Updates function configuration with environment variables

## User Flow

1. **Host joins stage** → Creates LiveSession with IVS channels
2. **Host clicks "Go Live"** → Triggers `startStreaming()` API
3. **Backend checks** → Is there a MediaLive channel?
4. **If NO** → Creates channel automatically
5. **If YES** → Uses existing channel
6. **Starts channel** → Begins streaming to IVS
7. **Updates state** → `streaming.isLive = true`

## Benefits

✅ **Zero manual setup** - No need to pre-create MediaLive channels
✅ **Cost efficient** - Channels created only when needed
✅ **Automatic cleanup** - Can delete channels when session ends
✅ **Simpler workflow** - One-click "Go Live" experience
✅ **Error resilient** - Handles existing channels gracefully

## MediaLive Channel Configuration

**Input:**
- RTMP Push input (2 redundant endpoints)
- Accepts host camera stream

**Outputs:**
1. **IVS Output** (RTMP)
   - Destination: IVS Program channel ingest endpoint
   - Purpose: Live streaming to viewers
   
2. **S3 Output** (HLS)
   - Destination: `s3://shelcaster-media-manager/sessions/{sessionId}/recording/`
   - Purpose: Recording for post-show export

**Encoding:**
- Video: H.264, 1920x1080, 4.5 Mbps, 30fps
- Audio: AAC, 128 kbps, 48 kHz

## Cost Implications

**MediaLive Pricing:**
- $2.55/hour when channel is RUNNING
- $0.00/hour when channel is IDLE or STOPPED

**With Auto-Create:**
- Channel created only when "Go Live" is clicked
- Channel can be deleted when session ends
- Reduces idle channel costs

**Recommendation:**
- Stop channel when "Stop Streaming" is clicked
- Delete channel when session ends (future enhancement)

## Testing

### 1. Verify Environment Variables

```powershell
aws lambda get-function-configuration --function-name shelcaster-start-streaming --profile shelcaster-admin --region us-east-1 --query "Environment.Variables"
```

Should show:
```json
{
  "MEDIALIVE_ROLE_ARN": "arn:aws:iam::124355640062:role/MediaLiveAccessRole",
  "MEDIALIVE_INPUT_SECURITY_GROUP_ID": "7480724"
}
```

### 2. Test Auto-Create Flow

1. Join stage (creates session without MediaLive channel)
2. Click "Go Live"
3. Check CloudWatch logs for "MediaLive channel not found, creating..."
4. Verify channel created in AWS Console → MediaLive
5. Verify channel info saved to DynamoDB session

### 3. Test Existing Channel Flow

1. Join stage (session already has MediaLive channel)
2. Click "Go Live"
3. Check CloudWatch logs for "MediaLive channel started: {channelId}"
4. Verify no duplicate channels created

## Troubleshooting

### Error: "Missing MEDIALIVE_ROLE_ARN"
- Environment variable not set on Lambda function
- Run `.\deploy-start-streaming.ps1` to update configuration

### Error: "Missing IVS ingest endpoint"
- Session doesn't have `ivs.programIngestEndpoint`
- Verify `shelcaster-create-session` creates IVS channels correctly

### Error: "AccessDeniedException"
- MediaLive role doesn't have required permissions
- Verify role has `medialive:CreateChannel`, `medialive:CreateInput`

### Channel created but not starting
- Check Input Security Group allows your IP
- Verify MediaLive role has `ivs:PutStream` permission
- Check IVS channel is in ACTIVE state

## Next Steps

1. ✅ Auto-create MediaLive channel on "Go Live"
2. ⏳ Add source switching (host/callers/tracklist)
3. ⏳ Add audio level controls
4. ⏳ Auto-delete channel when session ends
5. ⏳ Add multi-platform streaming (Facebook, YouTube)

## Files Modified

- `shelcaster-functions/shelcaster-start-streaming/index.js` - Added auto-create logic
- `shelcaster-functions/deploy-start-streaming.ps1` - New deployment script
- `shelcaster-functions/MEDIALIVE-SETUP.md` - Updated documentation

## Files Unchanged

- Frontend (`shelcaster-studio-2026`) - No changes needed
- `ControlPanel.jsx` - Already has "Go Live" button
- `mediaLiveService.js` - Already calls correct API endpoint
