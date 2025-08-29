const mongoose = require('mongoose');

async function checkActualData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/stockmanager_dev');
    
    // Check what's actually in the database
    const skuCount = await mongoose.connection.db.collection('skus').countDocuments();
    const instanceCount = await mongoose.connection.db.collection('instances').countDocuments();
    console.log('SKUs:', skuCount, 'Instances:', instanceCount);
    
    if (skuCount === 0) {
      console.log('No SKUs found in local_inventory database');
      process.exit(0);
    }
    
    // Get a sample SKU
    const sampleSKU = await mongoose.connection.db.collection('skus').findOne({});
    console.log('\n=== SAMPLE SKU ===');
    console.log('SKU keys:', Object.keys(sampleSKU));
    console.log('SKU code:', sampleSKU.sku_code);
    console.log('Name:', sampleSKU.name);
    console.log('Status:', sampleSKU.status);
    console.log('Details object:', sampleSKU.details);
    
    // Get inventory using the same pipeline as the backend API
    const pipeline = [
      { $match: { status: 'active' } },
      { $limit: 1 },
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
        $lookup: {
          from: 'instances',
          localField: '_id',
          foreignField: 'sku_id',
          as: 'all_instances'
        }
      },
      {
        $addFields: {
          sku_id: '$_id',
          total_quantity: { $size: '$all_instances' },
          available_quantity: {
            $size: {
              $filter: {
                input: '$all_instances',
                cond: { $eq: ['$$this.tag_id', null] }
              }
            }
          },
          sku: {
            _id: '$_id',
            sku_code: '$sku_code',
            name: '$name',
            description: '$description',
            brand: '$brand',
            model: '$model',
            unit_cost: '$unit_cost',
            barcode: '$barcode',
            category_id: '$category_id',
            status: '$status',
            details: '$details'
          }
        }
      }
    ];
    
    const inventory = await mongoose.connection.db.collection('skus').aggregate(pipeline).toArray();
    
    if (inventory.length > 0) {
      console.log('\n=== INVENTORY STRUCTURE (as returned by API) ===');
      console.log('Available fields:', Object.keys(inventory[0]));
      console.log('Has sku field:', !!inventory[0].sku);
      console.log('Has sku_id field:', !!inventory[0].sku_id);
      
      if (inventory[0].sku) {
        console.log('\n=== SKU NESTED OBJECT ===');
        console.log(JSON.stringify(inventory[0].sku, null, 2));
      }
      
      console.log('\nQuantities:');
      console.log('- Total:', inventory[0].total_quantity);
      console.log('- Available:', inventory[0].available_quantity);
    } else {
      console.log('No active SKU inventory found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkActualData();
