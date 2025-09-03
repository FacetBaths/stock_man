require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function addInstancesToExistingTools() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const SKU = require('./src/models/SKU');
    const Instance = require('./src/models/Instance');
    
    console.log('=== ADDING INSTANCES TO EXISTING TOOLS ===');
    
    // Find existing tool SKUs that need instances
    const toolSKUs = await SKU.find({ 
      sku_code: { $in: ['DRILL-TEST-001', 'POW-25-0001', 'POW-25-0002'] }
    });
    
    for (const sku of toolSKUs) {
      console.log(`\n--- Processing ${sku.sku_code} (${sku.name}) ---`);
      
      // Check current instances
      const existingInstances = await Instance.find({ sku_id: sku._id });
      console.log('  Current instances:', existingInstances.length);
      
      if (existingInstances.length === 0) {
        // Create 2 instances for each tool so we can test partial returns
        console.log('  Creating 2 new instances...');
        
        for (let i = 0; i < 2; i++) {
          const instance = new Instance({
            sku_id: sku._id,
            acquisition_date: new Date(),
            acquisition_cost: sku.unit_cost || 100,
            location: 'Tool Storage',
            supplier: 'Initial Stock',
            reference_number: `INIT-${sku.sku_code}-${i + 1}`,
            notes: 'Added to enable checkout functionality',
            added_by: 'system'
          });
          
          await instance.save();
          console.log(`    ✅ Created instance ${i + 1}: ${instance._id}`);
        }
      } else {
        console.log('  ✅ Already has instances, skipping');
      }
      
      // Verify final count
      const finalCount = await Instance.countDocuments({ sku_id: sku._id });
      const availableCount = await Instance.countDocuments({ sku_id: sku._id, tag_id: null });
      console.log(`  Final count: ${finalCount} total, ${availableCount} available`);
    }
    
    console.log('\n🎉 Done! Your existing tools now have instances and can be checked out.');
    console.log('📱 You can now test the tool checkout and return functionality in the frontend.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addInstancesToExistingTools();
