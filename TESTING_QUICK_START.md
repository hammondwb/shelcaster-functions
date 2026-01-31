# Testing Quick Start Guide

## Installation

```bash
npm install
```

## Running Tests

### Unit Tests (No AWS - Safe to run anytime)

**✅ RECOMMENDED (Works on Windows, macOS, Linux):**
```bash
node run-tests.js
```

**Windows Batch File:**
```cmd
test.bat
```

**Alternative:**
```bash
npm test
```

**What it does:**
- Runs all tests in `tests/unit/`
- No AWS API calls
- Fast execution (< 5 seconds)
- Safe to run in CI/CD

**Expected output:**
```
PASS  tests/unit/live-session.test.js
  LiveSession - Creation and Validation
    ✓ 15 tests passed

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

---

### Integration Tests (Real AWS - Requires credentials)

**✅ RECOMMENDED (Works on Windows, macOS, Linux):**
```bash
node run-tests.js --integration
```

**Windows Batch File:**
```cmd
test.bat integration
```

**Alternative (Unix/Linux/macOS only):**
```bash
RUN_INTEGRATION=1 npm run test:integration
```

**Alternative (Windows PowerShell):**
```powershell
$env:RUN_INTEGRATION="1"; npm run test:integration
```

**Alternative (Windows CMD):**
```cmd
set RUN_INTEGRATION=1 && npm run test:integration
```

**What it does:**
- Runs all tests in `tests/unit/` AND `tests/integration/`
- Makes real AWS API calls to DynamoDB
- Creates and deletes test data
- Requires valid AWS credentials

**Prerequisites:**
- AWS credentials configured (AWS CLI profile or environment variables)
- Access to `shelcaster-app` DynamoDB table in `us-east-1`
- IAM permissions: `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:DeleteItem`

**Expected output:**
```
PASS  tests/unit/live-session.test.js
  ✓ 15 tests passed

PASS  tests/integration/live-session-dynamodb.test.js
  LiveSession - DynamoDB Integration
    ✓ should write a LiveSession to DynamoDB and read it back
    ✓ should verify session status is ACTIVE
    ✓ should maintain all required fields after round-trip

Test Suites: 2 passed, 2 total
Tests:       18 passed, 18 total
```

---

## Test Organization

```
tests/
├── unit/                              # No AWS calls
│   ├── live-session.test.js          # Phase 1: Data model validation
│   └── UNIT_TEST_SUMMARY.md
│
├── integration/                       # Real AWS calls
│   ├── live-session-dynamodb.test.js # Phase 2: DynamoDB operations
│   └── INTEGRATION_TEST_SUMMARY.md
│
├── fixtures/
│   └── live-session-golden.json      # Expected data structure
│
└── test-config.js                     # Shared configuration
```

---

## Environment Variables

### Required for Integration Tests
```bash
AWS_REGION=us-east-1              # Default: us-east-1
TABLE_NAME=shelcaster-app         # Default: shelcaster-app
```

### Optional
```bash
TEST_RUN_ID=my-test-run-123       # For test isolation (auto-generated if not set)
LOG_LEVEL=debug                   # Enable debug logging
AWS_PROFILE=shelcaster-admin      # AWS CLI profile to use
```

---

## Troubleshooting

### "Integration tests skipped" message
✅ **This is normal!** Integration tests only run when `RUN_INTEGRATION=1` is set.

### PowerShell execution policy errors (Windows)
Use the helper script:
```bash
node run-tests.js
```

Or set execution policy:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### AWS credential errors
Verify credentials:
```bash
aws sts get-caller-identity
```

### Table not found
Verify table exists:
```bash
aws dynamodb describe-table --table-name shelcaster-app --region us-east-1
```

---

## What Gets Tested

### Phase 1: Unit Tests (Data Model)
✅ LiveSession creation with required fields  
✅ Validation constraints (activeVideoSource, audioLevels, overlayImageS3Key)  
✅ Idempotent updates  
✅ No AWS calls  

### Phase 2: Integration Tests (DynamoDB)
✅ Write LiveSession to DynamoDB  
✅ Read LiveSession from DynamoDB  
✅ Verify PK/SK structure  
✅ Verify status = ACTIVE  
✅ Data integrity after round-trip  
✅ Automatic cleanup  

---

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Unit Tests
  run: npm test

- name: Run Integration Tests
  run: RUN_INTEGRATION=1 npm run test:integration
  env:
    AWS_REGION: us-east-1
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## Next Steps

After these tests pass:
1. Phase 3: Token minting tests (IVS integration)
2. Phase 4: Program control command tests
3. Phase 5: Recording control tests
4. Phase 6: Recording finalizer tests
5. Phase 7: Export to Media Manager tests
6. Phase 8: E2E show lifecycle script

See `docs/augment/20-regression-test-plan.md` for full test plan.

