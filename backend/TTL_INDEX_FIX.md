# 🚨 CRITICAL FIX: TTL Index User Deletion Bug

## Problem Summary

**Users were being deleted from the database automatically after 7 days!**

## Root Cause

The `User` model had a TTL (Time To Live) index on the `refreshTokens.createdAt` field:

```javascript
refreshTokens: [{
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '7d' // ⚠️ THIS WAS THE BUG!
  }
}]
```

### What Went Wrong

MongoDB's TTL index behavior with subdocument arrays is **dangerous**:
- The `expires: '7d'` creates a TTL index on the field
- When a refresh token's `createdAt` date is 7 days old, MongoDB's TTL monitor runs
- **Instead of removing just the expired token from the array, it deletes the ENTIRE user document!**

This is a well-known MongoDB pitfall - TTL indexes on array subdocument fields delete the parent document.

## The Fix

### 1. Removed TTL Index from Schema
- Removed `expires: '7d'` from the `refreshTokens.createdAt` field (line 96 in User.js)
- Added comment explaining the bug

### 2. Implemented Manual Token Cleanup
Added new methods to handle token expiration manually:

```javascript
// Clean expired tokens (7 days old)
userSchema.methods.cleanExpiredTokens = function() {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  this.refreshTokens = this.refreshTokens.filter(rt => {
    const tokenAge = Date.now() - new Date(rt.createdAt).getTime();
    return tokenAge < SEVEN_DAYS_MS;
  });
}
```

Token cleanup now happens:
- When adding a new refresh token
- When finding a user by refresh token
- Expired tokens are filtered out automatically

### 3. Database Migration Required

**⚠️ CRITICAL: Must run migration on production immediately!**

The TTL index still exists in MongoDB until manually dropped:

```bash
cd backend
node scripts/drop-ttl-index.js
```

This script will:
- Connect to MongoDB
- List all indexes on the users collection
- Drop any TTL indexes found
- Verify the cleanup
- Report user count

## Deployment Steps

### For Production (URGENT)

1. **Deploy the updated code:**
   ```bash
   git pull
   npm install
   pm2 restart backend
   ```

2. **Drop the TTL index immediately:**
   ```bash
   cd backend
   NODE_ENV=production node scripts/drop-ttl-index.js
   ```

3. **Verify users are safe:**
   - Check MongoDB for user count
   - Monitor logs for "🧹 Cleaned X expired token(s)" messages
   - Verify no more user deletions occur

### For Development/Staging

Same steps, but the migration script will detect the environment automatically.

## How to Verify the Fix

### Check for TTL Indexes
```bash
# In MongoDB shell or Compass
db.users.getIndexes()
```

Look for any index with `expireAfterSeconds` property - there should be **NONE**.

### Monitor Application Logs
You should see:
- `🧹 Cleaned N expired token(s) for user X` - Normal token cleanup
- No more deletion logs for active users

### Test Token Expiry
1. Create a test user
2. Login and get a refresh token
3. Wait (or manually set createdAt to 8 days ago in DB)
4. Try to use the refresh token
5. Should get "Invalid refresh token" error
6. **User should still exist in database!**

## Prevention

The User model now has extensive protection:
- No TTL indexes on any fields
- Manual token cleanup with logging
- Comprehensive deletion monitoring hooks
- Production safeguards against mass deletion

## References

- [MongoDB TTL Indexes Documentation](https://docs.mongodb.com/manual/core/index-ttl/)
- [Mongoose TTL Index Pitfall](https://github.com/Automattic/mongoose/issues/5656)
- Original fix: Commit [add commit hash here]

## Questions?

If users are still being deleted after this fix:
1. Verify the TTL index was actually dropped (`db.users.getIndexes()`)
2. Check MongoDB logs for TTL monitor activity
3. Restart MongoDB if necessary to clear the TTL monitor cache
4. Contact DevOps team

---

**Last Updated:** 2025-11-18  
**Priority:** CRITICAL  
**Status:** FIXED (pending production deployment)
