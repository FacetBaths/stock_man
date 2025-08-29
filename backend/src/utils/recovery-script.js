#!/usr/bin/env node

/**
 * Recovery Script for Missing Migration Data
 * 
 * This script addresses the issue where 50 items in inventory exist 
 * but only 3 instances were created during migration.
 * 
 * It will:
 * 1. Check if "UNASSIGNED" SKU exists
 * 2. Create it if missing
 * 3. Identify orphaned inventory records without proper instances
 * 4. Create placeholder instances for missing inventory
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

class RecoveryTool {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;
    this.client = null;
    this.db = null;
  }

  async connect() {
    console.log('🔌 Connecting to MongoDB...');
    this.client = new MongoClient(this.mongoUri);
    await this.client.connect();
    this.db = this.client.db();
    console.log('✅ Connected to MongoDB');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  async analyzeCurrentState() {
    console.log('\n📊 Analyzing current database state...');
    
    // Count collections
    const categoriesCount = await this.db.collection('categories').countDocuments();
    const skusCount = await this.db.collection('skus').countDocuments();
    const instancesCount = await this.db.collection('instances').countDocuments();
    const inventoryCount = await this.db.collection('inventory').countDocuments();
    
    console.log(`Categories: ${categoriesCount}`);
    console.log(`SKUs: ${skusCount}`);
    console.log(`Instances: ${instancesCount}`);
    console.log(`Inventory Records: ${inventoryCount}`);

    // Check if UNASSIGNED SKU exists
    const unassignedSKU = await this.db.collection('skus').findOne({ sku_code: 'UNASSIGNED' });
    console.log(`UNASSIGNED SKU exists: ${unassignedSKU ? '✅' : '❌'}`);

    return {
      categoriesCount,
      skusCount,
      instancesCount,
      inventoryCount,
      hasUnassignedSKU: !!unassignedSKU,
      unassignedSKU
    };
  }

  async createUnassignedSKU() {
    console.log('\n🏗️ Creating UNASSIGNED SKU...');

    // Find or create miscellaneous category
    let miscCategory = await this.db.collection('categories').findOne({ name: 'miscellaneous' });
    
    if (!miscCategory) {
      miscCategory = {
        _id: new ObjectId(),
        name: 'miscellaneous',
        type: 'product',
        description: 'Miscellaneous items and unassigned products',
        attributes: [],
        sort_order: 999,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.db.collection('categories').insertOne(miscCategory);
      console.log('📋 Created miscellaneous category');
    }

    // Create UNASSIGNED SKU
    const unassignedSKU = {
      _id: new ObjectId(),
      sku_code: 'UNASSIGNED',
      category_id: miscCategory._id,
      name: 'Unassigned Items',
      description: 'Temporary SKU for items that do not have an assigned SKU. These items should be reviewed and reassigned to appropriate SKUs.',
      brand: '',
      model: '',
      details: {
        product_type: 'unassigned',
        migration_notes: 'This is a temporary SKU created during recovery for items without proper SKU assignments'
      },
      unit_cost: 0,
      currency: 'USD',
      cost_history: [{
        cost: 0,
        effective_date: new Date(),
        updated_by: 'recovery-script',
        notes: 'Initial cost for unassigned items SKU',
        createdAt: new Date(),
        updatedAt: new Date()
      }],
      status: 'active',
      barcode: '',
      supplier_info: {
        supplier_name: '',
        supplier_sku: '',
        lead_time_days: 0
      },
      images: [],
      stock_thresholds: {
        understocked: 0,
        overstocked: 999999
      },
      is_bundle: false,
      bundle_items: [],
      created_by: 'recovery-script',
      last_updated_by: 'recovery-script',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('skus').insertOne(unassignedSKU);
    console.log(`✅ Created UNASSIGNED SKU with ID: ${unassignedSKU._id}`);
    
    return unassignedSKU;
  }

  async findMissingInstances() {
    console.log('\n🔍 Finding inventory records without sufficient instances...');
    
    const inventory = await this.db.collection('inventory').find({}).toArray();
    const missingInstances = [];
    
    for (const inv of inventory) {
      // Count actual instances for this SKU
      const instancesCount = await this.db.collection('instances').countDocuments({ 
        sku_id: inv.sku_id 
      });
      
      const expectedQuantity = inv.total_quantity;
      
      if (instancesCount < expectedQuantity) {
        const missing = expectedQuantity - instancesCount;
        console.log(`❌ SKU ${inv.sku_id}: Expected ${expectedQuantity}, found ${instancesCount}, missing ${missing}`);
        
        // Get SKU details for this inventory
        const sku = await this.db.collection('skus').findOne({ _id: inv.sku_id });
        
        missingInstances.push({
          inventory: inv,
          sku: sku,
          missingCount: missing,
          existingCount: instancesCount
        });
      } else {
        console.log(`✅ SKU ${inv.sku_id}: ${instancesCount}/${expectedQuantity} instances`);
      }
    }
    
    console.log(`\nFound ${missingInstances.length} inventory records with missing instances`);
    return missingInstances;
  }

  async createMissingInstances(missingInstances, unassignedSKU) {
    console.log('\n🔧 Creating missing instances...');
    
    let totalCreated = 0;
    
    for (const missing of missingInstances) {
      const { inventory, sku, missingCount } = missing;
      
      console.log(`Creating ${missingCount} instances for SKU: ${sku?.sku_code || 'Unknown'}`);
      
      const instancesToCreate = [];
      
      for (let i = 0; i < missingCount; i++) {
        const instance = {
          sku_id: inventory.sku_id,
          acquisition_date: new Date(),
          acquisition_cost: inventory.average_cost || 0,
          tag_id: null, // Available
          location: 'Recovery - Location Unknown',
          supplier: '',
          reference_number: '',
          notes: `Recovery instance ${i + 1}/${missingCount}. Created by recovery script to match inventory count. Original data may have been lost during migration.`,
          added_by: 'recovery-script',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        instancesToCreate.push(instance);
      }
      
      if (instancesToCreate.length > 0) {
        await this.db.collection('instances').insertMany(instancesToCreate);
        totalCreated += instancesToCreate.length;
        console.log(`✅ Created ${instancesToCreate.length} instances for ${sku?.sku_code || 'Unknown SKU'}`);
      }
    }
    
    console.log(`\n🎉 Created ${totalCreated} missing instances total`);
    return totalCreated;
  }

  async fixInventoryCalculations() {
    console.log('\n🔄 Recalculating inventory aggregations...');
    
    const skus = await this.db.collection('skus').find({}).toArray();
    let updated = 0;
    
    for (const sku of skus) {
      // Count instances for this SKU
      const instances = await this.db.collection('instances').find({ sku_id: sku._id }).toArray();
      
      // Calculate aggregations
      const totalQuantity = instances.length;
      const availableQuantity = instances.filter(inst => inst.tag_id === null).length;
      
      // Calculate total value and average cost
      const totalValue = instances.reduce((sum, inst) => sum + (inst.acquisition_cost || 0), 0);
      const averageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;
      
      // Update or create inventory record
      const inventoryUpdate = {
        sku_id: sku._id,
        total_quantity: totalQuantity,
        available_quantity: availableQuantity,
        reserved_quantity: 0, // Will be calculated from tags later
        broken_quantity: 0,
        loaned_quantity: 0,
        total_value: totalValue,
        average_cost: averageCost,
        minimum_stock_level: sku.stock_thresholds?.understocked || 5,
        reorder_point: sku.stock_thresholds?.understocked || 5,
        maximum_stock_level: sku.stock_thresholds?.overstocked || 50,
        is_low_stock: totalQuantity <= (sku.stock_thresholds?.understocked || 5),
        is_out_of_stock: totalQuantity === 0,
        is_overstock: totalQuantity >= (sku.stock_thresholds?.overstocked || 50),
        last_updated_by: 'recovery-script',
        last_movement_date: new Date().toISOString(),
        updatedAt: new Date()
      };
      
      await this.db.collection('inventory').updateOne(
        { sku_id: sku._id },
        { 
          $set: inventoryUpdate,
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      
      updated++;
    }
    
    console.log(`✅ Updated ${updated} inventory calculations`);
  }

  async runRecovery() {
    try {
      await this.connect();
      
      console.log('🚀 Starting Data Recovery Process');
      console.log('==================================');
      
      // Stage 1: Analyze current state
      const currentState = await this.analyzeCurrentState();
      
      // Stage 2: Create UNASSIGNED SKU if missing
      let unassignedSKU = currentState.unassignedSKU;
      if (!currentState.hasUnassignedSKU) {
        unassignedSKU = await this.createUnassignedSKU();
      } else {
        console.log('\n✅ UNASSIGNED SKU already exists');
      }
      
      // Stage 3: Find missing instances
      const missingInstances = await this.findMissingInstances();
      
      // Stage 4: Create missing instances
      if (missingInstances.length > 0) {
        await this.createMissingInstances(missingInstances, unassignedSKU);
      }
      
      // Stage 5: Fix inventory calculations
      await this.fixInventoryCalculations();
      
      // Stage 6: Final analysis
      console.log('\n📊 Final Analysis:');
      await this.analyzeCurrentState();
      
      console.log('\n🎉 Recovery process completed!');
      
    } catch (error) {
      console.error('❌ Recovery failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run recovery if called directly
if (require.main === module) {
  const recovery = new RecoveryTool();
  recovery.runRecovery().catch(console.error);
}

module.exports = RecoveryTool;
