# Quick Deployment Guide - MediaLive Auto-Create

## Prerequisites Check

```powershell
# 1. Check MediaLive role exists
aws iam get-role --role-name MediaLiveAccessRole --profile shelcaster-admin --region us-east-1

# 2. Check Input Security Group exists
aws medialive describe-input-security-group --input-security-group-id 7480724 --profile shelcaster-admin --region us-east-1

# 3. Verify .env.medialive file exists
cat .env.medialive
```

## Deploy

```powershell
cd e:\projects\shelcaster-functions
.\deploy-start-streaming.ps1
```

## Verify

```powershell
.\verify-medialive-deployment.ps1
```

## Test

1. Open Shelcaster Studio: http://localhost:5173
2. Log in
3. Select or create a show
4. Click "Join Stage"
5. Click "Go Live"
6. Check CloudWatch logs

## Monitor

```powershell
# View Lambda logs
aws logs tail /aws/lambda/shelcaster-start-streaming --follow --profile shelcaster-admin --region us-east-1

# List MediaLive channels
aws medialive list-channels --profile shelcaster-admin --region us-east-1 --query "Channels[?State=='RUNNING']"

# Check session in DynamoDB
aws dynamodb get-item --table-name shelcaster-app --key '{"pk":{"S":"session#YOUR_SESSION_ID"},"sk":{"S":"info"}}' --profile shelcaster-admin --region us-east-1
```

## Troubleshoot

### Environment variables not set
```powershell
aws lambda update-function-configuration --function-name shelcaster-start-streaming --environment "Variables={MEDIALIVE_ROLE_ARN=arn:aws:iam::124355640062:role/MediaLiveAccessRole,MEDIALIVE_INPUT_SECURITY_GROUP_ID=7480724}" --profile shelcaster-admin --region us-east-1
```

### View CloudWatch logs
```powershell
aws logs tail /aws/lambda/shelcaster-start-streaming --since 10m --profile shelcaster-admin --region us-east-1
```

### Delete test channel
```powershell
# Stop channel first
aws medialive stop-channel --channel-id YOUR_CHANNEL_ID --profile shelcaster-admin --region us-east-1

# Wait for IDLE state, then delete
aws medialive delete-channel --channel-id YOUR_CHANNEL_ID --profile shelcaster-admin --region us-east-1
```

## Expected Behavior

### First "Go Live" (No MediaLive channel exists)
```
CloudWatch Logs:
→ "Session: {...}"
→ "MediaLive channel not found, creating..."
→ "MediaLive channel created: 1234567"
→ "MediaLive channel started: 1234567"
→ "IVS channel started: arn:aws:ivs:..."
```

### Subsequent "Go Live" (Channel exists)
```
CloudWatch Logs:
→ "Session: {...}"
→ "MediaLive channel started: 1234567"
→ "IVS channel started: arn:aws:ivs:..."
```

## Cost Monitoring

```powershell
# List running channels (costing $2.55/hour each)
aws medialive list-channels --profile shelcaster-admin --region us-east-1 --query "Channels[?State=='RUNNING'].{Name:Name,Id:Id,State:State}"

# Stop all running channels
aws medialive list-channels --profile shelcaster-admin --region us-east-1 --query "Channels[?State=='RUNNING'].Id" --output text | ForEach-Object { aws medialive stop-channel --channel-id $_ --profile shelcaster-admin --region us-east-1 }
```

## Success Indicators

✅ Deployment script completes without errors
✅ Verification script shows all green checks
✅ "Go Live" button creates MediaLive channel
✅ Channel appears in AWS Console → MediaLive
✅ Channel info saved to DynamoDB session
✅ Stream appears in IVS playback URL
✅ No duplicate channels created on subsequent "Go Live"

## Support

- Implementation Guide: `AUTO-CREATE-MEDIALIVE.md`
- Setup Guide: `MEDIALIVE-SETUP.md`
- Complete Summary: `IMPLEMENTATION-COMPLETE.md`
