#!/usr/bin/env node

/**
 * Complete Item Migration Script
 * 
 * This script completes the database migration by:
 * 1. Migrating items from old 'items' collection to new 'itemnews' collection
 * 2. Updating inventory quantities in the 'inventories' collection
 * 3. Ensuring data consistency between old and new structure
 */

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/stockmanager_dev';

mongoose.connect(dbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define schemas for both old and new collections
const oldItemSchema = new mongoose.Schema({}, { collection: 'items', strict: false });
const OldItem = mongoose.model('OldItem', oldItemSchema);

const oldSkuSchema = new mongoose.Schema({}, { collection: 'skus', strict: false });
const OldSku = mongoose.model('OldSku', oldSkuSchema);

const newSkuSchema = new mongoose.Schema({}, { collection: 'skunews', strict: false });
const NewSku = mongoose.model('NewSku', newSkuSchema);

const newItemSchema = new mongoose.Schema({
  sku_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NewSku', required: true },
  serial_number: String,
  condition: { type: String, default: 'good' },
  status: { type: String, default: 'available' },
  location: String,
  purchase_date: Date,
  purchase_cost: Number,
  notes: String,
  created_by: String,
  last_updated_by: String
}, { collection: 'itemnews', timestamps: true });
const NewItem = mongoose.model('NewItem', newItemSchema);

const inventorySchema = new mongoose.Schema({}, { collection: 'inventories', strict: false });
const Inventory = mongoose.model('Inventory', inventorySchema);

async function completeItemMigration() {
  try {
    console.log('🚀 Starting item migration completion...');
    
    // Step 1: Get all old items
    const oldItems = await OldItem.find();
    console.log(`📦 Found ${oldItems.length} items to migrate`);
    
    // Step 2: Create mapping of old SKU IDs to new SKU IDs
    const skuMapping = new Map();
    const oldSkus = await OldSku.find();
    const newSkus = await NewSku.find();
    
    // Create mapping based on SKU codes
    for (const oldSku of oldSkus) {
      for (const newSku of newSkus) {
        if (oldSku.sku_code === newSku.sku_code) {
          skuMapping.set(oldSku._id.toString(), newSku._id);
          console.log(`✅ Mapped SKU: ${oldSku.sku_code} -> ${newSku._id}`);
          break;
        }
      }
    }
    
    console.log(`🔗 Created ${skuMapping.size} SKU mappings`);
    
    // Step 3: Migrate each item
    for (const oldItem of oldItems) {
      try {
        // Find the corresponding new SKU ID
        let newSkuId = null;
        
        if (oldItem.sku_id) {
          newSkuId = skuMapping.get(oldItem.sku_id.toString());
        }
        
        if (!newSkuId) {
          console.warn(`⚠️  Item ${oldItem._id} has no matching new SKU, skipping`);
          continue;
        }
        
        // Create multiple individual items based on quantity
        const quantity = oldItem.quantity || 1;
        
        for (let i = 0; i < quantity; i++) {
          const newItemData = {
            sku_id: newSkuId,
            serial_number: `${oldItem._id}-${i + 1}`,
            condition: 'good',
            status: 'available',
            location: oldItem.location || 'Warehouse',
            purchase_cost: oldItem.cost || 0,
            notes: `Migrated from old item system. Original ID: ${oldItem._id}. Part ${i + 1} of ${quantity}.`,
            created_by: 'migration-script',
            last_updated_by: 'migration-script'
          };
          
          const newItem = await NewItem.create(newItemData);
          console.log(`✅ Created item ${i + 1}/${quantity} for old item ${oldItem._id}`);
        }
        
        // Update inventory quantities
        await updateInventoryQuantities(newSkuId, quantity);
        
        console.log(`📊 Updated inventory for SKU ${newSkuId} (+${quantity})`);
        
      } catch (error) {
        console.error(`❌ Error migrating item ${oldItem._id}:`, error.message);
      }
    }
    
    // Step 4: Validate migration
    await validateMigration();
    
    console.log('🎉 Item migration completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

async function updateInventoryQuantities(skuId, quantityToAdd) {
  try {
    const inventory = await Inventory.findOne({ sku_id: skuId });
    
    if (!inventory) {
      console.warn(`⚠️  No inventory record found for SKU ${skuId}`);
      return;
    }
    
    // Add to available quantity and total quantity
    inventory.available_quantity = (inventory.available_quantity || 0) + quantityToAdd;
    inventory.total_quantity = (inventory.total_quantity || 0) + quantityToAdd;
    inventory.last_updated_by = 'migration-script';
    inventory.updatedAt = new Date();
    
    await inventory.save();
    
  } catch (error) {
    console.error(`❌ Error updating inventory for SKU ${skuId}:`, error.message);
  }
}

async function validateMigration() {
  console.log('\n📊 Validation Results:');
  
  const newItemsCount = await NewItem.countDocuments();
  console.log(`  New items created: ${newItemsCount}`);
  
  const inventories = await Inventory.find();
  let totalInventory = 0;
  
  for (const inventory of inventories) {
    const skuInfo = await NewSku.findById(inventory.sku_id);
    console.log(`  SKU ${skuInfo?.sku_code || inventory.sku_id}: ${inventory.total_quantity} total, ${inventory.available_quantity} available`);
    totalInventory += inventory.total_quantity || 0;
  }
  
  console.log(`  Total inventory quantity: ${totalInventory}`);
  
  // Get original quantities
  const oldItems = await OldItem.find();
  const originalTotal = oldItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  console.log(`  Original total quantity: ${originalTotal}`);
  
  if (totalInventory === originalTotal) {
    console.log('✅ Migration validation passed - quantities match!');
  } else {
    console.log('⚠️  Migration validation warning - quantities do not match');
  }
}

// Run the migration
if (require.main === module) {
  completeItemMigration()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { completeItemMigration };
