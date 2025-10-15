require('dotenv').config({ path: '.env.test' });
const mongoose = require('mongoose');

// Set test environment
process.env.NODE_ENV = 'test';

// SAFETY CHECK: Ensure we NEVER run against production databases
const PRODUCTION_DB_PATTERNS = [
  'mongodb.net',     // MongoDB Atlas
  'railway.app',     // Railway databases
  'production',      // Any DB with 'production' in name
  'stockmanager',    // The actual production DB name
  'stock_manager'    // Legacy production DB name (without _test suffix)
];

// Use test database URL with safety checks
let testDbUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/stock_manager_test';

// CRITICAL SAFETY CHECK: Prevent accidental production database connection
for (const pattern of PRODUCTION_DB_PATTERNS) {
  if (testDbUri.includes(pattern) && !testDbUri.includes('_test')) {
    throw new Error(`\n\n🚨 CRITICAL ERROR: Test suite attempted to connect to production database!\n` +
                   `Database URI: ${testDbUri}\n` +
                   `This would result in DATA LOSS. Tests are BLOCKED.\n` +
                   `Please set MONGODB_TEST_URI to a proper test database.\n\n`);
  }
}

// Additional safety: Ensure database name ends with _test
if (!testDbUri.includes('_test')) {
  console.warn('⚠️  WARNING: Test database should include "_test" in the name for safety');
}

console.log(`🧪 Test environment using database: ${testDbUri}`);

// Global setup for all tests
beforeAll(async () => {
  // Connect to test database with additional safety checks
  try {
    await mongoose.connect(testDbUri);
    
    // Final safety check: verify we're connected to a test database
    const dbName = mongoose.connection.db.databaseName;
    console.log(`📊 Connected to test database: ${dbName}`);
    
    if (!dbName.includes('test') && !dbName.includes('Test')) {
      throw new Error(`SAFETY ABORT: Database name '${dbName}' doesn't appear to be a test database!`);
    }
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error.message);
    throw error;
  }
});

afterAll(async () => {
  try {
    // Double-check we're still connected to a test database before dropping
    const dbName = mongoose.connection.db.databaseName;
    if (!dbName.includes('test') && !dbName.includes('Test')) {
      console.error(`🚨 BLOCKED: Attempted to drop non-test database '${dbName}'!`);
      await mongoose.connection.close();
      throw new Error('Database drop blocked for safety');
    }
    
    console.log(`🧹 Cleaning up test database: ${dbName}`);
    // Clean up and close database connection
    await mongoose.connection.dropDatabase();
    console.log('✅ Test database dropped successfully');
  } catch (error) {
    console.error('❌ Error during test cleanup:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Test database connection closed');
  }
});
