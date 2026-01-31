# Shelcaster Functions - Test Suite

This directory contains unit and integration tests for the Shelcaster backend Lambda functions.

## Setup

Install dependencies (run from repository root):

```bash
npm install
```

## Running Tests

### Unit Tests Only (No AWS calls)

```bash
npm test
```

This runs all tests in `tests/unit/` without making any AWS API calls.

### Integration Tests (Requires AWS credentials)

```bash
RUN_INTEGRATION=1 npm run test:integration
```

**Warning:** Integration tests will make real AWS API calls and create/modify resources in your AWS account.

Required environment variables:
- `AWS_REGION=us-east-1`
- `AWS_PROFILE=shelcaster-admin` (or valid AWS credentials)
- `TABLE_NAME=shelcaster-app`
- `MEDIA_BUCKET=shelcaster-media-manager`
- `CLOUDFRONT_DOMAIN=d2kyyx47f0bavc.cloudfront.net`

Optional:
- `TEST_RUN_ID=<unique-id>` (for test data isolation)
- `LOG_LEVEL=debug`

### Run Specific Test File

```bash
npm test -- tests/unit/live-session.test.js
```

## Test Structure

```
tests/
├── unit/                              # Unit tests (no AWS calls)
│   ├── live-session.test.js          # LiveSession creation and validation
│   └── UNIT_TEST_SUMMARY.md          # Unit test documentation
├── integration/                       # Integration tests (real AWS)
│   └── live-session-dynamodb.test.js # DynamoDB read/write integration
├── fixtures/                          # Golden JSON fixtures
│   └── live-session-golden.json
└── test-config.js                     # Shared test configuration
```

## Phase 1 Tests - LiveSession (Unit)

The `unit/live-session.test.js` file validates:

### Creation
- ✅ All required fields are present
- ✅ Correct DynamoDB key structure (pk/sk)
- ✅ Proper initialization of nested objects

### Validation Constraints
- ✅ `activeVideoSource` must be one of: `host`, `caller`, `track`
- ✅ `audioLevels` must be numeric values between 0.0 and 1.0
- ✅ `overlayImageS3Key` must be null or valid S3 key format

### Idempotent Updates
- ✅ Updating `activeVideoSource` multiple times with same value
- ✅ Updating `audioLevels` multiple times with same values
- ✅ Starting/stopping recording multiple times
- ✅ Starting/stopping streaming multiple times
- ✅ Ending session multiple times

## Phase 2 Tests - LiveSession (Integration)

The `integration/live-session-dynamodb.test.js` file validates:

### DynamoDB Operations
- ✅ Write LiveSession to DynamoDB table
- ✅ Read LiveSession back from DynamoDB
- ✅ Verify all fields persist correctly
- ✅ Verify status is ACTIVE after creation

### Verification Output
The test prints:
- **PK/SK**: DynamoDB partition and sort keys
- **Session ID**: UUID of the created session
- **Host User ID, Show ID, Episode ID**: Related entity IDs
- **Status**: Session status (ACTIVE)
- **Test Run ID**: For test data isolation
- **Table Name and Region**: AWS resource identifiers

### Cleanup
- ✅ Automatically deletes test session after test completion
- ✅ Uses `testRunId` for test data isolation

## Pass Criteria

### Unit Tests
- All assertions succeed
- No AWS SDK calls are made
- Fixtures match expected golden records

### Integration Tests
- All assertions succeed
- DynamoDB operations complete successfully
- Test prints verification artifacts:
  - PK/SK values
  - Session ID
  - Status transitions
- Cleanup completes without errors

## Windows PowerShell Note

If you encounter execution policy errors on Windows, run PowerShell as Administrator and execute:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or run tests directly with Node:

```bash
node node_modules/.bin/jest tests/unit/live-session.test.js
```

