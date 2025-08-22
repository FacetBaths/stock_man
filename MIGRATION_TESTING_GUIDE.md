# 🚀 Database Migration Testing Guide

This guide walks you through safely testing the database migration with real production data on your local environment.

## 📋 Prerequisites

- ✅ MongoDB running locally
- ✅ Node.js and npm installed
- ✅ Production database access credentials
- ✅ Backup storage space (~500MB recommended)

## 🛠️ Step-by-Step Migration Testing

### **Phase 1: Setup Local Testing Environment**

#### 1. Backup Production and Setup Local DB

```bash
# Set your production MongoDB URI (replace with your actual connection string)
export MONGO_PRODUCTION_URI="mongodb+srv://username:password@cluster.mongodb.net/stockmanager"

# Run the complete setup process
./scripts/db-backup-restore.sh all
```

This will:
- ✅ Backup your production database
- ✅ Clear your local database
- ✅ Restore production data locally
- ✅ Create a pre-migration snapshot
- ✅ Verify the setup

#### 2. Verify Local Database

Check that you have production data locally:
```bash
mongo stockmanager_dev --eval "
  db.getCollectionNames().forEach(function(collection) {
    var count = db[collection].count();
    print(collection + ': ' + count + ' documents');
  });
"
```

### **Phase 2: Test Migration (Dry Run)**

#### 3. Run Migration in Dry-Run Mode

```bash
# Test migration without making changes
node scripts/migrate-database.js --dry-run --log-level=debug
```

This will:
- ✅ Analyze your existing data structure
- ✅ Show what changes would be made  
- ✅ Identify potential issues
- ✅ **NOT modify any data**

Review the output carefully for:
- Data counts and statistics
- Potential warnings or errors
- Customer parsing results
- SKU categorization logic

### **Phase 3: Run Actual Migration**

#### 4. Run Full Migration

```bash
# Run the actual migration
node scripts/migrate-database.js --log-level=info
```

This will:
- ✅ Create new collections with proper relationships
- ✅ Migrate all data from old schema to new schema
- ✅ Create inventory aggregations
- ✅ Generate audit logs
- ✅ Validate referential integrity

#### 5. Verify Migration Results

Check the results:
```bash
# Check new collections
mongo stockmanager_dev --eval "
  print('=== NEW COLLECTIONS ===');
  ['customers', 'categories', 'skunews', 'itemnews', 'tagnews', 'inventories', 'auditlogs'].forEach(function(collection) {
    try {
      var count = db[collection].count();
      print(collection + ': ' + count + ' documents');
    } catch(e) {
      print(collection + ': NOT FOUND');
    }
  });
"
```

### **Phase 4: Test Application Functionality**

#### 6. Test with New Models

Create a simple test script to verify the new models work:

```javascript
// test-new-models.js
const mongoose = require('mongoose');
const { Customer, SKUNew, ItemNew, TagNew, Inventory } = require('./backend/src/models/newModels');

async function testNewModels() {
  await mongoose.connect('mongodb://localhost:27017/stockmanager_dev');
  
  // Test basic queries
  const customerCount = await Customer.countDocuments();
  const skuCount = await SKUNew.countDocuments();
  const inventoryCount = await Inventory.countDocuments();
  
  console.log(`Customers: ${customerCount}`);
  console.log(`SKUs: ${skuCount}`);
  console.log(`Inventory records: ${inventoryCount}`);
  
  // Test relationships
  const sampleTag = await TagNew.findOne()
    .populate('customer_id')
    .populate({
      path: 'items.item_id',
      populate: { path: 'sku_id' }
    });
  
  if (sampleTag) {
    console.log('Sample tag with relationships:', {
      customer: sampleTag.customer_id?.company_name,
      itemCount: sampleTag.items?.length,
      firstItem: sampleTag.items[0]?.item_id?.sku_id?.name
    });
  }
  
  await mongoose.disconnect();
}

testNewModels().catch(console.error);
```

Run the test:
```bash
node test-new-models.js
```

### **Phase 5: Rollback if Needed**

#### 7. If Migration Has Issues

If you find issues, rollback to the pre-migration state:

```bash
# List available snapshots
./scripts/rollback-migration.sh list

# Rollback to latest snapshot
./scripts/rollback-migration.sh auto

# Or rollback to specific snapshot
./scripts/rollback-migration.sh rollback pre_migration_snapshot_20240122_144530
```

#### 8. Fix Issues and Retry

1. Analyze the migration logs for errors
2. Fix issues in the migration script
3. Restore from snapshot again
4. Re-run migration
5. Repeat until successful

## 🔍 Troubleshooting Common Issues

### **Issue: Customer Parsing Problems**
```bash
# Check customer strings in original data
mongo stockmanager_dev --eval "db.tags.distinct('customer').forEach(printjson)"
```
**Solution**: Update customer parsing logic in `createCustomersFromTags()` function

### **Issue: Missing SKU References**
```bash
# Check for orphaned items
mongo stockmanager_dev --eval "
  db.items.find({sku_id: {$exists: false}}).count()
"
```
**Solution**: Handle orphaned items in migration script

### **Issue: Inventory Calculation Errors**
```bash
# Verify inventory totals
mongo stockmanager_dev --eval "
  db.inventories.find().forEach(function(inv) {
    var total = inv.available_quantity + inv.reserved_quantity + inv.broken_quantity + inv.loaned_quantity;
    if (total !== inv.total_quantity) {
      print('Inventory mismatch for SKU: ' + inv.sku_id);
    }
  })
"
```
**Solution**: Check inventory calculation logic in migration script

## 🎯 Success Criteria

Before deploying to production, verify:

- ✅ **Zero data loss**: All original data accounted for
- ✅ **Referential integrity**: All relationships properly linked  
- ✅ **Inventory accuracy**: Quantities match expected totals
- ✅ **Customer data**: All customers properly parsed and created
- ✅ **Tag functionality**: Tags properly linked to customers and items
- ✅ **Performance**: Queries run efficiently with new schema

## ⚡ Quick Commands Reference

```bash
# Complete setup from scratch
./scripts/db-backup-restore.sh all

# Dry run migration
node scripts/migrate-database.js --dry-run

# Full migration
node scripts/migrate-database.js

# Rollback if needed
./scripts/rollback-migration.sh auto

# Check database status
mongo stockmanager_dev --eval "db.stats()"

# Test new models
node test-new-models.js
```

## 🚨 Important Notes

1. **Always test first**: Never run migration directly on production
2. **Backup everything**: Keep multiple backup copies
3. **Monitor closely**: Watch for errors and warnings during migration
4. **Validate thoroughly**: Test all functionality after migration
5. **Have rollback ready**: Be prepared to rollback if issues arise

## 📞 Next Steps After Successful Testing

Once migration testing is complete and successful:

1. **Update API endpoints** to use new models
2. **Update frontend components** to work with new data structure  
3. **Run tests** on staging environment
4. **Plan production deployment** with maintenance window
5. **Execute production migration** with monitoring

---

**Ready to start?** Run the first command to begin testing:

```bash
./scripts/db-backup-restore.sh all
```
