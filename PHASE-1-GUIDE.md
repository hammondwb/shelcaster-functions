# Phase 1 Implementation Guide

## Overview
Create individual IVS compositions for each participant that output HLS streams to S3.

---

## Step 1: Setup IVS Storage Configuration

```powershell
cd e:\projects\shelcaster-functions
.\setup-ivs-storage.ps1
```

Creates S3 bucket `shelcaster-compositions` and IVS storage configuration.

---

## Step 2: Deploy Lambda Function

```powershell
.\deploy-phase1.ps1
```

Deploys `shelcaster-create-participant-compositions` Lambda.

---

## Step 3: Add API Gateway Route

```powershell
.\add-compositions-route.ps1
```

Adds route: `POST /sessions/{sessionId}/compositions`

---

## Step 4: Test

```powershell
$body = @{
  sessionId = "test-001"
  stageArn = "arn:aws:ivs:us-east-1:124355640062:stage/xxxxx"
  participants = @(
    @{ participantId = "host-123" },
    @{ participantId = "caller-456" }
  )
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/test-001/compositions" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

Expected response:
```json
{
  "compositions": [
    {
      "participantId": "host-123",
      "compositionArn": "arn:aws:ivs:...",
      "hlsUrl": "https://shelcaster-compositions.s3.amazonaws.com/test-001/host-123/playlist.m3u8"
    }
  ]
}
```

---

## Step 5: Verify HLS Streams

```powershell
aws s3 ls s3://shelcaster-compositions/test-001/ --recursive --profile shelcaster-admin
```

---

## Success Criteria

✅ Lambda deployed
✅ API route working
✅ Compositions created
✅ HLS streams in S3
✅ DynamoDB updated

Ready for Phase 2: MediaLive integration
