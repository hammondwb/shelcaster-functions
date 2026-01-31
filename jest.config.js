module.exports = {
  testEnvironment: 'node',
  // Only run integration tests when RUN_INTEGRATION=1
  testMatch: process.env.RUN_INTEGRATION === '1'
    ? ['**/tests/**/*.test.js']
    : ['**/tests/unit/**/*.test.js'],
  collectCoverageFrom: [
    '**/index.{js,mjs}',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['/node_modules/'],
  // Workaround for AWS SDK v3 ESM/dynamic imports in Jest
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  }
};

