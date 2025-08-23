const { MongoClient, ObjectId } = require('mongodb');

// Configuration
const PROD_CONNECTION = 'mongodb+srv://stockman:uwClxAy6dFHVW42r@cluster0.55teuc.mongodb.net/?retryWrites=true&w=majority';
const PROD_DATABASE = 'test';
const LOCAL_CONNECTION = 'mongodb://localhost:27017';
const LOCAL_DATABASE = 'stockmanager_dev';

async function migrateProductionData() {
  const prodClient = new MongoClient(PROD_CONNECTION);
  const localClient = new MongoClient(LOCAL_CONNECTION);
  
  try {
    // Connect to both databases
    await prodClient.connect();
    await localClient.connect();
    console.log('✅ Connected to both databases');
    
    const prodDB = prodClient.db(PROD_DATABASE);
    const localDB = localClient.db(LOCAL_DATABASE);
    
    // Step 1: Clear existing local data
    console.log('\n🧹 Clearing existing local data...');
    await localDB.collection('categories').drop().catch(() => {}); // Drop and recreate to clear any problematic indexes
    await localDB.collection('skus').deleteMany({});
    await localDB.collection('skunews').deleteMany({});
    await localDB.collection('itemnews').deleteMany({});
    await localDB.collection('inventory').deleteMany({});
    await localDB.collection('tags').deleteMany({});
    await localDB.collection('tagnews').deleteMany({});
    console.log('   Local collections cleared');
    
    // Step 2: Create categories from product types
    console.log('\n📁 Creating categories...');
    const productTypes = [
      { name: 'walls', description: 'Wall panels and components' },
      { name: 'accessories', description: 'Bathroom accessories and fixtures' },
      { name: 'bases', description: 'Shower and tub bases' },
      { name: 'tubs', description: 'Bathtubs and tub components' },
      { name: 'vanities', description: 'Vanities and vanity components' },
      { name: 'toilets', description: 'Toilets and toilet components' },
      { name: 'shower doors', description: 'Shower doors and enclosures' },
      { name: 'raw materials', description: 'Raw materials and supplies' },
      { name: 'miscellaneous', description: 'Other items' }
    ];
    
    const categoryMap = {};
    for (const cat of productTypes) {
      const result = await localDB.collection('categories').insertOne({
        name: cat.name,
        type: 'product',
        description: cat.description,
        attributes: [],
        sort_order: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      categoryMap[cat.name] = result.insertedId;
      console.log(`   Created category: ${cat.name}`);
    }
    
    // Step 3: Migrate SKUs
    console.log('\n🏷️  Migrating SKUs...');
    const prodSKUs = await prodDB.collection('skus').find({}).toArray();
    const skuMap = {};
    
    for (const sku of prodSKUs) {
      // Map product type to category
      const categoryName = sku.product_type === 'shower_door' ? 'shower doors' : 
                          sku.product_type === 'raw_material' ? 'raw materials' : 
                          sku.product_type + 's';
      
      const newSKU = {
        sku_code: sku.sku_code,
        name: sku.sku_code, // Will be updated when we get product details
        description: sku.description || '',
        category_id: categoryMap[categoryName] || categoryMap['miscellaneous'],
        unit_cost: sku.current_cost || 0,
        barcode: sku.barcode || null,
        manufacturer_part_number: sku.manufacturer_model || null,
        specifications: {},
        dimensions: null,
        weight: null,
        color: null,
        finish: null,
        brand: null,
        model: null,
        is_bundle: sku.is_bundle || false,
        bundle_items: sku.bundle_items || [],
        minimum_stock_level: sku.stock_thresholds?.understocked || 0,
        maximum_stock_level: sku.stock_thresholds?.overstocked || null,
        supplier_info: null,
        notes: sku.notes || '',
        is_active: sku.status === 'active',
        created_by: sku.created_by || 'migration',
        last_updated_by: sku.last_updated_by || 'migration',
        createdAt: sku.createdAt || new Date(),
        updatedAt: sku.updatedAt || new Date()
      };
      
      const result = await localDB.collection('skunews').insertOne(newSKU);
      skuMap[sku._id.toString()] = result.insertedId;
      console.log(`   Migrated SKU: ${sku.sku_code}`);
    }
    
    // Step 4: Migrate Items
    console.log('\n📦 Migrating items...');
    const prodItems = await prodDB.collection('items').find({}).toArray();
    
    for (const item of prodItems) {
      // Handle items with quantity > 1 by creating multiple individual items
      const quantity = item.quantity || 1;
      
      for (let i = 0; i < quantity; i++) {
        const newItem = {
          sku_id: item.sku_id ? skuMap[item.sku_id.toString()] : null,
          serial_number: `${item._id.toString()}-${i + 1}`,
          condition: 'good', // Default condition
          status: 'available', // Default status
          location: item.location || 'Warehouse',
          purchase_date: item.createdAt || new Date(),
          purchase_cost: item.cost || 0,
          notes: `Migrated from production. ${item.notes || ''}`.trim(),
          warranty_info: null,
          maintenance_history: [],
          created_by: 'migration',
          last_updated_by: 'migration',
          createdAt: item.createdAt || new Date(),
          updatedAt: item.updatedAt || new Date()
        };
        
        await localDB.collection('itemnews').insertOne(newItem);
      }
      
      console.log(`   Migrated item: ${item.product_type} (${quantity} units)`);
    }
    
    // Step 5: Migrate Tags
    console.log('\n🏷️  Migrating tags...');
    const prodTags = await prodDB.collection('tags').find({}).toArray();
    
    for (const tag of prodTags) {
      const newTag = {
        customer_name: tag.customer_name,
        project_name: tag.project_name || null,
        tag_type: tag.tag_type,
        status: tag.status === 'active' ? 'active' : 'completed',
        due_date: tag.due_date || null,
        notes: tag.notes || '',
        items: [], // Will be populated based on item relationships
        total_estimated_value: 0,
        created_by: tag.created_by || 'migration',
        last_updated_by: 'migration',
        createdAt: tag.createdAt || new Date(),
        updatedAt: tag.updatedAt || new Date()
      };
      
      await localDB.collection('tagnews').insertOne(newTag);
      console.log(`   Migrated tag: ${tag.customer_name} (${tag.tag_type})`);
    }
    
    // Step 6: Create inventory records
    console.log('\n📊 Creating inventory records...');
    const skus = await localDB.collection('skunews').find({}).toArray();
    
    for (const sku of skus) {
      // Count items for this SKU
      const itemCount = await localDB.collection('itemnews').countDocuments({ sku_id: sku._id });
      
      const inventoryRecord = {
        sku_id: sku._id,
        available_quantity: itemCount,
        reserved_quantity: 0,
        broken_quantity: 0,
        loaned_quantity: 0,
        total_quantity: itemCount,
        minimum_stock_level: sku.minimum_stock_level || 0,
        reorder_point: 5,
        maximum_stock_level: sku.maximum_stock_level,
        average_cost: sku.unit_cost || 0,
        total_value: (sku.unit_cost || 0) * itemCount,
        primary_location: 'Warehouse',
        locations: [{
          location_name: 'Warehouse',
          quantity: itemCount
        }],
        last_movement_date: new Date(),
        last_updated_by: 'migration',
        is_active: true,
        is_low_stock: itemCount <= (sku.minimum_stock_level || 5),
        is_out_of_stock: itemCount === 0,
        is_overstock: false,
        movement_history: [{
          type: 'migration',
          quantity: itemCount,
          from_status: null,
          to_status: 'available',
          date: new Date(),
          reason: 'Initial migration from production data',
          updated_by: 'migration'
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await localDB.collection('inventory').insertOne(inventoryRecord);
      console.log(`   Created inventory for: ${sku.sku_code} (${itemCount} items)`);
    }
    
    // Step 7: Generate summary report
    console.log('\n📋 Migration Summary:');
    const categoriesCount = await localDB.collection('categories').countDocuments();
    const skusCount = await localDB.collection('skunews').countDocuments();
    const itemsCount = await localDB.collection('itemnews').countDocuments();
    const inventoryCount = await localDB.collection('inventory').countDocuments();
    const tagsCount = await localDB.collection('tagnews').countDocuments();
    
    console.log(`   ✅ Categories: ${categoriesCount}`);
    console.log(`   ✅ SKUs: ${skusCount}`);
    console.log(`   ✅ Items: ${itemsCount}`);
    console.log(`   ✅ Inventory records: ${inventoryCount}`);
    console.log(`   ✅ Tags: ${tagsCount}`);
    
    // Show inventory totals by category
    const inventorySummary = await localDB.collection('inventory').aggregate([
      {
        $lookup: {
          from: 'skunews',
          localField: 'sku_id',
          foreignField: '_id',
          as: 'sku'
        }
      },
      { $unwind: '$sku' },
      {
        $lookup: {
          from: 'categories',
          localField: 'sku.category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          total_quantity: { $sum: '$total_quantity' },
          total_value: { $sum: '$total_value' }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log('\n📊 Inventory by Category:');
    let grandTotal = 0, grandValue = 0;
    inventorySummary.forEach(cat => {
      console.log(`   ${cat._id}: ${cat.total_quantity} items ($${cat.total_value})`);
      grandTotal += cat.total_quantity;
      grandValue += cat.total_value;
    });
    console.log(`   TOTAL: ${grandTotal} items ($${grandValue})`);
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prodClient.close();
    await localClient.close();
  }
}

// Add command line argument handling
if (process.argv.includes('--confirm')) {
  migrateProductionData();
} else {
  console.log('⚠️  This script will migrate production data to your local database.');
  console.log('   It will CLEAR existing data in the local database.');
  console.log('   Run with --confirm to proceed:');
  console.log('');
  console.log('   node scripts/migrate-production-to-new-schema.js --confirm');
  console.log('');
}
