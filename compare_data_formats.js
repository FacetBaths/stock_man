const mongoose = require('mongoose');

async function compareDataFormats() {
  try {
    await mongoose.connect('mongodb://localhost:27017/stockmanager_dev');
    console.log('Connected to MongoDB');
    
    console.log('\n=== INVESTIGATING DATA FORMAT CHANGES ===\n');
    
    // 1. Check current data structure vs expected frontend structure
    console.log('1. CHECKING CURRENT SKU DATA FORMAT');
    
    const currentSKU = await mongoose.connection.db.collection('skus').findOne({});
    console.log('Current SKU structure:');
    console.log(JSON.stringify(currentSKU, null, 2));
    
    // 2. Check what the inventory API actually returns
    console.log('\n2. CHECKING ACTUAL INVENTORY API RESPONSE');
    
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
    
    const inventoryResponse = await mongoose.connection.db.collection('skus').aggregate(pipeline).toArray();
    
    if (inventoryResponse.length > 0) {
      console.log('Current Inventory API Response:');
      console.log(JSON.stringify(inventoryResponse[0], null, 2));
      
      // 3. Check specific fields that EditItemModal depends on
      console.log('\n3. CHECKING EDITITEMMODAL CRITICAL FIELDS');
      
      const item = inventoryResponse[0];
      
      console.log('Critical EditItemModal fields:');
      console.log('- item.sku exists:', !!item.sku);
      console.log('- item.sku._id exists:', !!item.sku?._id);
      console.log('- item.sku.name:', item.sku?.name);
      console.log('- item.sku.details exists:', !!item.sku?.details);
      console.log('- item.sku.details structure:', item.sku?.details);
      console.log('- item.sku.unit_cost:', item.sku?.unit_cost);
      console.log('- item.sku.unit_cost type:', typeof item.sku?.unit_cost);
      
      // 4. Check for data type issues that could break the frontend
      console.log('\n4. CHECKING FOR DATA TYPE ISSUES');
      
      // Check if unit_cost is a MongoDB NumberInt/NumberDouble object
      if (item.sku?.unit_cost && typeof item.sku.unit_cost === 'object') {
        console.log('⚠️  unit_cost is an object, not a number!');
        console.log('unit_cost structure:', item.sku.unit_cost);
        console.log('This could break frontend number inputs!');
      } else {
        console.log('✅ unit_cost is a proper number:', item.sku?.unit_cost);
      }
      
      // Check ObjectIds
      if (item.sku?.category_id) {
        console.log('category_id type:', typeof item.sku.category_id);
        console.log('category_id value:', item.sku.category_id);
      }
      
      // 5. Check if there are missing fields that the old system had
      console.log('\n5. CHECKING FOR MISSING FIELDS FROM OLD SYSTEM');
      
      // The old system might have had these fields that the modal expects
      const potentialOldFields = [
        'product_type', 'manufacturer_model', 'color', 'dimensions', 
        'finish', 'item_code', 'legacy_id'
      ];
      
      console.log('Checking for old fields that might be missing:');
      potentialOldFields.forEach(field => {
        const hasField = item.hasOwnProperty(field) || item.sku?.hasOwnProperty(field);
        console.log(`- ${field}: ${hasField ? '✅ present' : '❌ missing'}`);
      });
      
      // 6. Check the exact PUT request structure that would be sent
      console.log('\n6. SIMULATING EDITITEMMODAL SAVE REQUEST');
      
      const formData = {
        name: item.sku?.name || 'SKU Product',
        description: item.sku?.description || '',
        brand: item.sku?.brand || '',
        model: item.sku?.model || '',
        details: {
          product_line: item.sku?.details?.product_line || '',
          color_name: item.sku?.details?.color_name || '',
          dimensions: item.sku?.details?.dimensions || '',
          finish: item.sku?.details?.finish || ''
        },
        unit_cost: item.sku?.unit_cost || 0,
        currency: item.sku?.currency || 'USD',
        barcode: item.sku?.barcode || '',
        status: item.sku?.status || 'active'
      };
      
      console.log('Simulated EditItemModal form data:');
      console.log(JSON.stringify(formData, null, 2));
      
      console.log('\nSKU ID for PUT request:', item.sku?._id);
      
    } else {
      console.log('❌ No inventory data returned from API');
    }
    
    // 7. Check if we're missing quantity data at item level
    console.log('\n7. CHECKING ITEM-LEVEL QUANTITIES');
    
    // Check if the inventory response has the quantities needed for the UI
    if (inventoryResponse.length > 0) {
      const item = inventoryResponse[0];
      console.log('Item quantities:');
      console.log('- total_quantity:', item.total_quantity);
      console.log('- available_quantity:', item.available_quantity);
      console.log('- reserved_quantity:', item.reserved_quantity);
      console.log('- broken_quantity:', item.broken_quantity);
      console.log('- loaned_quantity:', item.loaned_quantity);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

compareDataFormats();
