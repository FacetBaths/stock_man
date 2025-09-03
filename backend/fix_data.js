require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function fixDataInconsistency() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Instance = require('./src/models/Instance');
    const Tag = require('./src/models/Tag');
    
    console.log('=== FIXING DATA INCONSISTENCY ===');
    
    // Find Jonathan's tag
    const tag = await Tag.findById('68b74ee098259561f621e2ac');
    if (!tag) {
      console.log('Tag not found!');
      process.exit(1);
    }
    
    console.log('Tag found:', tag.customer_name, '| Status:', tag.status);
    console.log('SKU items before fix:');
    tag.sku_items.forEach((item, i) => {
      console.log('  Item', i, '| SKU:', item.sku_id, '| selected_ids:', (item.selected_instance_ids || []).length);
    });
    
    // Find all instances tagged to this tag
    const instances = await Instance.find({ tag_id: tag._id });
    console.log('\nInstances tagged to this tag:', instances.length);
    
    // Group instances by SKU
    const instancesBySKU = {};
    for (const inst of instances) {
      const skuId = inst.sku_id.toString();
      if (!instancesBySKU[skuId]) {
        instancesBySKU[skuId] = [];
      }
      instancesBySKU[skuId].push(inst._id);
      console.log('  Instance:', inst._id, '→ SKU:', skuId);
    }
    
    // Update tag's sku_items with correct selected_instance_ids
    let updated = false;
    for (const item of tag.sku_items) {
      const skuId = item.sku_id.toString();
      const assignedInstances = instancesBySKU[skuId] || [];
      
      if (assignedInstances.length > 0) {
        item.selected_instance_ids = assignedInstances;
        item.quantity = assignedInstances.length;
        item.remaining_quantity = assignedInstances.length;
        updated = true;
        console.log('\nUpdated SKU', skuId, ':', assignedInstances.length, 'instances assigned');
      }
    }
    
    if (updated) {
      await tag.save();
      console.log('\n✅ Tag updated successfully!');
      
      // Verify the fix
      const updatedTag = await Tag.findById(tag._id);
      console.log('\nSKU items after fix:');
      updatedTag.sku_items.forEach((item, i) => {
        console.log('  Item', i, '| SKU:', item.sku_id, '| selected_ids:', (item.selected_instance_ids || []).length);
      });
    } else {
      console.log('\nNo updates needed');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixDataInconsistency();
