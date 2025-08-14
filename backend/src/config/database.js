const mongoose = require('mongoose');

const connectDB = async () => {
  // Skip MongoDB if no connection string provided
  if (!process.env.MONGODB_URI) {
    console.log('🗂️  Using JSON file database (no MONGODB_URI provided)');
    console.log('📁 Database file: backend/data.json');
    console.log('💡 To use MongoDB: Set MONGODB_URI environment variable');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    console.log('📊 Using MongoDB database');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️  Falling back to JSON file database');
    console.log('📁 Database file: backend/data.json');
    console.log('💡 To use MongoDB: Check your MONGODB_URI and connection');
    // Don't exit - fallback to JSON database
  }
};

module.exports = connectDB;
