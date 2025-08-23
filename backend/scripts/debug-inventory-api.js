const { MongoClient } = require('mongodb');

async function debugInventoryAPI() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('stockmanager_dev');
    
    console.log('=== DEBUGGING INVENTORY API QUERIES ===');
    
    // Step 1: Check raw inventory count
    console.log('\n1. Raw inventory collection:');
    const rawCount = await db.collection('inventory').countDocuments();
    console.log('Total inventory records:', rawCount);
    
    // Step 2: Check with is_active filter
    console.log('\n2. With is_active filter:');
    const activeCount = await db.collection('inventory').countDocuments({ is_active: true });
    console.log('Active inventory records:', activeCount);
    
    // Step 3: Test the main inventory query pipeline step by step
    console.log('\n3. Testing aggregation pipeline:');
    
    // Step 3a: Start with match
    const step1 = await db.collection('inventory').aggregate([
      { $match: { is_active: true } }
    ]).toArray();
    console.log('After $match is_active:', step1.length);
    
    // Step 3b: Add SKU lookup
    const step2 = await db.collection('inventory').aggregate([
      { $match: { is_active: true } },
      {
        $lookup: {
          from: 'skunews',
          localField: 'sku_id',
          foreignField: '_id',
          as: 'sku'
        }
      }
    ]).toArray();
    console.log('After SKU lookup:', step2.length);
    
    // Step 3c: Add unwind
    const step3 = await db.collection('inventory').aggregate([
      { $match: { is_active: true } },
      {
        $lookup: {
          from: 'skunews',
          localField: 'sku_id',
          foreignField: '_id',
          as: 'sku'
        }
      },
      { $unwind: '$sku' }
    ]).toArray();
    console.log('After SKU unwind:', step3.length);
    
    // Check if any SKUs are missing
    if (step2.length !== step3.length) {
      console.log('❌ Some inventory records are missing SKU relationships!');
      const problematic = step2.filter(item => !item.sku || item.sku.length === 0);
      console.log('Problematic records:', problematic.map(item => ({ 
        id: item._id, 
        sku_id: item.sku_id,
        sku_found: item.sku?.length || 0
      })));
    }
    
    // Step 3d: Add category lookup
    const step4 = await db.collection('inventory').aggregate([
      { $match: { is_active: true } },
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
    console.log('After category lookup:', step4.length);
    
    // Step 4: Check what we're getting
    if (step4.length > 0) {
      console.log('\n4. Sample result:');
      const sample = step4[0];
      console.log('SKU Code:', sample.sku?.sku_code);
      console.log('Category Name:', sample.category?.name);
      console.log('Total Quantity:', sample.total_quantity);
      console.log('Total Value:', sample.total_value);
    }
    
    // Step 5: Compare with stats query
    console.log('\n5. Stats query (different approach):');
    const statsResult = await db.collection('inventory').aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: null,
          total_skus: { $sum: 1 },
          total_quantity: { $sum: '$total_quantity' },
          total_value: { $sum: '$total_value' }
        }
      }
    ]).toArray();
    console.log('Stats result:', statsResult[0]);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

debugInventoryAPI();
