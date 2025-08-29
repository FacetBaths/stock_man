const mongoose = require('mongoose');

async function checkStructureMismatch() {
  try {
    await mongoose.connect('mongodb://localhost:27017/stockmanager_dev');
    console.log('=== CHECKING DATABASE STRUCTURE AFTER MIGRATION ===\n');
    
    // Get actual SKU structure
    const actualSKU = await mongoose.connection.db.collection('skus').findOne({});
    console.log('ACTUAL SKU STRUCTURE:');
    console.log('Keys:', Object.keys(actualSKU));
    
    // Expected SKU structure according to BACKEND_API_REFERENCE.md
    const expectedSKUFields = [
      '_id', 'sku_code', 'category_id', 'name', 'description', 'brand', 'model',
      'details', 'unit_cost', 'currency', 'cost_history', 'status', 'barcode',
      'supplier_info', 'images', 'stock_thresholds', 'is_bundle', 'bundle_items',
      'created_by', 'last_updated_by', 'createdAt', 'updatedAt'
    ];
    
    console.log('\nEXPECTED SKU FIELDS:', expectedSKUFields);
    console.log('ACTUAL SKU FIELDS:  ', Object.keys(actualSKU));
    
    // Check for missing or extra fields
    const missing = expectedSKUFields.filter(f => !actualSKU.hasOwnProperty(f));
    const extra = Object.keys(actualSKU).filter(f => !expectedSKUFields.includes(f));
    
    if (missing.length > 0) {
      console.log('\n❌ MISSING FIELDS:', missing);
    } else {
      console.log('\n✅ No missing required fields');
    }
    
    if (extra.length > 0) {
      console.log('➕ EXTRA FIELDS:', extra);
    }
    
    // Check details object structure
    console.log('\n=== DETAILS OBJECT STRUCTURE ===');
    console.log('Actual details:', JSON.stringify(actualSKU.details, null, 2));
    
    // Expected details fields according to docs
    const expectedDetailsFields = [
      'product_line', 'color_name', 'dimensions', 'finish',  // Wall fields
      'tool_type', 'manufacturer', 'serial_number', 'voltage', 'features',  // Tool fields  
      'weight', 'specifications'  // Common fields
    ];
    
    const actualDetailsFields = Object.keys(actualSKU.details || {});
    console.log('Expected details fields (any):', expectedDetailsFields);
    console.log('Actual details fields:', actualDetailsFields);
    
    // Check Instance structure
    console.log('\n=== INSTANCE STRUCTURE ===');
    const actualInstance = await mongoose.connection.db.collection('instances').findOne({});
    
    if (actualInstance) {
      console.log('Actual Instance keys:', Object.keys(actualInstance));
      
      const expectedInstanceFields = [
        '_id', 'sku_id', 'acquisition_date', 'acquisition_cost', 'tag_id',
        'location', 'supplier', 'reference_number', 'notes', 'added_by',
        'createdAt', 'updatedAt'
      ];
      
      console.log('Expected Instance fields:', expectedInstanceFields);
      
      const missingInstance = expectedInstanceFields.filter(f => !actualInstance.hasOwnProperty(f));
      const extraInstance = Object.keys(actualInstance).filter(f => !expectedInstanceFields.includes(f));
      
      if (missingInstance.length > 0) {
        console.log('❌ MISSING Instance fields:', missingInstance);
      } else {
        console.log('✅ All Instance fields present');
      }
      
      if (extraInstance.length > 0) {
        console.log('➕ EXTRA Instance fields:', extraInstance);
      }
    }
    
    // Check what the frontend will actually receive
    console.log('\n=== WHAT FRONTEND RECEIVES ===');
    
    // Test the inventory API aggregation that the frontend calls
    const inventoryItem = await mongoose.connection.db.collection('skus').aggregate([
      { $match: { status: 'active' } },
      { $limit: 1 },
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
          total_quantity: { $size: '$all_instances' },
          sku: {
            _id: '$_id',
            sku_code: '$sku_code', 
            name: '$name',
            details: '$details'  // This is critical
          }
        }
      }
    ]).toArray();
    
    if (inventoryItem.length > 0) {
      const item = inventoryItem[0];
      console.log('Frontend receives item.sku with keys:', Object.keys(item.sku));
      console.log('Frontend receives item.sku.details:', JSON.stringify(item.sku.details, null, 2));
      
      // This is what EditItemModal tries to access
      console.log('\nEditItemModal critical checks:');
      console.log('- item.sku exists:', !!item.sku);
      console.log('- item.sku.details exists:', !!item.sku.details);
      console.log('- item.sku.details.product_line:', item.sku.details?.product_line);
      console.log('- item.sku.details.color_name:', item.sku.details?.color_name);
      console.log('- item.sku.details.dimensions:', item.sku.details?.dimensions);
      console.log('- item.sku.details.finish:', item.sku.details?.finish);
      
      if (!item.sku.details || Object.keys(item.sku.details).length === 0) {
        console.log('\n❌ CRITICAL ISSUE: SKU details object is empty or missing!');
        console.log('EditItemModal will not populate correctly.');
      } else {
        console.log('\n✅ SKU details object has data for frontend');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStructureMismatch();
