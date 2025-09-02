#!/usr/bin/env node

/**
 * Fix Production Instance Count
 * 
 * This script fixes the production database where there is 1 instance per SKU
 * instead of 1 instance per physical item quantity.
 * 
 * For example: SKU with quantity=40 should have 40 instances, not 1 instance.
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stock_manager';

// Schema definitions
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

async function fixProductionInstances() {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔗 Connected to MongoDB');
    console.log('🔍 Analyzing production database...\n');

    // Get current counts
    const skuCount = await SKU.countDocuments({ status: 'active' });
    const inventoryCount = await Inventory.countDocuments();
    const existingInstanceCount = await Instance.countDocuments();

    console.log(`📊 Current Production Database State:`);
    console.log(`   Active SKUs: ${skuCount}`);
    console.log(`   Inventory Records: ${inventoryCount}`);
    console.log(`   Current Instances: ${existingInstanceCount}`);

    // Calculate expected total instances from inventory quantities
    const expectedInstancesResult = await Inventory.aggregate([
      {
        $group: {
          _id: null,
          totalExpectedInstances: { $sum: '$total_quantity' }
        }
      }
    ]);

    const expectedInstances = expectedInstancesResult[0]?.totalExpectedInstances || 0;
    console.log(`   Expected Instances: ${expectedInstances}`);
    console.log(`   Missing Instances: ${expectedInstances - existingInstanceCount}\n`);

    if (expectedInstances <= existingInstanceCount) {
      console.log('✅ Instance count appears correct. No fix needed.');
      return;
    }

    // Show SKUs with quantity > 1 that likely need more instances
    console.log('🔍 SKUs with quantities > 1 that may need instance expansion:');
    const highQuantityInventory = await Inventory.find({ total_quantity: { $gt: 1 } })
      .populate('sku_id', 'sku_code name')
      .sort({ total_quantity: -1 })
      .limit(10)
      .lean();

    for (const inv of highQuantityInventory) {
      const instanceCount = await Instance.countDocuments({ sku_id: inv.sku_id._id });
      console.log(`   ${inv.sku_id.sku_code}: quantity=${inv.total_quantity}, instances=${instanceCount}`);
    }

    // Ask for confirmation before proceeding
    console.log(`\n⚠️  This will create ${expectedInstances - existingInstanceCount} additional instances`);
    console.log('📋 The script will:');
    console.log('   1. Keep existing instances unchanged');
    console.log('   2. Create additional instances to match inventory quantities');
    console.log('   3. Preserve all existing data and relationships\n');

    // For safety in production, require manual confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      readline.question('🚨 PRODUCTION FIX: Are you sure you want to proceed? (yes/no): ', resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled by user');
      return;
    }

    console.log('\n🔄 Starting instance expansion...\n');

    // Process each inventory record
    const allInventory = await Inventory.find()
      .populate('sku_id', 'sku_code name unit_cost')
      .lean();

    let totalInstancesCreated = 0;
    let skusProcessed = 0;

    for (const inventory of allInventory) {
      try {
        if (!inventory.sku_id) {
          console.warn(`⚠️  Inventory record ${inventory._id} has no SKU - skipping`);
          continue;
        }

        const sku = inventory.sku_id;
        const skuId = sku._id;
        const totalQuantityNeeded = inventory.total_quantity || 0;

        if (totalQuantityNeeded === 0) {
          console.log(`⏭️  ${sku.sku_code}: Zero quantity - skipping`);
          continue;
        }

        // Count existing instances for this SKU
        const existingInstances = await Instance.countDocuments({ sku_id: skuId });
        const instancesNeeded = Math.max(0, totalQuantityNeeded - existingInstances);

        if (instancesNeeded === 0) {
          console.log(`✅ ${sku.sku_code}: Already correct (${existingInstances}/${totalQuantityNeeded})`);
          skusProcessed++;
          continue;
        }

        console.log(`📦 ${sku.sku_code}: Creating ${instancesNeeded} additional instances (${existingInstances} → ${totalQuantityNeeded})`);

        // Get the existing instance to copy its properties
        const existingInstance = await Instance.findOne({ sku_id: skuId }).lean();
        const acquisitionCost = existingInstance?.acquisition_cost || inventory.average_cost || sku.unit_cost || 0;
        const location = existingInstance?.location || 'HQ';
        const acquisitionDate = existingInstance?.acquisition_date || new Date();

        // Create additional instances in batches
        const batchSize = 50;
        const batches = Math.ceil(instancesNeeded / batchSize);

        for (let batch = 0; batch < batches; batch++) {
          const batchStart = batch * batchSize;
          const batchEnd = Math.min(batchStart + batchSize, instancesNeeded);
          const batchCount = batchEnd - batchStart;

          const instanceBatch = [];
          
          for (let i = 0; i < batchCount; i++) {
            const instanceNumber = existingInstances + batchStart + i + 1;
            
            instanceBatch.push({
              sku_id: skuId,
              acquisition_date: acquisitionDate,
              acquisition_cost: acquisitionCost,
              tag_id: null, // All new instances start as available
              location: location,
              supplier: existingInstance?.supplier || '',
              reference_number: existingInstance?.reference_number || '',
              notes: `Production fix: Instance ${instanceNumber}/${totalQuantityNeeded} for SKU ${sku.sku_code}`,
              added_by: 'production-fix'
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
      }
    }

    // Final verification
    const finalInstanceCount = await Instance.countDocuments();
    console.log(`\n📊 Production Fix Summary:`);
    console.log(`   SKUs Processed: ${skusProcessed}`);
    console.log(`   Instances Created: ${totalInstancesCreated}`);
    console.log(`   Total Instances Now: ${finalInstanceCount}`);
    console.log(`   Expected Total: ${expectedInstances}`);

    // Test the stats calculation
    console.log(`\n🧪 Testing updated inventory stats...`);
    
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
      console.log(`   "Total Items" should now show: ${testStats[0].total_quantity}`);
      console.log(`   Product SKUs included: ${testStats[0].total_skus}`);
    }

    console.log(`\n✅ Production fix completed successfully!`);
    console.log(`   Restart your application to see the correct "Total Items" count.`);

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
  console.log('🚀 Starting Production Instance Fix...\n');
  fixProductionInstances();
}
