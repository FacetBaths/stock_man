require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { initJSONDB } = require('./config/jsonDB');

// Import routes
const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const tagRoutes = require('./routes/tags');
const skuRoutes = require('./routes/skus');
const exportRoutes = require('./routes/export');

// Import new routes for updated database architecture
const categoryRoutes = require('./routes/categories');
const usersRoutes = require('./routes/users');
const instancesRoutes = require('./routes/instances');
const toolsRoutes = require('./routes/tools');

const app = express();

// Connect to database
connectDB();

// Middleware
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://facetbaths.github.io',
      'https://stock.facetrenovations.us'
    ] 
  : [
      'http://localhost:3000', 
      'http://127.0.0.1:3000', 
      'http://localhost:3001', 
      'http://127.0.0.1:3001',
      'http://localhost:3002', 
      'http://127.0.0.1:3002',
      'http://localhost:3003', 
      'http://127.0.0.1:3003',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];

app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS Origin check:', origin);
    console.log('Allowed origins:', allowedOrigins);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/skus', skuRoutes);
app.use('/api/export', exportRoutes);

// New API routes for updated database architecture
app.use('/api/categories', categoryRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/instances', instancesRoutes);
app.use('/api/tools', toolsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors_origin: req.get('Origin'),
    allowed_origins: allowedOrigins
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  
  // Close HTTP server first
  server.close(async () => {
    console.log('HTTP server closed.');
    
    try {
      // Close database connection
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('Database connection closed.');
      }
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
    
    console.log('Graceful shutdown completed.');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('Forcing exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
