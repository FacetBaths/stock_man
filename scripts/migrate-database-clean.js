#!/usr/bin/env node

/**
 * Custom Database Migration Script
 * Tailored for the specific data structure found in this database
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import new models (redesigned structure)
const { 
  Customer, 
  Category, 
  SKUNew, 
  ItemNew, 
  TagNew, 
  Inventory, 
  AuditLog 
} = require('../backend/src/models/newModels');

// Define simplified old models based on actual data structure
const OldSKUSchema = new mongoose.Schema({}, { strict: false, collection: 'skus' });
const OldItemSchema = new mongoose.Schema({}, { strict: false, collection: 'items' });
const OldTagSchema = new mongoose.Schema({}, { strict: false, collection: 'tags' });

const OldSKU = mongoose.model('OldSKU', OldSKUSchema);
const OldItem = mongoose.model('OldItem', OldItemSchema);
const OldTag = mongoose.model('OldTag', OldTagSchema);

// Migration configuration
const MIGRATION_CONFIG = {
  batchSize: 100,
  logLevel: 'info',
  dryRun: false,
  continueOnError: false,
};

// Migration state tracking
let migrationState = {
  startTime: new Date(),
  errors: [],
  warnings: [],
  stats: {
    customersCreated: 0,
    categoriesCreated: 0,
    skusProcessed: 0,
    itemsProcessed: 0,
    tagsProcessed: 0,
    inventoryCreated: 0,
    auditLogsCreated: 0
  }
};

// Utility functions
const log = {
  debug: (msg) => MIGRATION_CONFIG.logLevel === 'debug' && console.log(`🔍 DEBUG: ${msg}`),
  info: (msg) => ['debug', 'info'].includes(MIGRATION_CONFIG.logLevel) && console.log(`ℹ️  INFO: ${msg}`),
  warn: (msg) => ['debug', 'info', 'warn'].includes(MIGRATION_CONFIG.logLevel) && console.warn(`⚠️  WARN: ${msg}`),
  error: (msg) => console.error(`❌ ERROR: ${msg}`)
};

const handleError = (error, context) => {
  const errorInfo = {
    context,
    error: error.message,
    stack: error.stack,
    timestamp: new Date()
  };
  
  migrationState.errors.push(errorInfo);
  log.error(`${context}: ${error.message}`);
  
  if (!MIGRATION_CONFIG.continueOnError) {
    throw error;
  }
};

// Step 1: Analyze existing data
async function analyzeExistingData() {
  log.info('📊 Analyzing existing data structure...');
  
  const analysis = {
    skus: await OldSKU.countDocuments(),
    items: await OldItem.countDocuments(),
    tags: await OldTag.countDocuments()
  };
  
  log.info('Current data counts:');
  Object.entries(analysis).forEach(([key, count]) => {
    log.info(`  ${key}: ${count} documents`);
  });
  
  // Identify unique customers from tags (stored as customer_name)
  const uniqueCustomers = await OldTag.distinct('customer_name');
  log.info(`  unique customers: ${uniqueCustomers.length}`);
  
  return {
    counts: analysis,
    uniqueCustomers
  };
}

// Step 2: Create base categories
async function createBaseCategories() {
  log.info('📁 Creating base categories...');
  
  const baseCategories = [
    {
      name: 'Walls',
      slug: 'walls',
      description: 'Wall panels and related items',
      is_active: true
    },
    {
      name: 'Accessories',
      slug: 'accessories', 
      description: 'Bathroom accessories and fittings',
      is_active: true
    },
    {
      name: 'Toilets',
      slug: 'toilets',
      description: 'Toilets and related fixtures',
      is_active: true
    },
    {
      name: 'General',
      slug: 'general',
      description: 'General inventory items',
      is_active: true
    }
  ];
  
  const createdCategories = {};
  
  for (const categoryData of baseCategories) {
    if (!MIGRATION_CONFIG.dryRun) {
      const category = await Category.create(categoryData);
      createdCategories[categoryData.slug] = category._id;
      migrationState.stats.categoriesCreated++;
      log.debug(`Created category: ${categoryData.name}`);
    } else {
      log.debug(`DRY RUN: Would create category: ${categoryData.name}`);
    }
  }
  
  return createdCategories;
}

// Step 3: Create customers from tag data
async function createCustomersFromTags() {
  log.info('👥 Creating customers from tag data...');
  
  // Get unique customer strings from tags
  const uniqueCustomers = await OldTag.distinct('customer_name');
  const customerMapping = {};
  
  for (const customerName of uniqueCustomers) {
    if (!customerName || customerName.trim() === '') continue;
    
    const cleanName = customerName.trim();
    
    const customerData = {
      company_name: cleanName,
      contact_name: cleanName,
      email: '',
      phone: '',
      status: 'active',
      customer_type: 'business',
      billing_address: {
        street: '',
        city: '',
        state: '',
        zip: '',
        country: 'USA'
      },
      shipping_address: {
        street: '',
        city: '',
        state: '',
        zip: '',
        country: 'USA'
      },
      notes: `Migrated from old system. Original name: "${customerName}"`
    };
    
    try {
      if (!MIGRATION_CONFIG.dryRun) {
        const customer = await Customer.create(customerData);
        customerMapping[customerName] = customer._id;
        migrationState.stats.customersCreated++;
        log.debug(`Created customer: ${cleanName}`);
      } else {
        log.debug(`DRY RUN: Would create customer: ${cleanName}`);
      }
    } catch (error) {
      handleError(error, `Creating customer: ${cleanName}`);
    }
  }
  
  return customerMapping;
}

// Step 4: Migrate SKUs to new structure
async function migrateSKUs(categoryMapping) {
  log.info('📦 Migrating SKUs to new structure...');
  
  const skuMapping = {};
  const oldSKUs = await OldSKU.find();
  
  for (const oldSKU of oldSKUs) {
    try {
      // Determine category based on product_type
      let categoryId = categoryMapping['general'];
      
      if (oldSKU.product_type === 'wall') {
        categoryId = categoryMapping['walls'];
      } else if (oldSKU.product_type === 'accessory') {
        categoryId = categoryMapping['accessories'];
      } else if (oldSKU.product_type === 'toilet') {
        categoryId = categoryMapping['toilets'];
      }
      
      const newSKUData = {
        sku_code: oldSKU.sku_code || `SKU-${oldSKU._id}`,
        name: oldSKU.description || `${oldSKU.product_type} - ${oldSKU.sku_code}` || 'Unknown Product',
        description: oldSKU.description || oldSKU.notes || '',
        category_id: categoryId,
        
        // Pricing information
        unit_cost: oldSKU.current_cost || 0,
        unit_price: oldSKU.current_cost || 0,
        
        // Product details
        manufacturer_model: oldSKU.manufacturer_model || '',
        barcode: oldSKU.barcode || '',
        
        // Status
        is_active: oldSKU.status === 'active',
        is_lendable: false,
        
        // Bundle info
        is_bundle: oldSKU.is_bundle || false,
        
        // Metadata
        notes: `Migrated from old SKU system. Original product_type: ${oldSKU.product_type}`,
        
        // Tracking
        created_by: oldSKU.created_by || 'migration-script',
        last_updated_by: oldSKU.last_updated_by || 'migration-script'
      };
      
      if (!MIGRATION_CONFIG.dryRun) {
        const newSKU = await SKUNew.create(newSKUData);
        skuMapping[oldSKU._id.toString()] = newSKU._id;
        migrationState.stats.skusProcessed++;
        
        // Create initial inventory record
        await Inventory.create({
          sku_id: newSKU._id,
          total_quantity: 0,
          available_quantity: 0,
          reserved_quantity: 0,
          broken_quantity: 0,
          loaned_quantity: 0,
          minimum_stock_level: oldSKU.stock_thresholds?.understocked || 0,
          maximum_stock_level: oldSKU.stock_thresholds?.overstocked || null,
          last_updated_by: 'migration-script'
        });
        migrationState.stats.inventoryCreated++;
        
        log.debug(`Migrated SKU: ${oldSKU.sku_code}`);
      } else {
        log.debug(`DRY RUN: Would migrate SKU: ${oldSKU.sku_code}`);
      }
      
    } catch (error) {
      handleError(error, `Migrating SKU: ${oldSKU.sku_code || oldSKU._id}`);
    }
  }
  
  return skuMapping;
}

// Step 5: Migrate Items to new structure
async function migrateItems(skuMapping) {
  log.info('🏷️  Migrating Items to new structure...');
  
  const itemMapping = {};
  const oldItems = await OldItem.find();
  
  for (const oldItem of oldItems) {
    try {
      // Find the corresponding new SKU
      const newSKUId = skuMapping[oldItem.sku_id?.toString()];
      if (!newSKUId) {
        migrationState.warnings.push(`Item ${oldItem._id} references non-existent SKU ${oldItem.sku_id}`);
        continue;
      }
      
      // Create multiple items based on quantity (if quantity > 1)
      const itemQuantity = oldItem.quantity || 1;
      
      for (let i = 0; i < itemQuantity; i++) {
        const newItemData = {
          sku_id: newSKUId,
          serial_number: '',
          condition: 'good',
          status: 'available',
          location: oldItem.location || 'warehouse',
          purchase_cost: oldItem.cost || 0,
          notes: `Migrated from old item system. Item ${i + 1} of ${itemQuantity}. Original notes: ${oldItem.notes || ''}`,
          created_by: 'migration-script',
          last_updated_by: 'migration-script'
        };
        
        if (!MIGRATION_CONFIG.dryRun) {
          const newItem = await ItemNew.create(newItemData);
          itemMapping[`${oldItem._id.toString()}-${i}`] = newItem._id;
          
          // Update inventory quantities
          await updateInventoryForItem(newSKUId, 'available', 1, 'add');
          
          migrationState.stats.itemsProcessed++;
        } else {
          log.debug(`DRY RUN: Would migrate Item ${i + 1}/${itemQuantity} from: ${oldItem._id}`);
        }
      }
      
      log.debug(`Migrated Item: ${oldItem._id} (${itemQuantity} units)`);
      
    } catch (error) {
      handleError(error, `Migrating Item: ${oldItem._id}`);
    }
  }
  
  return itemMapping;
}

// Helper function to update inventory quantities
async function updateInventoryForItem(skuId, status, quantity, operation = 'add') {
  try {
    const inventory = await Inventory.findOne({ sku_id: skuId });
    if (!inventory) return;
    
    const multiplier = operation === 'add' ? 1 : -1;
    const updateQuantity = quantity * multiplier;
    
    switch (status) {
      case 'available':
        inventory.available_quantity += updateQuantity;
        break;
      case 'reserved':
        inventory.reserved_quantity += updateQuantity;
        break;
      case 'broken':
        inventory.broken_quantity += updateQuantity;
        break;
      case 'loaned':
        inventory.loaned_quantity += updateQuantity;
        break;
      default:
        inventory.available_quantity += updateQuantity;
    }
    
    await inventory.save();
  } catch (error) {
    handleError(error, `Updating inventory for SKU: ${skuId}`);
  }
}

// Step 6: Migrate Tags to new structure
async function migrateTags(customerMapping, skuMapping) {
  log.info('🏷️  Migrating Tags to new structure...');
  
  const oldTags = await OldTag.find();
  
  for (const oldTag of oldTags) {
    try {
      // Find customer
      const customerId = customerMapping[oldTag.customer_name];
      if (!customerId) {
        migrationState.warnings.push(`Tag ${oldTag._id} references unknown customer: ${oldTag.customer_name}`);
        continue;
      }
      
      // Map old sku_items to new items
      const newItems = [];
      if (oldTag.sku_items && Array.isArray(oldTag.sku_items)) {
        for (const oldSkuItem of oldTag.sku_items) {
          const newSKUId = skuMapping[oldSkuItem.sku_id?.toString()];
          if (!newSKUId) {
            migrationState.warnings.push(`Tag ${oldTag._id} references unknown SKU ${oldSkuItem.sku_id}`);
            continue;
          }
          
          // Find items for this SKU to reference
          const items = await ItemNew.find({ sku_id: newSKUId }).limit(oldSkuItem.quantity || 1);
          
          for (const item of items) {
            newItems.push({
              item_id: item._id,
              quantity: 1, // Each item record represents 1 unit
              remaining_quantity: oldSkuItem.remaining_quantity > 0 ? 1 : 0,
              notes: ''
            });
          }
        }
      }
      
      if (newItems.length === 0) {
        migrationState.warnings.push(`Tag ${oldTag._id} has no valid items`);
        continue;
      }
      
      const newTagData = {
        customer_id: customerId,
        tag_type: oldTag.tag_type === 'stock' ? 'reserved' : oldTag.tag_type || 'reserved',
        status: oldTag.status || 'active',
        items: newItems,
        notes: oldTag.notes || 'Migrated from old tag system',
        due_date: oldTag.due_date,
        project_name: '',
        created_by: oldTag.created_by || 'migration-script',
        last_updated_by: 'migration-script'
      };
      
      if (!MIGRATION_CONFIG.dryRun) {
        const newTag = await TagNew.create(newTagData);
        migrationState.stats.tagsProcessed++;
        
        // Log the tag creation
        await AuditLog.logTagEvent({
          event_type: 'tag_created',
          tag_id: newTag._id,
          customer_id: customerId,
          user_id: 'migration-script',
          user_name: 'Migration Script',
          tag_type: newTag.tag_type,
          items_count: newItems.length,
          total_quantity: newItems.reduce((sum, item) => sum + item.quantity, 0),
          reason: 'Data migration from old system'
        });
        migrationState.stats.auditLogsCreated++;
        
        log.debug(`Migrated Tag: ${oldTag._id}`);
      } else {
        log.debug(`DRY RUN: Would migrate Tag: ${oldTag._id}`);
      }
      
    } catch (error) {
      handleError(error, `Migrating Tag: ${oldTag._id}`);
    }
  }
}

// Step 7: Create migration audit log
async function createMigrationAuditLog() {
  if (!MIGRATION_CONFIG.dryRun) {
    await AuditLog.logSystemEvent({
      event_type: 'migration_completed',
      user_id: 'migration-script',
      user_name: 'Migration Script',
      action: 'Database schema migration',
      description: `Completed migration from old schema to new architecture. Stats: ${JSON.stringify(migrationState.stats)}`,
      metadata: {
        duration_ms: Date.now() - migrationState.startTime.getTime(),
        errors_count: migrationState.errors.length,
        warnings_count: migrationState.warnings.length,
        stats: migrationState.stats
      },
      severity: 'medium'
    });
    migrationState.stats.auditLogsCreated++;
  }
}

// Step 8: Validate migration results
async function validateMigration() {
  log.info('✅ Validating migration results...');
  
  const validation = {
    customers: await Customer.countDocuments(),
    categories: await Category.countDocuments(),
    skus: await SKUNew.countDocuments(),
    items: await ItemNew.countDocuments(),
    tags: await TagNew.countDocuments(),
    inventory: await Inventory.countDocuments(),
    auditLogs: await AuditLog.countDocuments()
  };
  
  log.info('New data counts:');
  Object.entries(validation).forEach(([key, count]) => {
    log.info(`  ${key}: ${count} documents`);
  });
  
  // Validate referential integrity
  log.info('🔗 Checking referential integrity...');
  
  // Check that all items reference valid SKUs
  const itemsWithValidSKUs = await ItemNew.aggregate([
    {
      $lookup: {
        from: 'skunews',
        localField: 'sku_id',
        foreignField: '_id',
        as: 'sku'
      }
    },
    {
      $match: { sku: { $ne: [] } }
    },
    {
      $count: 'valid_items'
    }
  ]);
  
  const totalItems = await ItemNew.countDocuments();
  const validItems = itemsWithValidSKUs.length > 0 ? itemsWithValidSKUs[0].valid_items : 0;
  
  if (validItems === totalItems) {
    log.info('✅ All items have valid SKU references');
  } else {
    log.warn(`${totalItems - validItems} items have invalid SKU references`);
  }
  
  return validation;
}

// Main migration function
async function runMigration() {
  try {
    log.info('🚀 Starting custom database migration...');
    log.info(`Configuration: ${JSON.stringify(MIGRATION_CONFIG, null, 2)}`);
    
    // Step 1: Analyze existing data
    const analysis = await analyzeExistingData();
    
    // Step 2: Create base categories
    const categoryMapping = await createBaseCategories();
    
    // Step 3: Create customers from tag data
    const customerMapping = await createCustomersFromTags();
    
    // Step 4: Migrate SKUs
    const skuMapping = await migrateSKUs(categoryMapping);
    
    // Step 5: Migrate Items
    const itemMapping = await migrateItems(skuMapping);
    
    // Step 6: Migrate Tags
    await migrateTags(customerMapping, skuMapping);
    
    // Step 7: Create audit log
    await createMigrationAuditLog();
    
    // Step 8: Validate results
    const validation = await validateMigration();
    
    // Final report
    const duration = Date.now() - migrationState.startTime.getTime();
    log.info(`\n🎉 Migration completed in ${duration}ms`);
    log.info('📊 Final Statistics:');
    Object.entries(migrationState.stats).forEach(([key, value]) => {
      log.info(`  ${key}: ${value}`);
    });
    
    if (migrationState.errors.length > 0) {
      log.error(`❌ ${migrationState.errors.length} errors occurred during migration`);
      migrationState.errors.forEach(error => {
        log.error(`  ${error.context}: ${error.error}`);
      });
    }
    
    if (migrationState.warnings.length > 0) {
      log.warn(`⚠️  ${migrationState.warnings.length} warnings occurred during migration`);
      migrationState.warnings.forEach(warning => {
        log.warn(`  ${warning}`);
      });
    }
    
    log.info('✅ Migration process complete!');
    
  } catch (error) {
    log.error(`💥 Migration failed: ${error.message}`);
    log.error(error.stack);
    process.exit(1);
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  args.forEach(arg => {
    if (arg === '--dry-run') {
      MIGRATION_CONFIG.dryRun = true;
    } else if (arg === '--continue-on-error') {
      MIGRATION_CONFIG.continueOnError = true;
    } else if (arg.startsWith('--log-level=')) {
      MIGRATION_CONFIG.logLevel = arg.split('=')[1];
    }
  });
  
  // Connect to database and run migration
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/stockmanager_dev';
  
  mongoose.connect(dbUri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    serverApi: undefined
  })
  .then(() => {
    log.info(`Connected to database: ${dbUri}`);
    // Wait a moment for connection to stabilize
    return new Promise(resolve => setTimeout(resolve, 1000));
  })
  .then(() => {
    return runMigration();
  })
  .then(() => {
    mongoose.connection.close();
    process.exit(0);
  })
  .catch(error => {
    log.error(`Database connection failed: ${error.message}`);
    mongoose.connection.close();
    process.exit(1);
  });
}

module.exports = {
  runMigration,
  MIGRATION_CONFIG
};
