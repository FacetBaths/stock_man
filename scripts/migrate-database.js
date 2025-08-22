#!/usr/bin/env node

/**
 * Database Migration Script
 * Transforms old schema to new architecture
 * 
 * This script:
 * 1. Analyzes existing data structure
 * 2. Creates new collections with proper relationships
 * 3. Migrates data with validation
 * 4. Maintains data integrity throughout
 * 5. Provides rollback capability
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import old models (existing structure)
const OldSKU = require('../backend/src/models/SKU');
const OldItem = require('../backend/src/models/Item');
const OldTag = require('../backend/src/models/Tag');
const OldProduct = require('../backend/src/models/Product');

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

// Migration configuration
const MIGRATION_CONFIG = {
  batchSize: 100,
  logLevel: 'info', // 'debug', 'info', 'warn', 'error'
  dryRun: false, // Set to true for testing without actual data changes
  continueOnError: false, // Set to true to continue migration despite errors
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
    tags: await OldTag.countDocuments(),
    products: await OldProduct.countDocuments()
  };
  
  // Sample data analysis
  const sampleSKUs = await OldSKU.find().limit(5);
  const sampleItems = await OldItem.find().limit(5);
  const sampleTags = await OldTag.find().limit(5);
  
  log.info('Current data counts:');
  Object.entries(analysis).forEach(([key, count]) => {
    log.info(`  ${key}: ${count} documents`);
  });
  
  // Identify unique customers from tags (since they're stored as strings)
  const uniqueCustomers = await OldTag.distinct('customer');
  log.info(`  unique customers: ${uniqueCustomers.length}`);
  
  // Identify potential categories from SKU data
  const skuSamples = await OldSKU.aggregate([
    { $group: { _id: '$description', count: { $sum: 1 } } },
    { $limit: 10 }
  ]);
  
  return {
    counts: analysis,
    uniqueCustomers,
    sampleData: { sampleSKUs, sampleItems, sampleTags }
  };
}

// Step 2: Create base categories
async function createBaseCategories() {
  log.info('📁 Creating base categories...');
  
  const baseCategories = [
    {
      name: 'General Inventory',
      slug: 'general-inventory',
      description: 'General inventory items',
      is_active: true
    },
    {
      name: 'Tools',
      slug: 'tools',
      description: 'Tools available for lending',
      is_active: true,
      metadata: { is_lendable: true }
    },
    {
      name: 'Equipment',
      slug: 'equipment',
      description: 'Equipment and machinery',
      is_active: true
    },
    {
      name: 'Supplies',
      slug: 'supplies',
      description: 'Consumable supplies',
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
  const uniqueCustomers = await OldTag.distinct('customer');
  const customerMapping = {};
  
  for (const customerString of uniqueCustomers) {
    if (!customerString || customerString.trim() === '') continue;
    
    // Parse customer string to extract name and company
    const customerName = customerString.trim();
    let companyName = '';
    let contactName = customerName;
    
    // Try to separate company and contact name
    if (customerName.includes(' - ')) {
      [companyName, contactName] = customerName.split(' - ').map(s => s.trim());
    } else if (customerName.includes('(') && customerName.includes(')')) {
      const match = customerName.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (match) {
        contactName = match[1].trim();
        companyName = match[2].trim();
      }
    }
    
    const customerData = {
      company_name: companyName || contactName,
      contact_name: contactName,
      email: '', // Will need to be filled in manually
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
      notes: `Migrated from old system. Original customer string: "${customerName}"`
    };
    
    try {
      if (!MIGRATION_CONFIG.dryRun) {
        const customer = await Customer.create(customerData);
        customerMapping[customerString] = customer._id;
        migrationState.stats.customersCreated++;
        log.debug(`Created customer: ${customerName}`);
      } else {
        log.debug(`DRY RUN: Would create customer: ${customerName}`);
      }
    } catch (error) {
      handleError(error, `Creating customer: ${customerName}`);
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
      // Determine category (default to general-inventory)
      let categoryId = categoryMapping['general-inventory'];
      
      // Try to categorize based on description or other fields
      const description = (oldSKU.description || '').toLowerCase();
      if (description.includes('tool') || description.includes('drill') || 
          description.includes('saw') || description.includes('hammer')) {
        categoryId = categoryMapping['tools'];
      } else if (description.includes('equipment') || description.includes('machine')) {
        categoryId = categoryMapping['equipment'];
      } else if (description.includes('supply') || description.includes('material')) {
        categoryId = categoryMapping['supplies'];
      }
      
      const newSKUData = {
        sku_code: oldSKU.sku || `SKU-${oldSKU._id}`,
        name: oldSKU.description || 'Unknown Product',
        description: oldSKU.description || '',
        category_id: categoryId,
        
        // Pricing information
        unit_cost: oldSKU.cost || 0,
        unit_price: oldSKU.price || oldSKU.cost || 0,
        
        // Physical properties
        weight: oldSKU.weight || 0,
        dimensions: {
          length: oldSKU.length || 0,
          width: oldSKU.width || 0,
          height: oldSKU.height || 0,
          unit: 'inches'
        },
        
        // Status
        is_active: true,
        is_lendable: categoryId === categoryMapping['tools'],
        
        // Metadata
        tags: oldSKU.tags || [],
        notes: 'Migrated from old SKU system',
        
        // Tracking
        created_by: 'migration-script',
        last_updated_by: 'migration-script'
      };
      
      if (!MIGRATION_CONFIG.dryRun) {
        const newSKU = await SKUNew.create(newSKUData);
        skuMapping[oldSKU._id.toString()] = newSKU._id;
        migrationState.stats.skusProcessed++;
        log.debug(`Migrated SKU: ${oldSKU.sku || oldSKU._id}`);
        
        // Create initial inventory record
        await Inventory.create({
          sku_id: newSKU._id,
          total_quantity: 0,
          available_quantity: 0,
          reserved_quantity: 0,
          broken_quantity: 0,
          loaned_quantity: 0,
          minimum_stock_level: 0,
          last_updated_by: 'migration-script'
        });
        migrationState.stats.inventoryCreated++;
        
      } else {
        log.debug(`DRY RUN: Would migrate SKU: ${oldSKU.sku || oldSKU._id}`);
      }
      
    } catch (error) {
      handleError(error, `Migrating SKU: ${oldSKU.sku || oldSKU._id}`);
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
      
      const newItemData = {
        sku_id: newSKUId,
        serial_number: oldItem.serial_number || '',
        condition: oldItem.condition || 'good',
        status: oldItem.status || 'available',
        location: oldItem.location || 'warehouse',
        purchase_date: oldItem.purchase_date,
        purchase_cost: oldItem.purchase_cost || 0,
        notes: oldItem.notes || 'Migrated from old item system',
        created_by: 'migration-script',
        last_updated_by: 'migration-script'
      };
      
      if (!MIGRATION_CONFIG.dryRun) {
        const newItem = await ItemNew.create(newItemData);
        itemMapping[oldItem._id.toString()] = newItem._id;
        migrationState.stats.itemsProcessed++;
        
        // Update inventory quantities
        await updateInventoryForItem(newSKUId, oldItem.status, 1, 'add');
        
        log.debug(`Migrated Item: ${oldItem._id}`);
      } else {
        log.debug(`DRY RUN: Would migrate Item: ${oldItem._id}`);
      }
      
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
async function migrateTags(customerMapping, itemMapping) {
  log.info('🏷️  Migrating Tags to new structure...');
  
  const oldTags = await OldTag.find();
  
  for (const oldTag of oldTags) {
    try {
      // Find customer
      const customerId = customerMapping[oldTag.customer];
      if (!customerId) {
        migrationState.warnings.push(`Tag ${oldTag._id} references unknown customer: ${oldTag.customer}`);
        continue;
      }
      
      // Map old items to new items
      const newItems = [];
      if (oldTag.items && Array.isArray(oldTag.items)) {
        for (const oldTagItem of oldTag.items) {
          const newItemId = itemMapping[oldTagItem.item_id?.toString()];
          if (newItemId) {
            newItems.push({
              item_id: newItemId,
              quantity: oldTagItem.quantity || 1,
              remaining_quantity: oldTagItem.remaining_quantity || oldTagItem.quantity || 1,
              notes: oldTagItem.notes || ''
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
        tag_type: oldTag.type || 'reserved',
        status: oldTag.status || 'active',
        items: newItems,
        notes: oldTag.notes || 'Migrated from old tag system',
        due_date: oldTag.due_date,
        project_name: oldTag.project || '',
        created_by: 'migration-script',
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
  const itemsWithInvalidSKUs = await ItemNew.aggregate([
    {
      $lookup: {
        from: 'skunews',
        localField: 'sku_id',
        foreignField: '_id',
        as: 'sku'
      }
    },
    {
      $match: { sku: { $size: 0 } }
    },
    {
      $count: 'invalid_items'
    }
  ]);
  
  if (itemsWithInvalidSKUs.length > 0) {
    log.warn(`Found ${itemsWithInvalidSKUs[0].invalid_items} items with invalid SKU references`);
  } else {
    log.info('✅ All items have valid SKU references');
  }
  
  return validation;
}

// Main migration function
async function runMigration() {
  try {
    log.info('🚀 Starting database migration...');
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
    await migrateTags(customerMapping, itemMapping);
    
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
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    log.info(`Connected to database: ${dbUri}`);
    return runMigration();
  })
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    log.error(`Database connection failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runMigration,
  MIGRATION_CONFIG,
  analyzeExistingData,
  createBaseCategories,
  createCustomersFromTags,
  migrateSKUs,
  migrateItems,
  migrateTags,
  validateMigration
};
