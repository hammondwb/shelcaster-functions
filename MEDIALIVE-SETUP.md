# MediaLive Implementation Setup Guide

## Prerequisites

Before deploying, you need to configure:

### 1. MediaLive IAM Role

Create a role that MediaLive can assume to access S3 and IVS:

```powershell
# Check if role exists
aws iam get-role --role-name MediaLiveAccessRole --profile shelcaster-admin --region us-east-1
```

If it doesn't exist, create it:

```json
// Trust policy (medialive-trust-policy.json)
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "medialive.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}

// Permissions policy (medialive-permissions.json)
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::shelcaster-media-manager",
        "arn:aws:s3:::shelcaster-media-manager/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ivs:PutStream"
      ],
      "Resource": "*"
    }
  ]
}
```

Create the role:

```powershell
aws iam create-role --role-name MediaLiveAccessRole --assume-role-policy-document file://medialive-trust-policy.json --profile shelcaster-admin --region us-east-1

aws iam put-role-policy --role-name MediaLiveAccessRole --policy-name MediaLivePermissions --policy-document file://medialive-permissions.json --profile shelcaster-admin --region us-east-1
```

### 2. Input Security Group

Create an input security group to allow RTMP push:

```powershell
aws medialive create-input-security-group --whitelist-rules Cidr=0.0.0.0/0 --profile shelcaster-admin --region us-east-1
```

Note the `Id` from the response and update it in `shelcaster-create-medialive-channel/index.mjs` line 18.

### 3. Update Lambda Code

Edit `shelcaster-create-medialive-channel/index.mjs`:

- Line 18: Replace `"7480724"` with your Input Security Group ID
- Line 52: Replace role ARN with your MediaLiveAccessRole ARN

## Deployment Steps

### Step 1: Configure Environment Variables

Ensure `.env.medialive` file exists with:

```env
MEDIALIVE_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT:role/MediaLiveAccessRole
MEDIALIVE_INPUT_SECURITY_GROUP_ID=YOUR_SECURITY_GROUP_ID
AWS_ACCOUNT_ID=YOUR_ACCOUNT_ID
```

### Step 2: Deploy Start Streaming Lambda

```powershell
cd e:\projects\shelcaster-functions
.\deploy-start-streaming.ps1
```

This will:
- Package the updated Lambda function
- Deploy with MediaLive environment variables
- Enable auto-create functionality

## Integration with Existing Flow

### Auto-Create MediaLive Channel on "Go Live"

The MediaLive channel is now **automatically created** when the host clicks "Go Live" (Start Streaming).

**Flow:**
1. Host joins stage → Creates LiveSession with IVS channels
2. Host clicks "Go Live" → `startStreaming()` API call
3. Backend checks if MediaLive channel exists
4. If not exists:
   - Creates RTMP input for host camera
   - Creates MediaLive channel with:
     - Input: Host RTMP stream
     - Output 1: IVS Program channel (for live streaming)
     - Output 2: S3 bucket (for recording)
   - Saves channel info to DynamoDB session
5. Starts MediaLive channel
6. Starts IVS channel
7. Updates session state to `streaming.isLive = true`

**Benefits:**
- No manual MediaLive setup required
- Channel created only when needed
- Automatic cleanup possible when session ends
- Reduces idle MediaLive costs

## Frontend Integration

### Add Streaming Controls to ControlPanel.jsx

```javascript
import { startStreaming, stopStreaming, startRecording, stopRecording } from '../services/mediaLiveService';

// In component
const [isStreaming, setIsStreaming] = useState(false);
const [isRecording, setIsRecording] = useState(false);

const handleGoLive = async () => {
  try {
    await startStreaming(sessionId);
    setIsStreaming(true);
  } catch (error) {
    console.error('Failed to start streaming:', error);
  }
};

const handleStopStreaming = async () => {
  try {
    await stopStreaming(sessionId);
    setIsStreaming(false);
  } catch (error) {
    console.error('Failed to stop streaming:', error);
  }
};

const handleStartRecording = async () => {
  try {
    await startRecording(sessionId);
    setIsRecording(true);
  } catch (error) {
    console.error('Failed to start recording:', error);
  }
};

const handleStopRecording = async () => {
  try {
    await stopRecording(sessionId);
    setIsRecording(false);
  } catch (error) {
    console.error('Failed to stop recording:', error);
  }
};

// In JSX
<div className="streaming-controls">
  <button onClick={handleGoLive} disabled={isStreaming}>
    Go Live
  </button>
  <button onClick={handleStopStreaming} disabled={!isStreaming}>
    Stop Streaming
  </button>
</div>

<div className="recording-controls">
  <button onClick={handleStartRecording} disabled={isRecording}>
    Start Recording
  </button>
  <button onClick={handleStopRecording} disabled={!isRecording}>
    Stop Recording
  </button>
</div>
```

### Create mediaLiveService.js

```javascript
import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE = 'https://td0dn99gi2.execute-api.us-east-1.amazonaws.com';

async function getAuthToken() {
  const session = await fetchAuthSession();
  return session.tokens.idToken.toString();
}

export async function startStreaming(sessionId) {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/streaming/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to start streaming');
  }
  
  return response.json();
}

export async function stopStreaming(sessionId) {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/streaming/stop`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channelArn: 'arn:aws:ivs:...' // Get from session state
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to stop streaming');
  }
  
  return response.json();
}

export async function startRecording(sessionId) {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/recording/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to start recording');
  }
  
  return response.json();
}

export async function stopRecording(sessionId) {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/recording/stop`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to stop recording');
  }
  
  return response.json();
}
```

## Testing Checklist

- [ ] MediaLive IAM role created
- [ ] Input Security Group created
- [ ] Environment variables configured in `.env.medialive`
- [ ] Lambda function deployed with environment variables
- [ ] Host can join stage successfully
- [ ] "Go Live" button creates MediaLive channel automatically
- [ ] MediaLive channel starts successfully
- [ ] IVS channel receives stream from MediaLive
- [ ] Playback URL shows live stream
- [ ] Recording saves to S3
- [ ] "Stop Streaming" stops MediaLive channel

## Cost Monitoring

MediaLive charges:
- $2.55/hour when channel is running
- Stop channel when not in use to avoid charges

Monitor with:
```powershell
aws medialive list-channels --profile shelcaster-admin --region us-east-1 --query "Channels[?State=='RUNNING']"
```

## Troubleshooting

### MediaLive channel won't start
- Check IAM role permissions
- Verify Input Security Group allows your IP
- Check CloudWatch logs for MediaLive channel

### Recording not saving to S3
- Verify S3 bucket permissions
- Check MediaLive IAM role has s3:PutObject
- Verify S3 destination path in channel config

### Streaming not working
- Verify IVS channel is started
- Check MediaLive output destination
- Verify RTMP endpoint is correct

## Next Phase

After basic streaming/recording works:
1. Add source switching (host/callers/tracklist)
2. Add audio level controls
3. Add tracklist playback integration
4. Add multi-platform streaming (Facebook, YouTube)
5. Add cleanup on broadcast end
