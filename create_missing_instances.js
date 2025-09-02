#!/usr/bin/env node

/**
 * Create Missing Instances Script
 * 
 * This script creates individual Instance records from existing Inventory quantities
 * to fix the issue where "Total Items" counts are incorrect due to missing instances.
 * 
 * The new architecture requires individual Instance documents for each physical item,
 * but the migration didn't create these from legacy data.
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stock_manager';

// Schema definitions (minimal for script)
const skuSchema = new mongoose.Schema({
  sku_code: String,
  name: String,
  unit_cost: { type: Number, default: 0 },
  status: String,
  category_id: mongoose.Schema.Types.ObjectId
}, { collection: 'skus' });

const inventorySchema = new mongoose.Schema({
  sku_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SKU' },
  total_quantity: { type: Number, default: 0 },
  available_quantity: { type: Number, default: 0 },
  reserved_quantity: { type: Number, default: 0 },
  broken_quantity: { type: Number, default: 0 },
  loaned_quantity: { type: Number, default: 0 },
  average_cost: { type: Number, default: 0 }
}, { collection: 'inventory' });

const instanceSchema = new mongoose.Schema({
  sku_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SKU', required: true },
  acquisition_date: { type: Date, default: Date.now },
  acquisition_cost: { type: Number, default: 0 },
  tag_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', default: null },
  location: { type: String, default: 'HQ' },
  supplier: { type: String, default: '' },
  reference_number: { type: String, default: '' },
  notes: { type: String, default: '' },
  added_by: { type: String, default: 'system' }
}, { 
  collection: 'instances',
  timestamps: true
});

const SKU = mongoose.model('SKU', skuSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);
const Instance = mongoose.model('Instance', instanceSchema);

async function createMissingInstances() {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔗 Connected to MongoDB');
    console.log('🔍 Analyzing current state...\n');

    // Get current counts
    const skuCount = await SKU.countDocuments({ status: 'active' });
    const inventoryCount = await Inventory.countDocuments();
    const existingInstanceCount = await Instance.countDocuments();

    console.log(`📊 Current Database State:`);
    console.log(`   Active SKUs: ${skuCount}`);
    console.log(`   Inventory Records: ${inventoryCount}`);
    console.log(`   Existing Instances: ${existingInstanceCount}`);
    
    if (existingInstanceCount > 0) {
      console.log(`\n⚠️  Found ${existingInstanceCount} existing instances`);
      console.log(`   This script will only create instances for quantities not already represented`);
    }

    // Get all inventory records with SKU data
    const inventoryRecords = await Inventory.find()
      .populate('sku_id', 'sku_code name unit_cost')
      .lean();

    if (inventoryRecords.length === 0) {
      console.log('❌ No inventory records found! Cannot create instances.');
      process.exit(1);
    }

    console.log(`\n🔄 Processing ${inventoryRecords.length} inventory records...\n`);

    let totalInstancesCreated = 0;
    let skusProcessed = 0;
    let errors = 0;

    for (const inventory of inventoryRecords) {
      try {
        if (!inventory.sku_id) {
          console.warn(`⚠️  Inventory record ${inventory._id} has no SKU - skipping`);
          errors++;
          continue;
        }

        const sku = inventory.sku_id;
        const skuId = sku._id;

        // Count existing instances for this SKU
        const existingInstances = await Instance.countDocuments({ sku_id: skuId });
        const totalQuantityNeeded = inventory.total_quantity || 0;
        const instancesNeeded = Math.max(0, totalQuantityNeeded - existingInstances);

        if (instancesNeeded <= 0) {
          console.log(`✅ ${sku.sku_code}: Already has ${existingInstances} instances (needs ${totalQuantityNeeded}) - skipping`);
          skusProcessed++;
          continue;
        }

        console.log(`📦 ${sku.sku_code}: Creating ${instancesNeeded} instances (${existingInstances} exist, ${totalQuantityNeeded} needed)`);

        // Calculate acquisition cost (prefer average_cost, fallback to unit_cost, default to 0)
        const acquisitionCost = inventory.average_cost || sku.unit_cost || 0;

        // Create instances in batches to avoid memory issues
        const batchSize = 100;
        const batches = Math.ceil(instancesNeeded / batchSize);

        for (let batch = 0; batch < batches; batch++) {
          const batchStart = batch * batchSize;
          const batchEnd = Math.min(batchStart + batchSize, instancesNeeded);
          const batchCount = batchEnd - batchStart;

          const instanceBatch = [];
          
          for (let i = 0; i < batchCount; i++) {
            const instanceNumber = batchStart + i + 1;
            
            instanceBatch.push({
              sku_id: skuId,
              acquisition_date: new Date(),
              acquisition_cost: acquisitionCost,
              tag_id: null, // All instances start as available
              location: 'HQ',
              supplier: '',
              reference_number: '',
              notes: `Auto-generated instance ${instanceNumber}/${instancesNeeded} for SKU ${sku.sku_code} during missing instances migration`,
              added_by: 'migration-fix'
            });
          }

          // Insert batch
          await Instance.insertMany(instanceBatch);
          console.log(`    ✅ Batch ${batch + 1}/${batches}: Created ${batchCount} instances`);
        }

        totalInstancesCreated += instancesNeeded;
        skusProcessed++;

      } catch (error) {
        console.error(`❌ Error processing ${inventory.sku_id?.sku_code || inventory._id}:`, error.message);
        errors++;
      }
    }

    // Final verification
    console.log(`\n📊 Migration Summary:`);
    console.log(`   SKUs Processed: ${skusProcessed}`);
    console.log(`   Instances Created: ${totalInstancesCreated}`);
    console.log(`   Errors: ${errors}`);

    if (totalInstancesCreated > 0) {
      const finalInstanceCount = await Instance.countDocuments();
      console.log(`   Total Instances Now: ${finalInstanceCount}`);
      
      // Test the stats calculation
      console.log(`\n🧪 Testing inventory stats calculation...`);
      
      const testStats = await SKU.aggregate([
        { $match: { status: 'active' } },
        {
          $lookup: {
            from: 'categories',
            localField: 'category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            'category.type': { $ne: 'tool' } // Exclude tools
          }
        },
        {
          $lookup: {
            from: 'instances',
            localField: '_id',
            foreignField: 'sku_id',
            as: 'all_instances'
          }
        },
        {
          $group: {
            _id: null,
            total_skus: { $sum: 1 },
            total_quantity: { $sum: { $size: '$all_instances' } }
          }
        }
      ]);

      if (testStats.length > 0) {
        console.log(`   Expected "Total Items": ${testStats[0].total_quantity}`);
        console.log(`   SKUs included: ${testStats[0].total_skus}`);
      }

      console.log(`\n✅ Migration completed successfully!`);
      console.log(`   The "Total Items" count should now be accurate.`);
      console.log(`   Restart your application to see the updated counts.`);
    } else {
      console.log(`\nℹ️  No instances needed to be created. Database was already correct.`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  console.log('🚀 Starting Missing Instances Migration...\n');
  createMissingInstances();
}
