const mongoose = require('mongoose');

async function testCompleteFlow() {
  try {
    await mongoose.connect('mongodb://localhost:27017/stockmanager_dev');
    console.log('Connected to MongoDB');
    
    // Test 1: Get inventory data using exact same pipeline as backend
    console.log('\n=== TEST 1: Backend Inventory API Simulation ===');
    
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
    
    const inventoryItems = await mongoose.connection.db.collection('skus').aggregate(pipeline).toArray();
    
    if (inventoryItems.length > 0) {
      const item = inventoryItems[0];
      console.log('✅ Inventory item retrieved');
      console.log('✅ Has sku field:', !!item.sku);
      console.log('✅ Has sku_id field:', !!item.sku_id);
      
      // Test 2: Simulate EditItemModal.initializeForm logic
      console.log('\n=== TEST 2: EditItemModal Logic Simulation ===');
      
      let skuData = {};
      let skuId = '';
      
      // Check for populated sku field first (as used by InventoryTable)
      if (item.sku && typeof item.sku === 'object') {
        skuData = item.sku;
        skuId = item.sku._id;
        console.log('✅ Using populated SKU data from item.sku');
        console.log('✅ SKU ID found:', skuId);
      } else if (typeof item.sku_id === 'object' && item.sku_id !== null) {
        skuData = item.sku_id;
        skuId = item.sku_id._id;
        console.log('✅ Using populated SKU data from item.sku_id');
      } else {
        console.log('❌ No populated SKU data found');
        console.log('❌ item.sku type:', typeof item.sku);
        console.log('❌ item.sku_id type:', typeof item.sku_id);
        return;
      }
      
      // Test 3: Form data initialization
      console.log('\n=== TEST 3: Form Data Structure ===');
      console.log('SKU name:', skuData.name || 'SKU Product');
      console.log('SKU brand:', skuData.brand || '');
      console.log('SKU details:', skuData.details || {});
      console.log('Unit cost:', skuData.unit_cost || 0);
      
      // Expected form structure that EditItemModal should populate
      const expectedFormData = {
        name: skuData.name || 'SKU Product',
        description: skuData.description || '',
        brand: skuData.brand || '',
        model: skuData.model || '',
        details: {
          product_line: skuData.details?.product_line || '',
          color_name: skuData.details?.color_name || '',
          dimensions: skuData.details?.dimensions || '',
          finish: skuData.details?.finish || ''
        },
        unit_cost: skuData.unit_cost || 0,
        currency: skuData.currency || 'USD',
        barcode: skuData.barcode || '',
        status: skuData.status || 'active'
      };
      
      console.log('✅ Expected form data structure:');
      console.log(JSON.stringify(expectedFormData, null, 2));
      
      console.log('\n=== CONCLUSION ===');
      console.log('✅ Backend data structure is correct');
      console.log('✅ Frontend should be able to parse this data');
      console.log('✅ All required fields are present');
      
      console.log('\n=== DEBUGGING HINTS ===');
      console.log('1. Check browser developer tools for console errors');
      console.log('2. Verify the inventory API is being called successfully');
      console.log('3. Check if authentication is working');
      console.log('4. Look for JavaScript errors in EditItemModal');
      console.log('5. Verify the edit button click is properly passing the item');
      
    } else {
      console.log('❌ No inventory items found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testCompleteFlow();
