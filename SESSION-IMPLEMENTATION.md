# LiveSession Implementation

This document describes the LiveSession backend implementation for server-authoritative switching and mixing.

## Overview

The LiveSession system implements the backend command path for controlling program state (video source switching, audio mixing, overlays) as specified in `docs/augment/05-switching-and-mixing.md`.

## Architecture

### Core Principles

1. **Backend is single source of truth** for program state
2. **UI requests changes** via commands and renders backend state
3. **UI never infers or computes** program output state locally
4. **State-first approach**: Update DynamoDB first, then apply to IVS (when enabled)

### Data Model

**LiveSession Entity** (DynamoDB: `shelcaster-app` table)
- **PK**: `session#{sessionId}`
- **SK**: `info`
- **Fields**: See `docs/augment/03-live-session-model.md`

**Key Distinction**: LiveSession is ephemeral runtime state, separate from Show (long-lived content).

## Lambda Functions

### 1. shelcaster-create-session

**Purpose**: Create a new LiveSession when host starts a session

**Endpoint**: `POST /sessions`

**Authentication**: Required (Cognito JWT)

**Request Body**:
```json
{
  "showId": "uuid",
  "episodeId": "uuid" // optional
}
```

**Response**:
```json
{
  "message": "LiveSession created successfully",
  "session": { /* full LiveSession object */ }
}
```

**Behavior**:
- Extracts `hostUserId` from Cognito authorizer claims
- Verifies show exists in DynamoDB
- Creates LiveSession with:
  - `status: "ACTIVE"`
  - `programState.activeVideoSource: "host"`
  - `programState.audioLevels.host: 1.0`
  - Empty callers array
  - IVS ARNs copied from show (if available)

### 2. shelcaster-session-command

**Purpose**: Handle all session commands (SWITCH_SOURCE, future: audio mixing, overlays)

**Endpoint**: `POST /sessions/{sessionId}/commands`

**Authentication**: Required (Cognito JWT)

**Request Body**:
```json
{
  "action": "SWITCH_SOURCE",
  "sourceId": "host" | "caller:{participantId}" | "track:{trackId}"
}
```

**Response**:
```json
{
  "message": "Source switched successfully",
  "programState": { /* updated programState */ }
}
```

**Validation**:
1. **Ownership**: `authenticated userId === LiveSession.hostUserId`
2. **Session State**: `LiveSession.status === "ACTIVE"`
3. **sourceId Format**: Must match canonical format (see below)

**Idempotency**: If source already active, returns current state without update

**IVS Composition Update**: Stubbed behind `APPLY_IVS` environment variable (default: 0)

## sourceId Format (Canonical)

The `sourceId` parameter uses these canonical string formats:

- `"host"` - Host camera
- `"caller:{participantId}"` - Caller video (e.g., `"caller:abc123"`)
- `"track:{trackId}"` - Tracklist item (e.g., `"track:trk-001"`)

**Parsing**: `parseSourceId(sourceId)` returns `{type:'host'|'caller'|'track', id?:string}`

**Validation**: Unknown formats are rejected with 400 error

## Session Lifecycle

1. **Creation**: Host clicks "Start Session" → `POST /sessions`
2. **Active**: Session exists with `status: "ACTIVE"`
   - Commands allowed any time during ACTIVE state
   - Does NOT require streaming.isLive === true
   - Does NOT require composition started
3. **Ended**: Session marked `status: "ENDED"` (commands rejected)

## Deployment

### Deploy Lambda Functions

```powershell
cd shelcaster-functions
.\deploy-session-functions.ps1
```

This will:
1. Install dependencies for both functions
2. Create deployment packages
3. Create or update Lambda functions in AWS
4. Set `APPLY_IVS=0` environment variable

### Add API Gateway Routes

```powershell
cd shelcaster-functions
.\add-session-routes.ps1
```

This will:
1. Create API Gateway integrations
2. Create routes with JWT authorization
3. Grant Lambda invoke permissions

### Verify Deployment

Routes available:
- `POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions`
- `POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/{sessionId}/commands`

## Testing

### Create Session

```bash
curl -X POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions \
  -H "Authorization: Bearer {cognito-jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{"showId": "your-show-id"}'
```

### Switch Source

```bash
curl -X POST https://td0dn99gi2.execute-api.us-east-1.amazonaws.com/sessions/{sessionId}/commands \
  -H "Authorization: Bearer {cognito-jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{"action": "SWITCH_SOURCE", "sourceId": "caller:abc123"}'
```

## Future Work

1. **IVS Composition Updates**: Implement `updateIVSComposition()` when `APPLY_IVS=1`
2. **Additional Commands**: Audio mixing, overlay management
3. **Session Polling**: Frontend polling for program state updates
4. **Session Cleanup**: Auto-end sessions after timeout
5. **Participant Tracking**: Update `participants` array when callers join/leave

## Files Created

- `shelcaster-functions/shelcaster-create-session/index.mjs`
- `shelcaster-functions/shelcaster-create-session/package.json`
- `shelcaster-functions/shelcaster-session-command/index.mjs`
- `shelcaster-functions/shelcaster-session-command/package.json`
- `shelcaster-functions/deploy-session-functions.ps1`
- `shelcaster-functions/add-session-routes.ps1`
- `shelcaster-functions/SESSION-IMPLEMENTATION.md` (this file)

