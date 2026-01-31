# LiveSession DynamoDB Integration Test Summary

## Test File
`tests/integration/live-session-dynamodb.test.js`

## Purpose
Validates LiveSession DynamoDB read/write operations as specified in Phase 2 of the regression test plan (`docs/augment/20-regression-test-plan.md`).

## ⚠️ IMPORTANT: RUN_INTEGRATION Gating

This test is **automatically skipped** unless `RUN_INTEGRATION=1` is set.

```bash
# Tests will be skipped
npm test

# Tests will run against real AWS
RUN_INTEGRATION=1 npm run test:integration
```

## Prerequisites

### AWS Credentials
Must have valid AWS credentials configured:
- AWS CLI profile: `shelcaster-admin` (or default)
- IAM permissions for DynamoDB operations on `shelcaster-app` table

### Environment Variables
- `AWS_REGION=us-east-1` (default)
- `TABLE_NAME=shelcaster-app` (default)
- `TEST_RUN_ID=<unique-id>` (optional, auto-generated)

## Test Coverage

### ✅ Write Operation
- Creates a complete LiveSession entity
- Writes to DynamoDB using `PutItemCommand`
- Includes `testRunId` for test data isolation
- Verifies HTTP 200 response

### ✅ Read Operation
- Reads LiveSession back using `GetItemCommand`
- Unmarshalls DynamoDB item format
- Verifies all fields match original values

### ✅ Data Integrity
- All required top-level fields present
- All nested structures intact
- Field values match expected types
- Status is `ACTIVE` after creation

### ✅ Cleanup
- Automatically deletes test session in `afterAll` hook
- Uses `DeleteItemCommand`
- Prevents test data accumulation

## Printed Verification Artifacts

The test prints the following for manual verification:

```
=== Integration Test Configuration ===
AWS Region: us-east-1
Table Name: shelcaster-app
Test Run ID: test-1706745600000
=====================================

=== Writing LiveSession to DynamoDB ===
Session ID: 550e8400-e29b-41d4-a716-446655440000
PK: session#550e8400-e29b-41d4-a716-446655440000
SK: info
Host User ID: 660e8400-e29b-41d4-a716-446655440001
Show ID: 770e8400-e29b-41d4-a716-446655440002
Episode ID: 880e8400-e29b-41d4-a716-446655440003
Status: ACTIVE
✓ LiveSession written successfully

=== Reading LiveSession from DynamoDB ===
✓ LiveSession retrieved successfully

=== Verification Results ===
PK: session#550e8400-e29b-41d4-a716-446655440000
SK: info
Session ID: 550e8400-e29b-41d4-a716-446655440000
Entity Type: liveSession
Status: ACTIVE
Host User ID: 660e8400-e29b-41d4-a716-446655440001
Show ID: 770e8400-e29b-41d4-a716-446655440002
Episode ID: 880e8400-e29b-41d4-a716-446655440003
Test Run ID: test-1706745600000
Created At: 2026-01-31T12:00:00.000Z
Updated At: 2026-01-31T12:00:00.000Z
============================

✓ All assertions passed

=== PASS ===
LiveSession successfully written to and read from DynamoDB
Verification artifacts:
  - PK: session#550e8400-e29b-41d4-a716-446655440000
  - SK: info
  - Session ID: 550e8400-e29b-41d4-a716-446655440000
  - Table: shelcaster-app
  - Region: us-east-1
============
```

## Test Statistics
- **Total test suites**: 1
- **Total tests**: 3
- **Timeout**: 30 seconds per test (AWS operations)

## Running the Tests

### Option 1: Using npm script (recommended)
```bash
RUN_INTEGRATION=1 npm run test:integration
```

### Option 2: Direct Jest execution
```bash
RUN_INTEGRATION=1 node node_modules/.bin/jest tests/integration/live-session-dynamodb.test.js
```

### Option 3: Using helper script
```bash
node run-tests.js --integration
```

## Expected Output

```
PASS  tests/integration/live-session-dynamodb.test.js (10.234 s)
  LiveSession - DynamoDB Integration
    Create and Read LiveSession
      ✓ should write a LiveSession to DynamoDB and read it back (5234 ms)
      ✓ should verify session status is ACTIVE (1234 ms)
    Data Integrity
      ✓ should maintain all required fields after round-trip (1123 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

## Phase 2 Pass Criteria

✅ Integration tests pass  
✅ DynamoDB item exists with correct PK/SK  
✅ Status is ACTIVE after creation  
✅ Test prints verification artifacts:
  - PK/SK
  - sessionId
  - Status transitions

## Manual Verification

You can manually verify the test data in DynamoDB:

```bash
aws dynamodb get-item \
  --table-name shelcaster-app \
  --key '{"pk":{"S":"session#<SESSION_ID>"},"sk":{"S":"info"}}' \
  --region us-east-1
```

## Troubleshooting

### Tests are skipped
- Ensure `RUN_INTEGRATION=1` is set
- Check console output for skip warning

### AWS credential errors
- Verify AWS CLI is configured: `aws sts get-caller-identity`
- Check IAM permissions for DynamoDB

### Table not found
- Verify table exists: `aws dynamodb describe-table --table-name shelcaster-app`
- Check region is correct (us-east-1)

## Next Steps

After integration tests pass, Phase 3 can implement token minting tests with IVS integration.

