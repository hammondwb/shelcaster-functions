# Persistent IVS Channels - Phase 1 Complete

## Overview
Phase 1 (Data Layer & Core APIs) has been implemented. This includes all Lambda functions for channel management, assignment, and state tracking.

## Implemented Lambda Functions

### 1. shelcaster-create-persistent-channel
- **Purpose**: Creates a new persistent IVS channel with recording enabled
- **Endpoint**: `POST /admin/channels`
- **Features**:
  - Creates IVS channel with recording configuration
  - Stores channel metadata in DynamoDB
  - Enforces channel limit (20 channels max)
  - Returns channel details including playback URL

### 2. shelcaster-assign-channel
- **Purpose**: Assigns a persistent channel to a host user
- **Endpoint**: `POST /admin/channels/{channelId}/assign`
- **Features**:
  - Verifies channel exists
  - Creates assignment record with denormalized channel data
  - Supports both 1:1 and N:1 assignment models

### 3. shelcaster-unassign-channel
- **Purpose**: Removes channel assignment from a host
- **Endpoint**: `DELETE /admin/channels/{channelId}/assign/{hostUserId}`
- **Features**:
  - Deletes assignment record
  - Prevents host from broadcasting on unassigned channel

### 4. shelcaster-get-host-channel
- **Purpose**: Retrieves a host's assigned channel information
- **Endpoint**: `GET /hosts/{hostUserId}/channel`
- **Features**:
  - Single-query lookup using assignment record
  - Returns full channel details including state
  - Used by session creation to validate channel assignment

### 5. shelcaster-list-channels
- **Purpose**: Lists all persistent channels with optional filtering
- **Endpoint**: `GET /admin/channels?state=IDLE&limit=50`
- **Features**:
  - Queries using entityType GSI
  - Supports state filtering (IDLE, LIVE, OFFLINE)
  - Pagination support
  - Excludes stream keys from list view

### 6. shelcaster-get-channel-stats
- **Purpose**: Returns usage statistics for a channel
- **Endpoint**: `GET /admin/channels/{channelId}/stats`
- **Features**:
  - Total broadcasts count
  - Total streaming hours/minutes
  - Last broadcast timestamp
  - Current channel state

### 7. shelcaster-get-channel-capacity
- **Purpose**: Returns current channel capacity information
- **Endpoint**: `GET /admin/channels/capacity`
- **Features**:
  - Current channel count
  - Maximum limit
  - Remaining capacity
  - Utilization percentage

### 8. shelcaster-update-channel-state
- **Purpose**: Updates channel state (IDLE, LIVE, OFFLINE)
- **Endpoint**: `PUT /admin/channels/{channelId}/state`
- **Features**:
  - Validates state transitions
  - Updates currentSessionId
  - Includes helper functions for other Lambdas

## DynamoDB Schema

### Channel Record
```
pk: channel#{channelId}
sk: info
entityType: persistentChannel
channelId: UUID
channelArn: string
channelName: string
playbackUrl: string (static)
ingestEndpoint: string
streamKey: string (encrypted in production)
state: IDLE | LIVE | OFFLINE
recordingConfigurationArn: string
currentSessionId: string | null
createdAt: ISO 8601
updatedAt: ISO 8601
totalBroadcasts: number
totalStreamingMinutes: number
lastBroadcastAt: ISO 8601 | null
```

### Channel Assignment Record
```
pk: host#{userId}
sk: channel#assignment
entityType: channelAssignment
hostUserId: string
channelId: string
channelArn: string (denormalized)
playbackUrl: string (denormalized)
ingestEndpoint: string (denormalized)
streamKey: string (denormalized)
assignedAt: ISO 8601
assignedBy: string (admin user ID)
```

## Deployment Scripts

### deploy-persistent-channels.ps1
Deploys all 8 Lambda functions to AWS

Usage:
```powershell
cd shelcaster-functions
.\deploy-persistent-channels.ps1
```

### add-persistent-channels-routes.ps1
Creates API Gateway routes for all endpoints

Usage:
```powershell
cd shelcaster-functions
.\add-persistent-channels-routes.ps1
```

## API Endpoints Summary

| Method | Path | Function | Auth |
|--------|------|----------|------|
| POST | /admin/channels | Create channel | Admin |
| GET | /admin/channels | List channels | Admin |
| POST | /admin/channels/{channelId}/assign | Assign channel | Admin |
| DELETE | /admin/channels/{channelId}/assign/{hostUserId} | Unassign channel | Admin |
| GET | /admin/channels/{channelId}/stats | Get stats | Admin |
| PUT | /admin/channels/{channelId}/state | Update state | Admin |
| GET | /admin/channels/capacity | Get capacity | Admin |
| GET | /hosts/{hostUserId}/channel | Get host channel | Host |

## Next Steps

### Phase 2: Session Integration (Tasks 5-7)
- Modify `shelcaster-create-session` to use persistent channels
- Modify `shelcaster-end-session` to preserve persistent channels
- Update channel state during session lifecycle
- Update channel statistics after broadcasts

### Phase 3: Program Manager UI (Task 17)
- Create Group Edit Form
- Implement group image upload
- Add "Create Channel from Group" functionality
- Submit channel requests to network

### Phase 4: Vista Stream UI (Task 18)
- Create Channel Management page
- Implement pending requests view
- Add approve/reject workflow
- Display active channels

## Testing Checklist

Before proceeding to Phase 2, test the following:

- [ ] Create a persistent channel via API
- [ ] Assign channel to a host user
- [ ] Get host's assigned channel
- [ ] List all channels
- [ ] Get channel statistics
- [ ] Update channel state
- [ ] Get channel capacity
- [ ] Unassign channel from host
- [ ] Verify channel limit enforcement

## Notes

- Stream keys should be encrypted at rest in production (use AWS KMS)
- The entityType GSI must exist in DynamoDB for queries to work
- Recording configuration ARN is hardcoded (update if needed)
- Channel limit is set to 20 (AWS default, can be increased via support)
- All endpoints support CORS for frontend integration
