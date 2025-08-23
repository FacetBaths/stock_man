const { MongoClient } = require('mongodb');

async function checkCurrentState() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('stockmanager_dev');
    
    console.log('=== CHECKING CURRENT STATE ===');
    
    // Count all collections
    const counts = {
      inventory: await db.collection('inventory').countDocuments(),
      skunews: await db.collection('skunews').countDocuments(),
      itemnews: await db.collection('itemnews').countDocuments(),
      categories: await db.collection('categories').countDocuments()
    };
    
    console.log('Collection counts:', counts);
    
    // Check if inventory has data
    if (counts.inventory > 0) {
      console.log('\n=== INVENTORY SAMPLE ===');
      const inventorySample = await db.collection('inventory').findOne({});
      console.log('Sample inventory record:');
      console.log('- SKU ID:', inventorySample.sku_id);
      console.log('- Total Quantity:', inventorySample.total_quantity);
      console.log('- Available:', inventorySample.available_quantity);
      console.log('- Total Value:', inventorySample.total_value);
      
      // Check inventory totals
      const totals = await db.collection('inventory').aggregate([
        { $group: { _id: null, total_items: { $sum: '$total_quantity' }, total_value: { $sum: '$total_value' } } }
      ]).toArray();
      console.log('\nInventory totals:', totals[0]);
    } else {
      console.log('\n❌ NO INVENTORY RECORDS FOUND');
    }
    
    // Check SKU/inventory relationship
    const skuInventoryCheck = await db.collection('inventory').aggregate([
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
        $project: {
          sku_code: '$sku.sku_code',
          sku_name: '$sku.name',
          category: '$category.name',
          total_quantity: 1,
          total_value: 1
        }
      }
    ]).toArray();
    
    console.log('\n=== SKU/INVENTORY RELATIONSHIPS ===');
    if (skuInventoryCheck.length > 0) {
      skuInventoryCheck.forEach(item => {
        console.log(`${item.sku_code} (${item.category}): ${item.total_quantity} items ($${item.total_value})`);
      });
    } else {
      console.log('❌ No inventory-SKU relationships found');
    }
    
    // Test the exact query the API uses
    console.log('\n=== TESTING API QUERY ===');
    const apiQuery = { is_active: true };
    const apiResult = await db.collection('inventory').aggregate([
      { $match: apiQuery },
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
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ]).toArray();
    
    console.log('API query result count:', apiResult.length);
    if (apiResult.length > 0) {
      console.log('Sample API result:', {
        sku_code: apiResult[0].sku?.sku_code,
        category_name: apiResult[0].category?.name,
        total_quantity: apiResult[0].total_quantity
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkCurrentState();
