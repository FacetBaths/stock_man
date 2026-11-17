// Explicitly exclude the shared database setup and its destructive cleanup.
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/barcode-search.test.js',
    '<rootDir>/test/inventory-locations.test.js'
  ]
};
