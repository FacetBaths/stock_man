# User Deletion Investigation Guide

## Problem Summary
Users are being sporadically deleted from the production database. The pattern observed:
- When a new user is added, other existing users sometimes disappear
- No clear pattern of which users get deleted
- Currently only Sales, Warehouse, and AupShaw remain; Admin was deleted
- Issue has recurred multiple times even after restoring users

## Monitoring Added (Commit: e984b9f)

### What Was Added to User.js

1. **Mongoose Middleware Hooks** (Lines 401-412)
   - `pre('remove')` - Logs before any Mongoose-level user removal
   - `post('remove')` - Logs after Mongoose-level removal
   - Captures username, _id, and full stack trace

2. **Collection-Level Monitoring** (Lines 535-581)
   - Intercepts `collection.deleteOne()`
   - Intercepts `collection.deleteMany()` - **BLOCKS in production**
   - Intercepts `collection.findOneAndDelete()`
   - Logs filter criteria and full stack trace for all attempts

### What This Catches

✅ Direct MongoDB operations via `User.collection.deleteOne()`
✅ Mongoose model deletions via `User.findByIdAndDelete()`
✅ Mass deletions via `User.deleteMany()` (blocked in production)
✅ Legacy `.remove()` calls
✅ Any code path that deletes users will now log loudly with stack traces

## Next Steps

### 1. Deploy to Production
Push the changes to Railway and let the app redeploy with the new monitoring.

### 2. Monitor Railway Logs
When users get deleted next time, you'll see logs like:
```
🚨🚨🚨 DIRECT USER DELETION DETECTED 🚨🚨🚨
Method: collection.deleteOne
Filter: {"_id":"..."}
Stack trace:
  at Function.User.collection.deleteOne (...)
  at [THE ACTUAL CALLER] (...)
🚨🚨🚨 END DELETION LOG 🚨🚨🚨
```

The stack trace will show you **exactly which code is deleting users**.

### 3. Check Railway Logs After Next Deletion
```bash
# View recent logs in Railway dashboard or CLI
railway logs --tail 1000
```

Search for:
- `🚨 USER DELETION`
- `🚨 DIRECT USER DELETION`
- `🚨 MASS USER DELETION`

### 4. Expected Scenarios

**Scenario A: Application Code**
If the stack trace shows a file path like:
```
at /app/backend/src/routes/users.js:639
at /app/backend/src/migration/MigrationOrchestrator.js:847
```
Then you'll know exactly which file and line is causing the deletion.

**Scenario B: No Logs**
If users are deleted but NO logs appear, this means:
- Someone is deleting directly via MongoDB Atlas UI/CLI
- An external script/tool has DB access
- A MongoDB Atlas trigger is running (check Atlas dashboard)

## Possible Root Causes

### 1. Migration Script Running on Deploy ❌
**Status**: Investigated - No evidence found
- No migrations run automatically in Railway deployment
- `npm start` only runs the server
- Migration must be manually triggered

### 2. System Restore "Replace" Mode ❌
**Status**: Investigated - Doesn't delete users
- System restore in "replace" mode deletes: instances, tags, inventory, SKUs, categories
- **Does NOT delete users collection**
- Also blocked in production (line 908 of export.js)

### 3. Unique Index Conflict ❌
**Status**: Investigated - Indexes are correct
- Username and email have proper unique indexes
- No evidence of replacement due to conflicts

### 4. Direct MongoDB Operations ✅
**Status**: Most likely - Now being monitored
- Some code is calling `User.collection.deleteOne()` directly
- Bypasses Mongoose middleware
- **Now being caught and logged**

### 5. MongoDB Atlas Trigger/Webhook 🔍
**Status**: Not yet checked
- Check MongoDB Atlas dashboard for any triggers on users collection
- Check if there are any scheduled operations

### 6. External Access/Security Issue 🔍
**Status**: Needs verification
- Verify who has MongoDB Atlas admin access
- Check Atlas activity logs for suspicious operations
- Review Railway environment variable access

## Files to Watch

Files that have user deletion capabilities:
1. ✅ `backend/src/routes/users.js` - Normal user management (lines 639, 597)
2. ⚠️ `backend/src/migration/MigrationOrchestrator.js` - Deletes all users on line 847
3. ❌ `backend/src/routes/export.js` - System restore (doesn't touch users)

## Security Audit Needed

### Check MongoDB Atlas
1. Go to MongoDB Atlas → Your Cluster → Activity Feed
2. Look for `deleteMany` operations on users collection
3. Check for any Atlas Triggers on the users collection
4. Review who has database access

### Check Railway Environment
1. Verify `NODE_ENV=production` is set
2. Check Railway activity logs for deployments
3. Review who has Railway project access
4. Check for any scheduled tasks/cron jobs

## Temporary Protection

The monitoring code now:
- ✅ **BLOCKS** `User.collection.deleteMany()` in production
- ✅ Logs all deletion attempts with stack traces
- ✅ Makes it impossible to silently delete users

## When It Happens Again

1. **Immediately check Railway logs** for the 🚨 emoji alerts
2. **Screenshot/save the stack trace** from logs
3. **Check MongoDB Atlas Activity Feed** for the timestamp
4. **Document**: What action triggered it (adding a user, login, etc.)
5. **Share the stack trace** to identify the exact code path

## Contact for Results

Once you have stack traces from the logs, you'll know definitively what's deleting users and can fix the root cause.
