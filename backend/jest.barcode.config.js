// These tests mock the database; do not load test/setup.js or its database cleanup.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/barcode-search.test.js']
};
