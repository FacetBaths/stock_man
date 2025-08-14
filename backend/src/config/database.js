const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error.message);
    console.log('Note: Make sure MongoDB is running on your system');
    console.log('For Ubuntu/Debian: sudo systemctl start mongod');
    console.log('For macOS with Homebrew: brew services start mongodb-community');
    console.log('Or install MongoDB: https://docs.mongodb.com/manual/installation/');
    process.exit(1);
  }
};

module.exports = connectDB;
