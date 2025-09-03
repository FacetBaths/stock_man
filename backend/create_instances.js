require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function createToolInstances() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Instance = require('./src/models/Instance');
    const SKU = require('./src/models/SKU');
    
    console.log('=== CREATING ADDITIONAL TOOL INSTANCES ===');
    
    // Find the drill SKU
    const drillSKU = await SKU.findOne({ sku_code: 'DRILL-TEST-001' });
    if (!drillSKU) {
      console.log('Drill SKU not found');
      process.exit(1);
    }
    
    console.log('Found SKU:', drillSKU.sku_code, '(' + drillSKU.name + ')');
    
    // Create a new instance for this SKU
    const newInstance = new Instance({
      sku_id: drillSKU._id,
      acquisition_date: new Date(),
      acquisition_cost: drillSKU.unit_cost || 100,
      location: 'Warehouse-A',
      tag_id: null, // Available
      added_by: 'system' // Required field
    });
    
    await newInstance.save();
    console.log('✅ Created new instance:', newInstance._id);
    
    // Verify the instance was created
    const availableCount = await Instance.countDocuments({ 
      sku_id: drillSKU._id, 
      tag_id: null 
    });
    console.log('Available instances for this SKU:', availableCount);
    
    console.log('✅ Now you can create new checkouts with this tool!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createToolInstances();
