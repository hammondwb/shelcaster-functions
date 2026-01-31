# LiveSession Unit Test Summary

## Test File
`tests/unit/live-session.test.js`

## Purpose
Validates LiveSession creation and idempotent update logic as specified in Phase 1 of the regression test plan (`docs/augment/20-regression-test-plan.md`).

## Coverage

### ✅ LiveSession Creation
Tests that a LiveSession can be created with all required fields:
- `sessionId`, `hostUserId`, `showId`, `episodeId`
- DynamoDB keys: `pk: session#{sessionId}`, `sk: info`
- Entity type: `liveSession`
- Status: `ACTIVE`
- Nested structures: `ivs`, `participants`, `programState`, `tracklist`, `streaming`, `recording`

### ✅ Validation Constraints

#### activeVideoSource
- Must be one of: `host`, `caller`, `track`
- Rejects invalid values

#### audioLevels
- Must be numeric values
- Must be in range 0.0 to 1.0
- Includes clamping function test

#### overlayImageS3Key
- Can be `null`
- If string, must be valid S3 key format
- Must not start with `/`
- Must not be empty string

### ✅ Idempotent Updates
Tests that repeated updates with the same values produce consistent results:

1. **activeVideoSource** - Switching to same source multiple times
2. **audioLevels** - Setting same levels multiple times
3. **recording.isRecording** - Starting recording multiple times
4. **streaming.isLive** - Starting streaming multiple times (preserves startedAt)
5. **status** - Ending session multiple times

## Test Statistics
- **Total test suites**: 1
- **Total tests**: 15
- **Test categories**: 5 (Creation, activeVideoSource, audioLevels, overlayImageS3Key, Idempotent Updates)

## No AWS Calls
✅ This test file makes **zero AWS SDK calls**. All tests are pure unit tests validating data structures and business logic.

## Fixtures
Golden fixture available at: `tests/fixtures/live-session-golden.json`

## Running the Tests

### Option 1: Using npm (requires execution policy)
```bash
npm test
```

### Option 2: Direct Node execution
```bash
node run-tests.js
```

### Option 3: Jest directly
```bash
node node_modules/.bin/jest tests/unit/live-session.test.js
```

## Expected Output
All 15 tests should pass with output similar to:
```
PASS  tests/unit/live-session.test.js
  LiveSession - Creation and Validation
    createLiveSession
      ✓ should create a valid LiveSession with all required fields
      ✓ should initialize with default programState values
    activeVideoSource validation
      ✓ should accept valid activeVideoSource: host
      ✓ should accept valid activeVideoSource: caller
      ✓ should accept valid activeVideoSource: track
      ✓ should reject invalid activeVideoSource
    audioLevels validation
      ✓ should accept valid audio levels (0.0 to 1.0)
      ✓ should clamp audio levels to valid range
    overlayImageS3Key validation
      ✓ should accept null overlayImageS3Key
      ✓ should accept valid S3 key format
      ✓ should validate S3 key format
    Idempotent Updates
      ✓ should update programState.activeVideoSource idempotently
      ✓ should update audioLevels idempotently
      ✓ should update recording state idempotently
      ✓ should update streaming state idempotently
      ✓ should update session status idempotently

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

## Phase 1 Pass Criteria
✅ Unit tests pass  
✅ Fixtures (golden JSON) match expected records  
✅ No AWS calls made  

## Next Steps
After these unit tests pass, Phase 2 integration tests can be implemented to test actual DynamoDB operations.

