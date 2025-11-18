# 🚨 CRITICAL: TTL Index Bug Fix Deployment

## Pre-Deployment Checks

- [ ] Read `backend/TTL_INDEX_FIX.md` for full context
- [ ] Backup MongoDB database before deployment
- [ ] Verify current user count in production
- [ ] Check MongoDB indexes: `db.users.getIndexes()`
- [ ] Confirm at least one admin user exists

## Deployment Steps

### 1. Deploy Code Changes (5 minutes)

```bash
# SSH into production server
cd /path/to/stock_man

# Pull latest changes
git pull origin main

# Install dependencies (if needed)
cd backend
npm install

# Restart backend
pm2 restart backend
# OR: npm start (if not using PM2)
```

### 2. Drop the TTL Index (2 minutes)

**⚠️ CRITICAL STEP - DO NOT SKIP!**

```bash
# From backend directory
npm run drop-ttl-index

# Alternative:
node scripts/drop-ttl-index.js
```

Expected output:
- ✅ Lists current indexes
- 🗑️ Drops TTL index if found
- ✅ Confirms cleanup
- 👥 Shows user count

### 3. Verify the Fix (5 minutes)

#### A. Check MongoDB Indexes
```bash
# In MongoDB shell or Compass
db.users.getIndexes()
```
✅ Should NOT see any index with `expireAfterSeconds` property

#### B. Monitor Application Logs
```bash
# Watch for token cleanup logs
pm2 logs backend --lines 100
# OR: tail -f logs/backend.log
```

Look for:
- `🧹 Cleaned N expired token(s) for user X` - Good!
- No deletion logs for active users - Good!

#### C. Test User Login
1. Login as multiple users
2. Check refresh token behavior
3. Verify users persist after 7+ days

#### D. Check User Count
```javascript
// In MongoDB shell
db.users.countDocuments()
```
✅ Should match pre-deployment count

## Post-Deployment Monitoring

### Day 1-3
- [ ] Monitor logs hourly for unexpected deletions
- [ ] Check user count daily
- [ ] Verify login functionality
- [ ] Test token refresh flow

### Week 1-2
- [ ] Daily check of user count
- [ ] Review logs for token cleanup messages
- [ ] Confirm no user deletion incidents

### Week 3+
- [ ] Weekly user count check
- [ ] Standard monitoring

## Rollback Plan (if needed)

**If users are still being deleted:**

1. Check if TTL index still exists:
   ```javascript
   db.users.getIndexes()
   ```

2. If TTL index exists, drop it manually:
   ```javascript
   db.users.dropIndex("refreshTokens.createdAt_1")
   // Or whichever index name has expireAfterSeconds
   ```

3. Restart MongoDB if necessary:
   ```bash
   sudo systemctl restart mongod
   ```

4. Verify protection is active:
   - Check logs for "🛡️ User model loaded with enhanced protection"

## Success Criteria

✅ TTL index successfully dropped  
✅ No unexpected user deletions  
✅ Token cleanup working (see logs)  
✅ Users can login and refresh tokens  
✅ User count stable over 7+ days  

## Emergency Contacts

- **Issue persists?** Check `backend/TTL_INDEX_FIX.md`
- **MongoDB issues?** Contact database admin
- **Application issues?** Check PM2 logs

---

**Deployed by:** _______________  
**Deployment date:** _______________  
**User count before:** _______________  
**User count after:** _______________  
**TTL index dropped:** ☐ Yes  
**Verified working:** ☐ Yes  
