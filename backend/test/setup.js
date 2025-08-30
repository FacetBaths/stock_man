require('dotenv').config({ path: '.env.test' });
const mongoose = require('mongoose');

// Set test environment
process.env.NODE_ENV = 'test';

// Use test database URL
if (!process.env.MONGODB_TEST_URI) {
  process.env.MONGODB_TEST_URI = 'mongodb://localhost:27017/stock_manager_test';
}

// Global setup for all tests
beforeAll(async () => {
  // Connect to test database
  await mongoose.connect(process.env.MONGODB_TEST_URI);
});

afterAll(async () => {
  // Clean up and close database connection
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});
