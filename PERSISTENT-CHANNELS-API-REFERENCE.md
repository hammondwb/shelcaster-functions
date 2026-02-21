# Persistent IVS Channels - API Reference

Quick reference for all persistent channel API endpoints.

## Base URL
```
https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com
```

## Endpoints

### 1. Create Persistent Channel
Creates a new IVS channel with recording enabled.

**Endpoint**: `POST /admin/channels`

**Request Body**:
```json
{
  "name": "My Channel Name",
  "recordingEnabled": true
}
```

**Response** (201 Created):
```json
{
  "message": "Persistent channel created successfully",
  "channel": {
    "channelId": "abc-123-def-456",
    "channelArn": "arn:aws:ivs:us-east-1:...",
    "channelName": "My Channel Name",
    "playbackUrl": "https://abc123.us-east-1.playback.live-video.net/api/video/v1/...",
    "ingestEndpoint": "rtmps://abc123.global-contribute.live-video.net:443/app/",
    "state": "IDLE",
    "createdAt": "2024-02-19T10:30:00.000Z"
  }
}
```

**Errors**:
- `400`: Missing required field (name)
- `429`: Maximum channel limit reached (20 channels)
- `500`: Failed to create IVS channel

---

### 2. List All Channels
Lists all persistent channels with optional filtering.

**Endpoint**: `GET /admin/channels`

**Query Parameters**:
- `state` (optional): Filter by state (IDLE, LIVE, OFFLINE)
- `limit` (optional): Number of results (default: 50)
- `nextToken` (optional): Pagination token

**Examples**:
```
GET /admin/channels
GET /admin/channels?state=IDLE
GET /admin/channels?limit=10
GET /admin/channels?state=LIVE&limit=20
```

**Response** (200 OK):
```json
{
  "channels": [
    {
      "channelId": "abc-123",
      "channelName": "My Channel",
      "channelArn": "arn:aws:ivs:...",
      "playbackUrl": "https://...",
      "state": "IDLE",
      "totalBroadcasts": 5,
      "totalStreamingMinutes": 120,
      "lastBroadcastAt": "2024-02-19T09:00:00.000Z",
      "createdAt": "2024-02-15T10:00:00.000Z"
    }
  ],
  "count": 1,
  "nextToken": "eyJ..." // if more results available
}
```

---

### 3. Assign Channel to Host
Assigns a persistent channel to a host user.

**Endpoint**: `POST /admin/channels/{channelId}/assign`

**Path Parameters**:
- `channelId`: The channel ID to assign

**Request Body**:
```json
{
  "hostUserId": "user-cognito-sub-id"
}
```

**Response** (200 OK):
```json
{
  "message": "Channel assigned successfully",
  "assignment": {
    "channelId": "abc-123",
    "hostUserId": "user-cognito-sub-id",
    "assignedAt": "2024-02-19T10:30:00.000Z"
  }
}
```

**Errors**:
- `400`: Missing channelId or hostUserId
- `404`: Channel not found
- `500`: Failed to assign channel

---

### 4. Unassign Channel from Host
Removes channel assignment from a host.

**Endpoint**: `DELETE /admin/channels/{channelId}/assign/{hostUserId}`

**Path Parameters**:
- `channelId`: The channel ID
- `hostUserId`: The host user ID

**Response** (200 OK):
```json
{
  "message": "Channel unassigned successfully",
  "channelId": "abc-123",
  "hostUserId": "user-cognito-sub-id"
}
```

**Errors**:
- `400`: Missing channelId or hostUserId
- `500`: Failed to unassign channel

---

### 5. Get Host's Assigned Channel
Retrieves the channel assigned to a specific host.

**Endpoint**: `GET /hosts/{hostUserId}/channel`

**Path Parameters**:
- `hostUserId`: The host user ID (Cognito sub)

**Response** (200 OK):
```json
{
  "channelId": "abc-123",
  "channelArn": "arn:aws:ivs:...",
  "channelName": "My Channel",
  "playbackUrl": "https://...",
  "ingestEndpoint": "rtmps://...",
  "state": "IDLE",
  "assignedAt": "2024-02-19T10:30:00.000Z",
  "currentSessionId": null
}
```

**Errors**:
- `400`: Missing hostUserId
- `404`: No channel assigned to this host
- `500`: Failed to get host channel

---

### 6. Get Channel Statistics
Returns usage statistics for a channel.

**Endpoint**: `GET /admin/channels/{channelId}/stats`

**Path Parameters**:
- `channelId`: The channel ID

**Response** (200 OK):
```json
{
  "channelId": "abc-123",
  "channelName": "My Channel",
  "totalBroadcasts": 15,
  "totalStreamingHours": "25.50",
  "totalStreamingMinutes": 1530,
  "lastBroadcastAt": "2024-02-19T09:00:00.000Z",
  "currentState": "IDLE",
  "createdAt": "2024-02-15T10:00:00.000Z"
}
```

**Errors**:
- `400`: Missing channelId
- `404`: Channel not found
- `500`: Failed to get channel statistics

---

### 7. Update Channel State
Updates the state of a channel (IDLE, LIVE, OFFLINE).

**Endpoint**: `PUT /admin/channels/{channelId}/state`

**Path Parameters**:
- `channelId`: The channel ID

**Request Body**:
```json
{
  "newState": "LIVE",
  "sessionId": "session-123-abc"
}
```

**Valid States**:
- `IDLE`: Channel is not broadcasting
- `LIVE`: Channel is actively broadcasting
- `OFFLINE`: Channel is disabled/unavailable

**Response** (200 OK):
```json
{
  "message": "Channel state updated successfully",
  "channelId": "abc-123",
  "previousState": "IDLE",
  "newState": "LIVE",
  "sessionId": "session-123-abc",
  "updatedAt": "2024-02-19T10:30:00.000Z"
}
```

**Errors**:
- `400`: Missing channelId or newState, or invalid state
- `500`: Failed to update channel state

---

### 8. Get Channel Capacity
Returns current channel capacity information.

**Endpoint**: `GET /admin/channels/capacity`

**Response** (200 OK):
```json
{
  "currentChannelCount": 5,
  "maxChannelLimit": 20,
  "remainingCapacity": 15,
  "utilizationPercentage": "25.00"
}
```

**Errors**:
- `500`: Failed to get channel capacity

---

## Common Response Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Missing or invalid parameters |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Channel limit reached |
| 500 | Internal Server Error | Server-side error |

## CORS Headers

All endpoints support CORS with the following headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: *
```

## Authentication

Currently, endpoints do not enforce authentication in Phase 1. In production:
- Admin endpoints (`/admin/*`) should require admin role
- Host endpoints (`/hosts/*`) should require authenticated user
- Use API Gateway JWT authorizer with Cognito

## Rate Limits

AWS IVS has the following limits:
- **Channels per account**: 20 (default, can be increased)
- **CreateChannel API**: 5 requests per second
- **DeleteChannel API**: 5 requests per second

## Example Usage with JavaScript

```javascript
// Create a channel
const response = await fetch('https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com/admin/channels', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Channel',
    recordingEnabled: true
  })
});
const data = await response.json();
console.log('Channel created:', data.channel.channelId);

// Get host's channel
const hostChannel = await fetch(`https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com/hosts/${userId}/channel`);
const channelData = await hostChannel.json();
console.log('Playback URL:', channelData.playbackUrl);
```

## Example Usage with PowerShell

```powershell
# Create a channel
$body = @{
    name = "My Channel"
    recordingEnabled = $true
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com/admin/channels" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"

Write-Host "Channel ID: $($response.channel.channelId)"

# List channels
$channels = Invoke-RestMethod `
    -Uri "https://qvhxb7wnp3.execute-api.us-east-1.amazonaws.com/admin/channels?state=IDLE" `
    -Method Get

Write-Host "IDLE Channels: $($channels.count)"
```
