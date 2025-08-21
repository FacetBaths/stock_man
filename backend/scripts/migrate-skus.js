require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const Item = require('../src/models/Item');
const SKU = require('../src/models/SKU');
const connectDB = require('../src/config/database');

// Generate SKU code based on product type and details
async function generateSKUCode(item) {
  try {
    // Populate the product details to access the actual product data
    await item.populate('product_details');
    
    const productType = item.product_type.toUpperCase();
    let skuCode = productType;
    
    // Add specific details based on product type
    if (item.product_details) {
      const details = item.product_details;
      
      switch (item.product_type) {
        case 'wall':
          if (details.color) skuCode += `-${details.color.toUpperCase()}`;
          if (details.size) skuCode += `-${details.size.replace(/[^a-zA-Z0-9]/g, '')}`;
          break;
        case 'toilet':
          if (details.brand) skuCode += `-${details.brand.toUpperCase()}`;
          if (details.model) skuCode += `-${details.model.replace(/[^a-zA-Z0-9]/g, '')}`;
          break;
        case 'base':
          if (details.color) skuCode += `-${details.color.toUpperCase()}`;
          if (details.size) skuCode += `-${details.size.replace(/[^a-zA-Z0-9]/g, '')}`;
          break;
        case 'tub':
          if (details.brand) skuCode += `-${details.brand.toUpperCase()}`;
          if (details.model) skuCode += `-${details.model.replace(/[^a-zA-Z0-9]/g, '')}`;
          break;
        case 'vanity':
          if (details.color) skuCode += `-${details.color.toUpperCase()}`;
          if (details.size) skuCode += `-${details.size.replace(/[^a-zA-Z0-9]/g, '')}`;
          break;
        case 'shower_door':
          if (details.type) skuCode += `-${details.type.toUpperCase()}`;
          if (details.size) skuCode += `-${details.size.replace(/[^a-zA-Z0-9]/g, '')}`;
          break;
        default:
          // For other types, try to use common fields
          if (details.name) skuCode += `-${details.name.substring(0, 10).toUpperCase().replace(/[^a-zA-Z0-9]/g, '')}`;
          if (details.brand) skuCode += `-${details.brand.toUpperCase()}`;
          if (details.model) skuCode += `-${details.model.substring(0, 8).replace(/[^a-zA-Z0-9]/g, '')}`;
      }
    }
    
    // Ensure uniqueness by adding a counter if needed
    let finalSKUCode = skuCode;
    let counter = 1;
    while (await SKU.findOne({ sku_code: finalSKUCode })) {
      finalSKUCode = `${skuCode}-${counter.toString().padStart(2, '0')}`;
      counter++;
    }
    
    return finalSKUCode;
  } catch (error) {
    console.error('Error generating SKU code:', error);
    // Fallback: simple timestamp-based SKU
    const timestamp = Date.now().toString().slice(-6);
    return `${item.product_type.toUpperCase()}-${timestamp}`;
  }
}

// Generate barcode (simple sequential number for now)
async function generateBarcode() {
  const existingSKUs = await SKU.countDocuments();
  const barcodeNumber = (existingSKUs + 1).toString().padStart(12, '0');
  
  // Check if barcode already exists
  let counter = 1;
  let barcode = barcodeNumber;
  while (await SKU.findOne({ barcode })) {
    barcode = (parseInt(barcodeNumber) + counter).toString().padStart(12, '0');
    counter++;
  }
  
  return barcode;
}

async function migrateSKUs() {
  try {
    console.log('🚀 Starting SKU migration...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');
    
    // Find all items without SKUs
    const itemsWithoutSKUs = await Item.find({ sku_id: { $exists: false } });
    console.log(`📦 Found ${itemsWithoutSKUs.length} items without SKUs`);
    
    if (itemsWithoutSKUs.length === 0) {
      console.log('✅ All items already have SKUs assigned!');
      return;
    }
    
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const item of itemsWithoutSKUs) {
      try {
        console.log(`\n🔄 Processing item ${processedCount + 1}/${itemsWithoutSKUs.length}:`);
        console.log(`   Type: ${item.product_type}, ID: ${item._id}`);
        
        // Generate SKU code and barcode
        const skuCode = await generateSKUCode(item);
        const barcode = await generateBarcode();
        
        console.log(`   Generated SKU: ${skuCode}, Barcode: ${barcode}`);
        
        // Create new SKU
        const newSKU = new SKU({
          sku_code: skuCode,
          product_type: item.product_type,
          product_details: item.product_details,
          product_type_model: item.product_type_model,
          current_cost: item.cost || 0,
          cost_history: item.cost > 0 ? [{
            cost: item.cost,
            effective_date: item.createdAt || new Date(),
            updated_by: 'system-migration',
            notes: 'Initial cost from inventory migration'
          }] : [],
          stock_thresholds: {
            understocked: item.stock_thresholds?.understocked || 5,
            overstocked: item.stock_thresholds?.overstocked || 100
          },
          is_auto_generated: true,
          generation_template: `AUTO_${item.product_type.toUpperCase()}`,
          barcode: barcode,
          description: `Auto-generated SKU for ${item.product_type} item`,
          notes: 'Created during inventory migration',
          created_by: 'system-migration',
          last_updated_by: 'system-migration',
          status: 'active'
        });
        
        // Save the SKU
        await newSKU.save();
        console.log(`   ✅ Created SKU: ${newSKU.sku_code}`);
        
        // Update the item to reference the new SKU
        item.sku_id = newSKU._id;
        await item.save();
        console.log(`   ✅ Updated item to reference SKU`);
        
        processedCount++;
        
        // Add a small delay to avoid overwhelming the database
        if (processedCount % 10 === 0) {
          console.log(`\n⏸️  Processed ${processedCount} items, pausing briefly...`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Error processing item ${item._id}:`, error.message);
        errorCount++;
        
        // Skip this item and continue
        continue;
      }
    }
    
    console.log('\n🎉 Migration completed!');
    console.log(`✅ Successfully processed: ${processedCount} items`);
    console.log(`⚠️  Skipped: ${skippedCount} items`);
    console.log(`❌ Errors: ${errorCount} items`);
    
    // Verify the migration
    const totalItems = await Item.countDocuments();
    const itemsWithSKUs = await Item.countDocuments({ sku_id: { $exists: true } });
    const totalSKUs = await SKU.countDocuments();
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Total Items: ${totalItems}`);
    console.log(`   Items with SKUs: ${itemsWithSKUs}`);
    console.log(`   Total SKUs: ${totalSKUs}`);
    console.log(`   Coverage: ${((itemsWithSKUs / totalItems) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the migration if called directly
if (require.main === module) {
  migrateSKUs();
}

module.exports = { migrateSKUs, generateSKUCode, generateBarcode };
