#!/usr/bin/env node

/**
 * Test runner script - bypasses PowerShell execution policy issues
 * Works on Windows, macOS, and Linux
 *
 * Usage:
 *   node run-tests.js              # Run unit tests only (no AWS)
 *   node run-tests.js --integration # Run all tests including integration (requires AWS)
 *   node run-tests.js --help        # Show help
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Shelcaster Functions Test Runner

Usage:
  node run-tests.js              Run unit tests only (no AWS calls)
  node run-tests.js --integration Run all tests including integration (requires AWS)
  node run-tests.js --help        Show this help message

Examples:
  node run-tests.js              # Fast, safe, no AWS
  node run-tests.js --integration # Full test suite with AWS

Environment Variables:
  AWS_REGION      AWS region (default: us-east-1)
  TABLE_NAME      DynamoDB table name (default: shelcaster-app)
  TEST_RUN_ID     Test isolation ID (auto-generated if not set)
`);
  process.exit(0);
}

const isIntegration = args.includes('--integration');

// Set environment variables
const env = { ...process.env };
if (isIntegration) {
  env.RUN_INTEGRATION = '1';

  // Use shelcaster-admin profile if AWS_PROFILE is not already set
  if (!env.AWS_PROFILE) {
    env.AWS_PROFILE = 'shelcaster-admin';
  }
}

// Determine test path
const testPath = isIntegration
  ? 'tests/**/*.test.js'
  : 'tests/unit/**/*.test.js';

// Run Jest - use the actual jest.js file instead of the bin wrapper
const jestPath = path.join(__dirname, 'node_modules', 'jest', 'bin', 'jest.js');
const jestArgs = [testPath, '--verbose'];

// Add experimental VM modules flag for AWS SDK v3 when running integration tests
const nodeArgs = isIntegration ? ['--experimental-vm-modules', jestPath, ...jestArgs] : [jestPath, ...jestArgs];

if (isIntegration) {
  console.log('🔧 Running INTEGRATION tests (includes AWS calls)');
  console.log(`   AWS Profile: ${env.AWS_PROFILE}`);
  console.log(`   AWS Region: ${env.AWS_REGION || 'us-east-1'}`);
  console.log(`   Table Name: ${env.TABLE_NAME || 'shelcaster-app'}`);
  console.log(`   Test path: ${testPath}`);
  console.log('');
} else {
  console.log('🔧 Running UNIT tests only (no AWS calls)');
  console.log(`   Test path: ${testPath}`);
  console.log('');
}

const jest = spawn('node', nodeArgs, {
  env,
  stdio: 'inherit'
});

jest.on('close', (code) => {
  process.exit(code);
});

