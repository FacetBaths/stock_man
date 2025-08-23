const { MongoClient, ObjectId } = require('mongodb');

async function createInventoryRecords() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('stockmanager_dev');
    
    console.log('=== CREATING INVENTORY RECORDS ===');
    
    // Get all SKUs from the correct collection (skunews)
    const skus = await db.collection('skunews').find({}).toArray();
    console.log('Found SKUs in skunews:', skus.length);
    
    // Get all items from itemnews to count quantities by SKU
    const items = await db.collection('itemnews').find({}).toArray();
    console.log('Found items in itemnews:', items.length);
    
    // Group items by SKU to calculate quantities
    const skuQuantities = {};
    items.forEach(item => {
      const skuId = item.sku_id.toString();
      if (!skuQuantities[skuId]) {
        skuQuantities[skuId] = { total: 0, available: 0, reserved: 0, broken: 0, loaned: 0 };
      }
      skuQuantities[skuId].total += 1; // Each item is a single unit
      skuQuantities[skuId].available += 1; // Default all to available
    });
    
    console.log('SKU Quantities calculated:', Object.keys(skuQuantities).length);
    
    // Clear existing inventory records first
    await db.collection('inventory').deleteMany({});
    console.log('Cleared existing inventory records');
    
    // Create inventory records
    const inventoryRecords = [];
    for (const sku of skus) {
      const skuId = sku._id.toString();
      const quantities = skuQuantities[skuId] || { total: 0, available: 0, reserved: 0, broken: 0, loaned: 0 };
      
      const inventoryRecord = {
        sku_id: sku._id,
        available_quantity: quantities.available,
        reserved_quantity: quantities.reserved,
        broken_quantity: quantities.broken,
        loaned_quantity: quantities.loaned,
        total_quantity: quantities.total,
        minimum_stock_level: 0,
        reorder_point: 5,
        maximum_stock_level: null,
        average_cost: sku.current_cost || 0,
        total_value: (sku.current_cost || 0) * quantities.total,
        primary_location: 'Warehouse',
        locations: [{
          location_name: 'Warehouse',
          quantity: quantities.total
        }],
        last_movement_date: new Date(),
        last_updated_by: 'system-migration',
        is_active: true,
        is_low_stock: quantities.total <= 5,
        is_out_of_stock: quantities.total === 0,
        is_overstock: false,
        movement_history: [{
          type: 'migration',
          quantity: quantities.total,
          from_status: null,
          to_status: 'available',
          date: new Date(),
          reason: 'Data migration from legacy system',
          updated_by: 'system-migration'
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      inventoryRecords.push(inventoryRecord);
      
      console.log(`SKU ${sku.sku_code}: ${quantities.total} items (${quantities.available} available)`);
    }
    
    // Insert inventory records
    if (inventoryRecords.length > 0) {
      const result = await db.collection('inventory').insertMany(inventoryRecords);
      console.log('Created inventory records:', result.insertedCount);
    }
    
    console.log('\n=== VERIFICATION ===');
    const inventoryCount = await db.collection('inventory').countDocuments();
    console.log('Total inventory records:', inventoryCount);
    
    // Show summary by SKU
    const inventorySummary = await db.collection('inventory').aggregate([
      {
        $lookup: {
          from: 'skunews',
          localField: 'sku_id',
          foreignField: '_id',
          as: 'sku'
        }
      },
      {
        $unwind: '$sku'
      },
      {
        $project: {
          sku_code: '$sku.sku_code',
          total_quantity: 1,
          available_quantity: 1,
          total_value: 1
        }
      },
      {
        $sort: { sku_code: 1 }
      }
    ]).toArray();
    
    console.log('\n=== INVENTORY SUMMARY ===');
    inventorySummary.forEach(item => {
      console.log(`${item.sku_code}: ${item.total_quantity} items ($${item.total_value})`);  
    });
    
    const totalValue = inventorySummary.reduce((sum, item) => sum + (item.total_value || 0), 0);
    const totalQuantity = inventorySummary.reduce((sum, item) => sum + (item.total_quantity || 0), 0);
    console.log(`\nTOTAL: ${totalQuantity} items worth $${totalValue}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

createInventoryRecords();
