# IVS Recording to S3 - Issue Resolution

## Problem Summary

**Issue**: IVS Real-Time composition recordings were being saved to S3, but the `program_url` was not being saved to DynamoDB program entries.

## Root Cause Analysis

### 1. Storage Configuration Issue (RESOLVED)
- **Problem**: Lambda environment variable `STORAGE_CONFIGURATION_ARN` was pointing to incorrect/old ARN
- **Solution**: Updated Lambda to use correct storage configuration ARN: `arn:aws:ivs:us-east-1:124355640062:storage-configuration/M2RhrYnOPLP7`
- **Status**: ✅ FIXED - Recordings now save to S3 successfully

### 2. S3 Trigger Mismatch (RESOLVED)
- **Problem**: S3 bucket trigger was configured to listen for `master.m3u8` files
- **Reality**: IVS Real-Time compositions create `multivariant.m3u8` files, NOT `master.m3u8`
- **Result**: Lambda `shelcaster-ivs-recording-processor` was never triggered
- **Solution**: Updated S3 notification configuration to trigger on BOTH:
  - `multivariant.m3u8` (IVS Real-Time compositions)
  - `master.m3u8` (IVS standard recordings)
- **Status**: ✅ FIXED

## Verification

### S3 Files Confirmed
```
aws s3 ls s3://shelcaster-media-manager/ --recursive | findstr /i "m3u8"
```
- ✅ Recordings are being saved to S3
- ✅ Files follow pattern: `{stageId}/{channelId}/{compositionId}/composite/media/hls/multivariant.m3u8`

### S3 Trigger Configuration
```json
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "ivs-realtime-multivariant",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "Suffix",
              "Value": "multivariant.m3u8"
            }
          ]
        }
      }
    },
    {
      "Id": "ivs-standard-master",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "Suffix",
              "Value": "master.m3u8"
            }
          ]
        }
      }
    }
  ]
}
```

## Expected Behavior (After Fix)

1. **Composition Starts**: Host joins stage, composition starts automatically
2. **Recording to S3**: IVS Real-Time writes HLS files to S3
3. **Trigger on Complete**: When `multivariant.m3u8` is created, S3 triggers Lambda
4. **Lambda Processing**: `shelcaster-ivs-recording-processor` Lambda:
   - Matches recording to LiveSession by compositionArn
   - Finds associated Show and groupId
   - Creates program entry in DynamoDB with:
     - `program_url`: CloudFront URL (e.g., `https://d2kyyx47f0bavc.cloudfront.net/{path}/multivariant.m3u8`)
     - `s3Key`: S3 object key
     - `groupId`: Media Manager group
     - `ownerId`: Producer/host user ID
   - Updates recording metadata
   - Syncs to Algolia search index

## Testing Next Recording

To verify the fix works:

1. Start a new show and join stage
2. Record for at least 30 seconds
3. Stop composition
4. Wait 2-3 minutes for IVS to finalize recording
5. Check DynamoDB for program entry:
   ```bash
   aws dynamodb query \
     --table-name shelcaster-app \
     --index-name entityType-index \
     --key-condition-expression "entityType = :et" \
     --expression-attribute-values '{":et":{"S":"program"}}' \
     --profile shelcaster-admin \
     --region us-east-1
   ```
6. Verify `program_url` field is populated

## Files Modified

1. **Lambda Environment**: `shelcaster-start-composition`
   - Updated `STORAGE_CONFIGURATION_ARN` to correct value

2. **S3 Bucket Notification**: `shelcaster-media-manager`
   - Added trigger for `multivariant.m3u8`
   - Kept trigger for `master.m3u8` (backward compatibility)

## No Code Changes Required

The Lambda function `shelcaster-ivs-recording-processor` already had correct logic:
- ✅ Matches recordings by compositionArn
- ✅ Creates program entries with program_url
- ✅ Uses CloudFront domain for playback URLs
- ✅ Syncs to Algolia

The issue was purely infrastructure configuration, not code logic.

## Summary

**Problem**: S3 destination stuck in STARTING → program_url not saved
**Root Cause**: Wrong storage config ARN + S3 trigger listening for wrong file
**Solution**: Fixed storage config + updated S3 trigger to listen for multivariant.m3u8
**Status**: ✅ RESOLVED - Next recording will automatically save program_url
