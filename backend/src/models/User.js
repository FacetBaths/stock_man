const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic user information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens']
  },
  
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },
  
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // User profile information
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  
  // Role and permissions
  role: {
    type: String,
    required: true,
    enum: ['admin', 'warehouse_manager', 'sales_rep', 'viewer'],
    default: 'viewer'
  },
  
  // Account status and metadata
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  // Security and tracking
  lastLogin: {
    type: Date,
    default: null
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: {
    type: Date,
    default: null
  },
  
  passwordChangedAt: {
    type: Date,
    default: Date.now
  },
  
  // Refresh token for enhanced security
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: '7d' // Auto-expire after 7 days
    },
    userAgent: String,
    ipAddress: String
  }],
  
  // Password reset functionality
  passwordResetToken: {
    type: String,
    default: null
  },
  
  passwordResetExpires: {
    type: Date,
    default: null
  },
  
  // User preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      lowStock: {
        type: Boolean,
        default: true
      },
      systemAlerts: {
        type: Boolean,
        default: true
      }
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ lastLogin: -1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    
    // Update passwordChangedAt
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to ensure token issued after password change
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to update last login
userSchema.methods.updateLastLogin = function() {
  return this.updateOne({
    $set: { lastLogin: Date.now() }
  });
};

// Method to check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Method to add refresh token
userSchema.methods.addRefreshToken = function(token, userAgent, ipAddress) {
  this.refreshTokens.push({
    token,
    userAgent,
    ipAddress
  });
  
  // Keep only last 5 refresh tokens per user
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
  
  return this.save();
};

// Method to remove refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
  return this.save();
};

// Method to remove all refresh tokens (logout from all devices)
userSchema.methods.removeAllRefreshTokens = function() {
  this.refreshTokens = [];
  return this.save();
};

// Method to generate access and refresh tokens
userSchema.methods.generateTokens = async function() {
  const jwt = require('jsonwebtoken');
  const crypto = require('crypto');
  
  // Generate access token (short-lived)
  const accessToken = jwt.sign(
    {
      id: this._id,
      username: this.username,
      role: this.role,
      email: this.email
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '15m',
      issuer: 'stock-manager',
      audience: 'stock-manager-client'
    }
  );

  // Generate refresh token (long-lived)
  const refreshToken = crypto.randomBytes(64).toString('hex');
  
  // Store refresh token in database
  await this.addRefreshToken(
    refreshToken,
    'unknown', // userAgent - could be passed as parameter
    'unknown'  // ipAddress - could be passed as parameter
  );

  return {
    accessToken,
    refreshToken
  };
};

// Static method to find user by refresh token
userSchema.statics.findByRefreshToken = function(token) {
  return this.findOne({
    'refreshTokens.token': token,
    isActive: true
  });
};

// Static method to refresh access token using refresh token
userSchema.statics.refreshAccessToken = async function(refreshToken) {
  const jwt = require('jsonwebtoken');
  
  try {
    // Find user with this refresh token
    const user = await this.findByRefreshToken(refreshToken);
    
    if (!user) {
      return {
        success: false,
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      };
    }

    // Check if account is active
    if (!user.isActive) {
      return {
        success: false,
        message: 'Account is deactivated',
        code: 'ACCOUNT_INACTIVE'
      };
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE || '15m',
        issuer: 'stock-manager',
        audience: 'stock-manager-client'
      }
    );

    return {
      success: true,
      accessToken,
      user: user.toSafeObject()
    };

  } catch (error) {
    return {
      success: false,
      message: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    };
  }
};

// Static method to get user stats
userSchema.statics.getUserStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        activeCount: {
          $sum: {
            $cond: ['$isActive', 1, 0]
          }
        }
      }
    }
  ]);
};

// Method to get safe user object (excluding sensitive data)
userSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.refreshTokens;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  delete userObject.loginAttempts;
  delete userObject.lockUntil;
  return userObject;
};

// Ensure virtual fields are included in JSON
userSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.loginAttempts;
    delete ret.lockUntil;
    return ret;
  }
});

// Create the User model
const User = mongoose.model('User', userSchema);

// 🛡️  CRITICAL SAFETY: Protect User collection from accidental deletion
// This prevents the devastating bug that wiped all users from production

// Store original methods before overriding
const originalDeleteMany = User.deleteMany;
const originalDrop = User.collection.drop;
const originalDeleteOne = User.deleteOne;

// Override deleteMany to prevent mass deletion in production
User.deleteMany = function(...args) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  
  // BLOCK ALL deleteMany operations in production
  if (isProduction) {
    console.error('🚨 SECURITY BLOCK: User.deleteMany() attempted in production!');
    throw new Error('🛡️  BLOCKED: User.deleteMany() is permanently disabled in production for data safety!');
  }
  
  // In test environment, verify we're connected to a test database
  if (isTest) {
    const dbName = this.db?.databaseName || mongoose.connection.name || '';
    if (!dbName.includes('test') && !dbName.includes('Test')) {
      console.error(`🚨 SAFETY ABORT: deleteMany blocked on database '${dbName}' - not a test database!`);
      throw new Error(`🛡️  BLOCKED: User.deleteMany() rejected - database '${dbName}' doesn't appear to be a test database!`);
    }
    console.warn(`⚠️  Test environment: Allowing User.deleteMany() on confirmed test database: ${dbName}`);
  }
  
  // Log the operation for audit trail
  console.log('🗑️  User.deleteMany() called with args:', JSON.stringify(args));
  return originalDeleteMany.apply(this, args);
};

// Override collection drop to prevent dropping User collection
User.collection.drop = function(...args) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  
  // BLOCK collection drop in production
  if (isProduction) {
    console.error('🚨 SECURITY BLOCK: User collection drop attempted in production!');
    throw new Error('🛡️  BLOCKED: User collection drop is permanently disabled in production for data safety!');
  }
  
  // In test environment, verify we're connected to a test database
  if (isTest) {
    const dbName = this.db?.databaseName || mongoose.connection.name || '';
    if (!dbName.includes('test') && !dbName.includes('Test')) {
      console.error(`🚨 SAFETY ABORT: Collection drop blocked on database '${dbName}' - not a test database!`);
      throw new Error(`🛡️  BLOCKED: User collection drop rejected - database '${dbName}' doesn't appear to be a test database!`);
    }
    console.warn(`⚠️  Test environment: Allowing User collection drop on confirmed test database: ${dbName}`);
  }
  
  console.log('🗑️  User collection drop called');
  return originalDrop.apply(this, args);
};

// Override deleteOne with logging and admin protection
User.deleteOne = function(filter, options) {
  console.log('🗑️  User.deleteOne called with filter:', JSON.stringify(filter));
  
  // Block deletion of admin users in production
  if (process.env.NODE_ENV === 'production' && filter.role === 'admin') {
    console.error('🚨 ADMIN PROTECTION: Attempt to delete admin user blocked!');
    throw new Error('🛡️  BLOCKED: Cannot delete admin users in production for security!');
  }
  
  return originalDeleteOne.apply(this, [filter, options]);
};

// Add a safe method for authorized user deletion
User.safeDeleteUser = async function(userId, requestingUserId, reason = 'No reason provided') {
  try {
    // Find the user to delete
    const userToDelete = await this.findById(userId);
    if (!userToDelete) {
      throw new Error('User not found');
    }
    
    // Find the requesting user
    const requestingUser = await this.findById(requestingUserId);
    if (!requestingUser || requestingUser.role !== 'admin') {
      throw new Error('Unauthorized: Only admin users can delete accounts');
    }
    
    // Prevent admin self-deletion
    if (userId.toString() === requestingUserId.toString()) {
      throw new Error('Cannot delete your own admin account');
    }
    
    // Prevent deletion of other admin users
    if (userToDelete.role === 'admin') {
      throw new Error('Cannot delete other admin users');
    }
    
    // Log the deletion
    console.log(`🗑️  Safe user deletion: ${userToDelete.username} (${userToDelete.role}) by ${requestingUser.username}. Reason: ${reason}`);
    
    // Perform the deletion
    const result = await originalDeleteOne.call(this, { _id: userId });
    
    return {
      success: true,
      deletedUser: userToDelete.username,
      deletedRole: userToDelete.role,
      deletedBy: requestingUser.username,
      reason: reason,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Safe user deletion failed:', error.message);
    throw error;
  }
};

// Add method to check protection status
User.getProtectionStatus = function() {
  return {
    environment: process.env.NODE_ENV,
    protections: {
      deleteMany: process.env.NODE_ENV === 'production' ? 'BLOCKED' : 'PROTECTED',
      collectionDrop: process.env.NODE_ENV === 'production' ? 'BLOCKED' : 'PROTECTED',
      adminDeletion: process.env.NODE_ENV === 'production' ? 'BLOCKED' : 'LOGGED'
    },
    message: 'User collection is protected against accidental mass deletion'
  };
};

console.log('🛡️  User model loaded with enhanced protection against mass deletion');

// Export the protected User model
module.exports = User;
