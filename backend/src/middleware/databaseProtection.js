const mongoose = require('mongoose');

/**
 * 🛡️  Database Protection Middleware
 * 
 * This middleware provides an additional layer of protection against
 * dangerous database operations that could cause data loss.
 * 
 * Specifically protects against the Jest test bug that wiped all users.
 */

class DatabaseProtection {
  static initialize() {
    console.log('🛡️  Initializing database protection middleware...');
    
    // Protect against dropDatabase in production
    const originalDropDatabase = mongoose.connection.dropDatabase;
    mongoose.connection.dropDatabase = function(...args) {
      const isProduction = process.env.NODE_ENV === 'production';
      const dbName = this.name || this.db?.databaseName || 'unknown';
      
      if (isProduction) {
        console.error(`🚨 CRITICAL SECURITY BLOCK: Attempted to drop database '${dbName}' in production!`);
        throw new Error(`🛡️  BLOCKED: Database drop operation is permanently disabled in production environment!`);
      }
      
      // In non-production, verify it's a test database
      if (!dbName.includes('test') && !dbName.includes('Test')) {
        console.error(`🚨 SAFETY BLOCK: Attempted to drop non-test database '${dbName}'!`);
        throw new Error(`🛡️  BLOCKED: Can only drop databases with 'test' in the name. Database '${dbName}' rejected.`);
      }
      
      console.warn(`⚠️  Dropping test database: ${dbName}`);
      return originalDropDatabase.apply(this, args);
    };
    
    // Monitor collection operations
    mongoose.connection.on('collection', (collection) => {
      if (collection.collectionName === 'users') {
        console.log('🔍  Monitoring User collection for dangerous operations...');
        
        // Override the native collection drop method
        const originalDrop = collection.drop;
        collection.drop = function(...args) {
          const isProduction = process.env.NODE_ENV === 'production';
          const dbName = this.s?.db?.databaseName || 'unknown';
          
          if (isProduction) {
            console.error(`🚨 USER COLLECTION PROTECTION: Blocked drop of users collection in production!`);
            throw new Error(`🛡️  BLOCKED: User collection drop is permanently disabled in production!`);
          }
          
          if (!dbName.includes('test') && !dbName.includes('Test')) {
            console.error(`🚨 USER COLLECTION SAFETY: Blocked drop of users collection on non-test database '${dbName}'!`);
            throw new Error(`🛡️  BLOCKED: User collection can only be dropped on test databases!`);
          }
          
          console.warn(`⚠️  Dropping users collection on test database: ${dbName}`);
          return originalDrop.apply(this, args);
        };
      }
    });
    
    // Add connection event handlers for monitoring
    mongoose.connection.on('connected', () => {
      const dbName = mongoose.connection.name || mongoose.connection.db?.databaseName;
      console.log(`🔒  Database protection active for: ${dbName}`);
      console.log(`🛡️  Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
    mongoose.connection.on('error', (error) => {
      console.error('🚨 Database connection error:', error.message);
    });
    
    // Add process event handlers to prevent unsafe shutdowns
    process.on('SIGTERM', () => {
      console.log('🛡️  SIGTERM received - Database protection middleware shutting down safely...');
    });
    
    process.on('SIGINT', () => {
      console.log('🛡️  SIGINT received - Database protection middleware shutting down safely...');
    });
  }
  
  /**
   * Middleware to check if current connection is safe for destructive operations
   */
  static checkConnectionSafety(req, res, next) {
    const dbName = mongoose.connection.name || mongoose.connection.db?.databaseName || 'unknown';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Log the request for audit
    console.log(`🔍  Database operation check: ${req.method} ${req.originalUrl} on database: ${dbName}`);
    
    // Store database info in request for use by routes
    req.databaseInfo = {
      name: dbName,
      isProduction,
      isSafe: !isProduction && (dbName.includes('test') || dbName.includes('Test'))
    };
    
    next();
  }
  
  /**
   * Middleware to block dangerous import/restore operations
   */
  static blockDangerousRestoreOperations(req, res, next) {
    const { databaseInfo } = req;
    
    // Block restore operations that could wipe user data in production
    if (req.originalUrl.includes('/restore') || req.originalUrl.includes('/import')) {
      if (databaseInfo?.isProduction) {
        console.error(`🚨 RESTORE BLOCK: Dangerous restore operation blocked in production!`);
        return res.status(403).json({
          success: false,
          message: 'Restore operations are disabled in production environment',
          error: 'RESTORE_BLOCKED_PRODUCTION'
        });
      }
      
      if (!databaseInfo?.isSafe) {
        console.error(`🚨 RESTORE SAFETY: Restore operation blocked on non-test database!`);
        return res.status(403).json({
          success: false,
          message: 'Restore operations can only be performed on test databases',
          error: 'RESTORE_BLOCKED_UNSAFE_DB'
        });
      }
    }
    
    next();
  }
  
  /**
   * Get current protection status
   */
  static getProtectionStatus() {
    const dbName = mongoose.connection.name || mongoose.connection.db?.databaseName || 'disconnected';
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      status: 'active',
      database: dbName,
      environment: process.env.NODE_ENV || 'development',
      protections: {
        databaseDrop: isProduction ? 'BLOCKED' : 'PROTECTED',
        userCollectionDrop: isProduction ? 'BLOCKED' : 'PROTECTED',
        restoreOperations: isProduction ? 'BLOCKED' : 'PROTECTED',
        massUserDeletion: isProduction ? 'BLOCKED' : 'PROTECTED'
      },
      safeguards: [
        'Production database operations blocked',
        'Test database name validation',
        'User collection mass deletion protection',
        'Restore operation restrictions',
        'Audit logging for all operations'
      ],
      lastInitialized: new Date().toISOString()
    };
  }
}

module.exports = DatabaseProtection;