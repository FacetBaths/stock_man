# TTL Index Bug Fix - Quick Reference

## 🚨 The Problem
Users were being **automatically deleted from the database after 7 days** due to a MongoDB TTL (Time To Live) index misconfiguration.

## 🔍 Root Cause
The `refreshTokens.createdAt` field in the User model had `expires: '7d'`, which created a TTL index. When refresh tokens expired, MongoDB deleted **the entire user document** instead of just removing the expired token from the array.

This is a known MongoDB pitfall with TTL indexes on array subdocument fields.

## ✅ The Solution

### 1. Code Changes
- **Removed** TTL index from User schema (`backend/src/models/User.js`)
- **Added** manual token cleanup methods
- **Implemented** automatic cleanup on token operations

### 2. Database Migration
**Must run this on production immediately:**
```bash
cd backend
npm run drop-ttl-index
```

## 📁 Files Modified/Created

### Modified Files
- `backend/src/models/User.js` - Removed TTL, added cleanup methods
- `backend/package.json` - Added migration script

### New Files
- `backend/scripts/drop-ttl-index.js` - Migration script to drop TTL index
- `backend/TTL_INDEX_FIX.md` - Detailed technical documentation
- `backend/test/user-token-cleanup.test.js` - Tests for token cleanup
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment guide
- `TTL_FIX_README.md` - This file

## 🚀 Quick Deploy (Production)

```bash
# 1. Deploy code
git pull && cd backend && npm install && pm2 restart backend

# 2. Drop TTL index (CRITICAL!)
npm run drop-ttl-index

# 3. Verify
# Check that no TTL indexes exist on users collection
```

## 🧪 Testing Locally

```bash
# Run the new test suite
cd backend
npm test -- user-token-cleanup.test.js
```

## 📊 How to Verify It's Working

### Good Signs ✅
- Log messages: `🧹 Cleaned N expired token(s) for user X`
- Users persist beyond 7 days
- No TTL indexes in `db.users.getIndexes()`
- Token refresh works correctly

### Bad Signs ⚠️
- Users disappearing after 7 days
- TTL index still exists in MongoDB
- No cleanup log messages

## 📚 Documentation

- **Full details:** `backend/TTL_INDEX_FIX.md`
- **Deployment:** `DEPLOYMENT_CHECKLIST.md`
- **Tests:** `backend/test/user-token-cleanup.test.js`

## 🔐 Security Note

The fix maintains the same security behavior:
- Refresh tokens still expire after 7 days
- Expired tokens are automatically cleaned up
- User documents are **never** deleted automatically
- All existing deletion protections remain in place

## ❓ FAQ

**Q: Will this affect existing users?**  
A: No, all existing users are safe once the TTL index is dropped.

**Q: Do users need to re-login?**  
A: No, existing sessions continue to work normally.

**Q: What about expired tokens?**  
A: They're cleaned automatically during token operations - no manual intervention needed.

**Q: Can I skip the migration script?**  
A: **NO!** The TTL index persists in MongoDB until explicitly dropped. Without running the migration, users will continue to be deleted!

## 🆘 If Problems Persist

1. Verify TTL index was dropped: `db.users.getIndexes()`
2. Check MongoDB logs for TTL monitor activity
3. Restart MongoDB if necessary: `sudo systemctl restart mongod`
4. Review logs for user deletion events
5. See `backend/TTL_INDEX_FIX.md` for troubleshooting

---

**Priority:** 🚨 CRITICAL  
**Status:** Ready for deployment  
**Impact:** Prevents automatic user deletion  
**Downtime Required:** None  
