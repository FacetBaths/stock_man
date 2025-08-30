module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'  // Exclude server.js from coverage
  ],
  testMatch: [
    '<rootDir>/test/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 30000 // 30 second timeout for database operations
};
