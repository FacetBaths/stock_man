/**
 * USER DELETION INVESTIGATION MODULE
 * 
 * This module adds comprehensive logging to track any user deletions
 * Add this to the bottom of User.js to monitor what's deleting users
 */

const mongoose = require('mongoose');
const User = mongoose.models.User || require('./User');

// Store the original MongoDB driver methods
const originalMethods = {
  deleteOne: User.collection.deleteOne,
  deleteMany: User.collection.deleteMany,
  findOneAndDelete: User.collection.findOneAndDelete,
  findOneAndRemove: User.collection.findOneAndRemove,
  remove: User.collection.remove,
  drop: User.collection.drop
};

/**
 * Get stack trace for debugging
 */
function getStackTrace() {
  const stack = new Error().stack;
  return stack.split('\n').slice(3, 8).join('\n');
}

/**
 * Log deletion attempt with full details
 */
function logDeletionAttempt(method, filter, options) {
  const timestamp = new Date().toISOString();
  const stack = getStackTrace();
  
  const logEntry = {
    timestamp,
    method,
    filter: JSON.stringify(filter),
    options: JSON.stringify(options || {}),
    stack,
    database: User.db?.databaseName,
    nodeEnv: process.env.NODE_ENV
  };
  
  console.error('🚨🚨🚨 USER DELETION ATTEMPT DETECTED 🚨🚨🚨');
  console.error(JSON.stringify(logEntry, null, 2));
  console.error('Stack trace:');
  console.error(stack);
  console.error('🚨🚨🚨 END DELETION ATTEMPT LOG 🚨🚨🚨\n');
  
  // Also write to a file if possible
  try {
    const fs = require('fs');
    const logPath = '/tmp/user-deletion-log.json';
    const logs = [];
    
    if (fs.existsSync(logPath)) {
      const existing = fs.readFileSync(logPath, 'utf8');
      logs.push(...JSON.parse(existing));
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Failed to write deletion log to file:', error.message);
  }
  
  return logEntry;
}

// Override deleteOne
User.collection.deleteOne = function(filter, options) {
  const logEntry = logDeletionAttempt('collection.deleteOne', filter, options);
  
  // Block in production unless explicitly allowed
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_USER_DELETION) {
    console.error('🛡️  BLOCKED: User deletion in production without ALLOW_USER_DELETION flag');
    throw new Error('User deletion is blocked in production. Set ALLOW_USER_DELETION=true to override.');
  }
  
  return originalMethods.deleteOne.call(this, filter, options);
};

// Override deleteMany
User.collection.deleteMany = function(filter, options) {
  const logEntry = logDeletionAttempt('collection.deleteMany', filter, options);
  
  // ALWAYS block deleteMany in production
  if (process.env.NODE_ENV === 'production') {
    console.error('🛡️  BLOCKED: User.collection.deleteMany() in production');
    throw new Error('Mass user deletion is permanently blocked in production for data safety!');
  }
  
  return originalMethods.deleteMany.call(this, filter, options);
};

// Override findOneAndDelete
User.collection.findOneAndDelete = function(filter, options) {
  const logEntry = logDeletionAttempt('collection.findOneAndDelete', filter, options);
  
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_USER_DELETION) {
    console.error('🛡️  BLOCKED: User deletion in production without ALLOW_USER_DELETION flag');
    throw new Error('User deletion is blocked in production. Set ALLOW_USER_DELETION=true to override.');
  }
  
  return originalMethods.findOneAndDelete.call(this, filter, options);
};

// Override findOneAndRemove
User.collection.findOneAndRemove = function(filter, options) {
  const logEntry = logDeletionAttempt('collection.findOneAndRemove', filter, options);
  
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_USER_DELETION) {
    console.error('🛡️  BLOCKED: User deletion in production without ALLOW_USER_DELETION flag');
    throw new Error('User deletion is blocked in production. Set ALLOW_USER_DELETION=true to override.');
  }
  
  return originalMethods.findOneAndRemove.call(this, filter, options);
};

// Override remove (deprecated but still possible)
if (originalMethods.remove) {
  User.collection.remove = function(filter, options) {
    const logEntry = logDeletionAttempt('collection.remove', filter, options);
    
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_USER_DELETION) {
      console.error('🛡️  BLOCKED: User deletion in production without ALLOW_USER_DELETION flag');
      throw new Error('User deletion is blocked in production. Set ALLOW_USER_DELETION=true to override.');
    }
    
    return originalMethods.remove.call(this, filter, options);
  };
}

// Override drop
User.collection.drop = function() {
  logDeletionAttempt('collection.drop', {}, {});
  
  if (process.env.NODE_ENV === 'production') {
    console.error('🛡️  BLOCKED: User collection drop in production');
    throw new Error('Dropping users collection is permanently blocked in production!');
  }
  
  return originalMethods.drop.call(this);
};

console.log('✅ User deletion monitoring active with enhanced logging');

module.exports = User;
