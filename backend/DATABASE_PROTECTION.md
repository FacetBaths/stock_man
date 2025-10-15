# 🛡️ Database Protection System

This document describes the multi-layered protection system implemented to prevent accidental deletion of the User collection and other critical data.

## Background

In October 2024, a critical incident occurred where the Jest test configuration accidentally connected to the production MongoDB Atlas database and executed `dropDatabase()`, resulting in complete data loss of all users except the Sales user. This protection system was implemented to prevent such incidents from recurring.

## Protection Layers

### 1. User Model Protection (`/src/models/User.js`)

**Features:**
- **Production Block**: All `User.deleteMany()` operations are completely blocked in production
- **Test Database Validation**: In test environment, validates database name contains "test"
- **Collection Drop Protection**: Prevents dropping the User collection in production
- **Admin Protection**: Blocks deletion of admin users in production
- **Audit Logging**: All deletion operations are logged for audit trail

**Methods Added:**
```javascript
User.safeDeleteUser(userId, requestingUserId, reason) // Safe deletion with authorization
User.getProtectionStatus() // Get current protection status
```

### 2. Database Protection Middleware (`/src/middleware/databaseProtection.js`)

**Features:**
- **Database Drop Protection**: Completely blocks `mongoose.connection.dropDatabase()` in production
- **Collection Monitoring**: Monitors and protects the User collection specifically
- **Test Database Validation**: Ensures only databases with "test" in name can be dropped
- **Restore Operation Blocking**: Blocks dangerous import/restore operations in production
- **Connection Safety Checks**: Validates database connection safety for all requests

**Middleware Functions:**
```javascript
DatabaseProtection.checkConnectionSafety(req, res, next)
DatabaseProtection.blockDangerousRestoreOperations(req, res, next)
DatabaseProtection.getProtectionStatus()
```

### 3. Enhanced Test Configuration (`/test/setup.js`)

**Safety Features:**
- **Production Database Pattern Detection**: Blocks connections to MongoDB Atlas, Railway, or production databases
- **Database Name Validation**: Ensures database name contains "_test" suffix
- **Multiple Safety Checks**: Triple-checks before executing `dropDatabase()`
- **Descriptive Error Messages**: Clear warnings about what went wrong and how to fix it

**Protected Patterns:**
- `mongodb.net` (MongoDB Atlas)
- `railway.app` (Railway databases)
- `production` (Any DB with 'production')
- `stockmanager` (Actual production DB name)

### 4. Server Integration (`/src/server.js`)

**Integration Points:**
- Database protection initialized before database connection
- Middleware applied to all routes
- Protection status included in health check endpoint
- Dedicated protection status endpoint: `/api/protection-status`

## API Endpoints

### GET /api/protection-status

Returns comprehensive protection status:

```json
{
  "success": true,
  "status": "active",
  "database": "stockmanager",
  "environment": "production",
  "protections": {
    "databaseDrop": "BLOCKED",
    "userCollectionDrop": "BLOCKED",
    "restoreOperations": "BLOCKED",
    "massUserDeletion": "BLOCKED"
  },
  "safeguards": [
    "Production database operations blocked",
    "Test database name validation",
    "User collection mass deletion protection",
    "Restore operation restrictions",
    "Audit logging for all operations"
  ],
  "userModelProtection": {
    "environment": "production",
    "protections": {
      "deleteMany": "BLOCKED",
      "collectionDrop": "BLOCKED",
      "adminDeletion": "BLOCKED"
    }
  }
}
```

## Environment-Based Behavior

### Production Environment (`NODE_ENV=production`)
- ❌ **BLOCKED**: `User.deleteMany()`
- ❌ **BLOCKED**: User collection drop
- ❌ **BLOCKED**: Database drop
- ❌ **BLOCKED**: Restore/import operations
- ❌ **BLOCKED**: Admin user deletion
- ✅ **ALLOWED**: Individual user deletion via `User.safeDeleteUser()`

### Test Environment (`NODE_ENV=test`)
- ✅ **ALLOWED**: All operations on databases containing "test"
- ❌ **BLOCKED**: All operations on non-test databases
- 🔍 **LOGGED**: All operations for audit trail

### Development Environment
- ⚠️ **PROTECTED**: All operations logged and validated
- 🔍 **MONITORED**: Database name validation active

## Testing the Protection

### Test Safe Operations
```bash
# Check protection status
curl http://localhost:5000/api/protection-status

# Test health endpoint (includes protection info)
curl http://localhost:5000/api/health
```

### Test Blocked Operations (Will Fail Safely)
```javascript
// In Node.js console (production environment)
const User = require('./src/models/User');

// This will throw an error in production
User.deleteMany({}).catch(console.error);
// Error: 🛡️ BLOCKED: User.deleteMany() is permanently disabled in production for data safety!
```

## Safe User Management

### Deleting Users Safely
```javascript
// Use the safe deletion method
const result = await User.safeDeleteUser(
  userIdToDelete,
  adminUserId,
  'User requested account deletion'
);
```

### User Management Best Practices
1. **Always use `User.safeDeleteUser()`** for production deletions
2. **Never use `User.deleteMany()`** in production
3. **Verify environment** before bulk operations
4. **Check protection status** regularly via API endpoint

## Recovery Procedures

If users are accidentally deleted:

1. **Check audit logs** - All operations are logged
2. **Review MongoDB Atlas logs** - Check for external manipulation
3. **Restore from backup** - Use MongoDB Atlas automated backups
4. **Recreate users** - Use the user creation API with proper roles

## Monitoring and Alerts

The system logs all critical operations:

```
🛡️ User model loaded with enhanced protection against mass deletion
🔒 Database protection active for: stockmanager
🛡️ Environment: production
🔍 Database operation check: GET /api/users on database: stockmanager
```

Look for these log patterns:
- `🚨 SECURITY BLOCK` - Blocked dangerous operation
- `🛡️ BLOCKED` - Protection system activation
- `⚠️ WARNING` - Potentially risky operation allowed

## Maintenance

### Updating Protection Rules
1. Modify patterns in `PRODUCTION_DB_PATTERNS` array
2. Add new dangerous operations to middleware
3. Test thoroughly in development environment
4. Deploy with caution

### Disabling Protection (EMERGENCY ONLY)
If protection needs to be temporarily disabled for emergency recovery:

1. Set environment variable: `DISABLE_DATABASE_PROTECTION=true`
2. Restart server
3. **RE-ENABLE IMMEDIATELY** after recovery
4. Never commit this change to version control

## Version History

- **v1.0** (October 2024): Initial implementation after production incident
- **v1.1**: Added middleware layer and enhanced validation
- **v1.2**: Added API endpoints and comprehensive logging

---

⚠️ **CRITICAL**: Never modify or disable these protections without understanding the risks. The original incident resulted in complete loss of all user accounts. These safeguards are essential for data integrity.