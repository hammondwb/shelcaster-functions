# Deployment Checklist - MediaLive Auto-Create

## Pre-Deployment

### 1. Prerequisites Verification
- [ ] MediaLive IAM role exists (`MediaLiveAccessRole`)
- [ ] Role has S3 permissions (shelcaster-media-manager bucket)
- [ ] Role has IVS permissions (ivs:PutStream)
- [ ] Input Security Group exists (ID: 7480724)
- [ ] Security Group allows RTMP (0.0.0.0/0)
- [ ] `.env.medialive` file exists with correct values
- [ ] AWS CLI configured with shelcaster-admin profile

### 2. Environment Variables Check
```powershell
cat .env.medialive
```
Should contain:
```
MEDIALIVE_ROLE_ARN=arn:aws:iam::124355640062:role/MediaLiveAccessRole
MEDIALIVE_INPUT_SECURITY_GROUP_ID=7480724
AWS_ACCOUNT_ID=124355640062
```

### 3. Backup Current Lambda
```powershell
aws lambda get-function --function-name shelcaster-start-streaming --profile shelcaster-admin --region us-east-1 > backup-start-streaming.json
```

## Deployment

### 4. Deploy Lambda Function
```powershell
cd e:\projects\shelcaster-functions
.\deploy-start-streaming.ps1
```
- [ ] Script completes without errors
- [ ] Shows "Updating function code..."
- [ ] Shows "Updating environment variables..."
- [ ] Shows "[OK] shelcaster-start-streaming deployed successfully!"

### 5. Verify Deployment
```powershell
.\verify-medialive-deployment.ps1
```
- [ ] Function exists ✅
- [ ] MEDIALIVE_ROLE_ARN set ✅
- [ ] MEDIALIVE_INPUT_SECURITY_GROUP_ID set ✅
- [ ] Runtime: nodejs22.x
- [ ] Handler: index.handler
- [ ] Timeout: 30s
- [ ] Memory: 256MB
- [ ] MediaLive role exists ✅
- [ ] Security Group exists ✅

## Testing

### 6. Frontend Testing
- [ ] Open Shelcaster Studio (http://localhost:5173)
- [ ] Log in with test account
- [ ] Select or create a test show
- [ ] Click "Join Stage"
- [ ] Wait for stage connection (Status: CONNECTED)
- [ ] Click "Go Live" button

### 7. Monitor CloudWatch Logs
```powershell
aws logs tail /aws/lambda/shelcaster-start-streaming --follow --profile shelcaster-admin --region us-east-1
```
Expected logs:
- [ ] "Event: {...}"
- [ ] "Session: {...}"
- [ ] "MediaLive channel not found, creating..." (first time)
- [ ] "MediaLive channel created: {channelId}"
- [ ] "MediaLive channel started: {channelId}"
- [ ] "IVS channel started: {arn}"

### 8. Verify MediaLive Channel
```powershell
aws medialive list-channels --profile shelcaster-admin --region us-east-1 --query "Channels[?State=='RUNNING']"
```
- [ ] New channel appears in list
- [ ] Channel name: `shelcaster-{sessionId}`
- [ ] State: RUNNING
- [ ] Has 2 outputs (IVS + S3)

### 9. Verify DynamoDB Session
```powershell
# Replace SESSION_ID with actual session ID
aws dynamodb get-item --table-name shelcaster-app --key '{"pk":{"S":"session#SESSION_ID"},"sk":{"S":"info"}}' --profile shelcaster-admin --region us-east-1
```
- [ ] Session has `mediaLive` object
- [ ] `mediaLive.channelId` exists
- [ ] `mediaLive.channelArn` exists
- [ ] `mediaLive.inputIds.host` exists
- [ ] `mediaLive.rtmpEndpoints.host` has 2 endpoints
- [ ] `streaming.isLive` = true
- [ ] `streaming.startedAt` has timestamp

### 10. Verify IVS Playback
- [ ] Copy playback URL from frontend
- [ ] Open in VLC or browser
- [ ] Stream is visible (may take 30-60 seconds)
- [ ] Video quality is HD (1920x1080)
- [ ] Audio is clear

### 11. Verify S3 Recording
```powershell
# Replace SESSION_ID with actual session ID
aws s3 ls s3://shelcaster-media-manager/sessions/SESSION_ID/recording/ --profile shelcaster-admin --region us-east-1
```
- [ ] Recording folder exists
- [ ] HLS segments (.ts files) are being created
- [ ] Playlist file (index.m3u8) exists

### 12. Test Existing Channel Flow
- [ ] Click "Stop Streaming"
- [ ] Wait for channel to stop
- [ ] Click "Go Live" again
- [ ] Check logs for "MediaLive channel started: {channelId}" (no "creating")
- [ ] Verify no duplicate channels created

## Post-Deployment

### 13. Cleanup Test Resources
```powershell
# Stop test channel
aws medialive stop-channel --channel-id CHANNEL_ID --profile shelcaster-admin --region us-east-1

# Wait for IDLE state (check every 30 seconds)
aws medialive describe-channel --channel-id CHANNEL_ID --profile shelcaster-admin --region us-east-1 --query "State"

# Delete test channel (once IDLE)
aws medialive delete-channel --channel-id CHANNEL_ID --profile shelcaster-admin --region us-east-1

# Delete test input
aws medialive delete-input --input-id INPUT_ID --profile shelcaster-admin --region us-east-1
```

### 14. Documentation
- [ ] Update team wiki with deployment date
- [ ] Share QUICK-DEPLOY.md with team
- [ ] Add CloudWatch dashboard for monitoring
- [ ] Set up cost alerts for MediaLive

### 15. Monitoring Setup
```powershell
# Create CloudWatch alarm for MediaLive costs
aws cloudwatch put-metric-alarm --alarm-name medialive-cost-alert --alarm-description "Alert when MediaLive costs exceed $100/day" --metric-name EstimatedCharges --namespace AWS/Billing --statistic Maximum --period 86400 --threshold 100 --comparison-operator GreaterThanThreshold --profile shelcaster-admin --region us-east-1
```

## Rollback Plan

### If Deployment Fails

1. **Restore Previous Lambda Version**
```powershell
# List versions
aws lambda list-versions-by-function --function-name shelcaster-start-streaming --profile shelcaster-admin --region us-east-1

# Rollback to previous version
aws lambda update-alias --function-name shelcaster-start-streaming --name PROD --function-version PREVIOUS_VERSION --profile shelcaster-admin --region us-east-1
```

2. **Remove Environment Variables**
```powershell
aws lambda update-function-configuration --function-name shelcaster-start-streaming --environment "Variables={}" --profile shelcaster-admin --region us-east-1
```

3. **Restore from Backup**
```powershell
# Use backup-start-streaming.json to restore
```

## Success Criteria

All items must be checked:
- [ ] Lambda deployed successfully
- [ ] Environment variables set correctly
- [ ] "Go Live" creates MediaLive channel (first time)
- [ ] Channel info saved to DynamoDB
- [ ] Stream appears in IVS playback URL
- [ ] Recording saves to S3
- [ ] "Go Live" uses existing channel (second time)
- [ ] No duplicate channels created
- [ ] No errors in CloudWatch logs
- [ ] Cost monitoring in place

## Sign-Off

- [ ] Deployment completed by: _______________
- [ ] Date: _______________
- [ ] Verified by: _______________
- [ ] Date: _______________

## Notes

Use this space to document any issues or observations during deployment:

```
_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________
```

## Support Contacts

- AWS Support: https://console.aws.amazon.com/support/
- MediaLive Documentation: https://docs.aws.amazon.com/medialive/
- IVS Documentation: https://docs.aws.amazon.com/ivs/

## Related Documents

- Quick Deploy: `QUICK-DEPLOY.md`
- Implementation Guide: `AUTO-CREATE-MEDIALIVE.md`
- Flow Diagram: `FLOW-DIAGRAM.md`
- Complete Summary: `IMPLEMENTATION-COMPLETE.md`
- Feature Complete: `FEATURE-COMPLETE.md`
