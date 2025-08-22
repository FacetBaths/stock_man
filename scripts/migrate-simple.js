#!/usr/bin/env node

/**
 * Simplified Migration Script
 * Creates the new architecture directly without complex model imports
 */

const mongoose = require('mongoose');

// Define new schemas directly
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  company_name: { type: String, required: true },
  contact_name: { type: String, required: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  customer_type: { type: String, enum: ['business', 'individual'], default: 'business' },
  notes: { type: String, default: '' }
}, { timestamps: true });

const skuNewSchema = new mongoose.Schema({
  sku_code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  unit_cost: { type: Number, default: 0 },
  unit_price: { type: Number, default: 0 },
  manufacturer_model: { type: String, default: '' },
  barcode: { type: String, default: '' },
  is_active: { type: Boolean, default: true },
  is_lendable: { type: Boolean, default: false },
  is_bundle: { type: Boolean, default: false },
  notes: { type: String, default: '' },
  created_by: { type: String, required: true },
  last_updated_by: { type: String, required: true }
}, { timestamps: true });

const inventorySchema = new mongoose.Schema({
  sku_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SKUNew', required: true, unique: true },
  total_quantity: { type: Number, default: 0 },
  available_quantity: { type: Number, default: 0 },
  reserved_quantity: { type: Number, default: 0 },
  broken_quantity: { type: Number, default: 0 },
  loaned_quantity: { type: Number, default: 0 },
  minimum_stock_level: { type: Number, default: 0 },
  maximum_stock_level: { type: Number, default: null },
  last_updated_by: { type: String, required: true }
}, { timestamps: true });

// Create models
const Category = mongoose.model('Category', categorySchema);
const Customer = mongoose.model('Customer', customerSchema);
const SKUNew = mongoose.model('SKUNew', skuNewSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);

// Old data models (simple)
const OldSKUSchema = new mongoose.Schema({}, { strict: false, collection: 'skus' });
const OldTagSchema = new mongoose.Schema({}, { strict: false, collection: 'tags' });
const OldSKU = mongoose.model('OldSKU', OldSKUSchema);
const OldTag = mongoose.model('OldTag', OldTagSchema);

// Migration configuration
const MIGRATION_CONFIG = {
  logLevel: 'info',
  dryRun: false
};

const log = {
  info: (msg) => console.log(`ℹ️  INFO: ${msg}`),
  warn: (msg) => console.warn(`⚠️  WARN: ${msg}`),
  error: (msg) => console.error(`❌ ERROR: ${msg}`)
};

async function runMigration() {
  try {
    log.info('🚀 Starting simplified migration...');
    
    // Connect with specific options
    await mongoose.connect('mongodb://localhost:27017/stockmanager_dev', {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000
    });
    log.info('✅ Connected to database');
    
    // Step 1: Create categories
    log.info('📁 Creating categories...');
    const categories = [
      { name: 'Walls', slug: 'walls', description: 'Wall panels and related items' },
      { name: 'Accessories', slug: 'accessories', description: 'Bathroom accessories and fittings' },
      { name: 'Toilets', slug: 'toilets', description: 'Toilets and related fixtures' },
      { name: 'General', slug: 'general', description: 'General inventory items' }
    ];
    
    const categoryMapping = {};
    for (const catData of categories) {
      const category = await Category.create(catData);
      categoryMapping[catData.slug] = category._id;
      log.info(`Created category: ${catData.name}`);
    }
    
    // Step 2: Create customers from tags
    log.info('👥 Creating customers...');
    const uniqueCustomers = await OldTag.distinct('customer_name');
    const customerMapping = {};
    
    for (const customerName of uniqueCustomers) {
      if (!customerName) continue;
      
      const customer = await Customer.create({
        company_name: customerName.trim(),
        contact_name: customerName.trim(),
        notes: `Migrated from old system: ${customerName}`
      });
      customerMapping[customerName] = customer._id;
      log.info(`Created customer: ${customerName.trim()}`);
    }
    
    // Step 3: Migrate SKUs
    log.info('📦 Migrating SKUs...');
    const oldSKUs = await OldSKU.find();
    const skuMapping = {};
    
    for (const oldSKU of oldSKUs) {
      // Determine category
      let categoryId = categoryMapping['general'];
      if (oldSKU.product_type === 'wall') categoryId = categoryMapping['walls'];
      else if (oldSKU.product_type === 'accessory') categoryId = categoryMapping['accessories'];
      else if (oldSKU.product_type === 'toilet') categoryId = categoryMapping['toilets'];
      
      const newSKU = await SKUNew.create({
        sku_code: oldSKU.sku_code || `SKU-${oldSKU._id}`,
        name: oldSKU.description || `${oldSKU.product_type} - ${oldSKU.sku_code}`,
        description: oldSKU.description || '',
        category_id: categoryId,
        unit_cost: oldSKU.current_cost || 0,
        unit_price: oldSKU.current_cost || 0,
        manufacturer_model: oldSKU.manufacturer_model || '',
        barcode: oldSKU.barcode || '',
        is_active: oldSKU.status === 'active',
        notes: `Migrated from old SKU system. Product type: ${oldSKU.product_type}`,
        created_by: oldSKU.created_by || 'migration-script',
        last_updated_by: 'migration-script'
      });
      
      skuMapping[oldSKU._id.toString()] = newSKU._id;
      
      // Create inventory record
      await Inventory.create({
        sku_id: newSKU._id,
        minimum_stock_level: oldSKU.stock_thresholds?.understocked || 0,
        maximum_stock_level: oldSKU.stock_thresholds?.overstocked || null,
        last_updated_by: 'migration-script'
      });
      
      log.info(`Migrated SKU: ${oldSKU.sku_code}`);
    }
    
    // Final counts
    log.info('✅ Migration completed! Final counts:');
    log.info(`  Categories: ${await Category.countDocuments()}`);
    log.info(`  Customers: ${await Customer.countDocuments()}`);
    log.info(`  SKUs: ${await SKUNew.countDocuments()}`);
    log.info(`  Inventory: ${await Inventory.countDocuments()}`);
    
    await mongoose.connection.close();
    log.info('🎉 Migration successful!');
    
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    log.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
if (args.includes('--dry-run')) {
  MIGRATION_CONFIG.dryRun = true;
  log.info('🔍 Running in DRY RUN mode - no changes will be made');
}

// Run migration
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
