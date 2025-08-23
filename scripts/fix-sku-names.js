#!/usr/bin/env node

/**
 * Fix SKU Names Script
 * 
 * This script fixes the generic SKU names by enriching them with actual
 * product details from the original product type collections
 */

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/stockmanager_dev';

mongoose.connect(dbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define schemas for collections
const newSkuSchema = new mongoose.Schema({}, { collection: 'skunews', strict: false });
const NewSku = mongoose.model('NewSku', newSkuSchema);

const oldSkuSchema = new mongoose.Schema({}, { collection: 'skus', strict: false });
const OldSku = mongoose.model('OldSku', oldSkuSchema);

const wallSchema = new mongoose.Schema({}, { collection: 'walls', strict: false });
const Wall = mongoose.model('Wall', wallSchema);

const accessorySchema = new mongoose.Schema({}, { collection: 'accessories', strict: false });
const Accessory = mongoose.model('Accessory', accessorySchema);

const toiletSchema = new mongoose.Schema({}, { collection: 'toilets', strict: false });
const Toilet = mongoose.model('Toilet', toiletSchema);

async function fixSkuNames() {
  try {
    console.log('🔧 Starting SKU name fix...');
    
    // Get all new SKUs
    const newSkus = await NewSku.find();
    console.log(`📦 Found ${newSkus.length} SKUs to fix`);
    
    // Get all old SKUs for reference
    const oldSkus = await OldSku.find();
    console.log(`🔍 Found ${oldSkus.length} original SKUs for reference`);
    
    for (const newSku of newSkus) {
      try {
        // Find the corresponding old SKU
        const oldSku = oldSkus.find(old => old.sku_code === newSku.sku_code);
        if (!oldSku) {
          console.warn(`⚠️  No original SKU found for ${newSku.sku_code}`);
          continue;
        }
        
        let productName = '';
        let productDescription = '';
        
        // Get product details based on the product type stored in the old SKU
        if (oldSku.product_details) {
          if (newSku.sku_code.startsWith('WAL-')) {
            // Wall product
            const wallDetails = await Wall.findById(oldSku.product_details);
            if (wallDetails) {
              productName = `${wallDetails.product_line} ${wallDetails.color_name}`;
              productDescription = `${wallDetails.dimensions} | ${wallDetails.finish}`;
              console.log(`✅ Wall: ${newSku.sku_code} -> ${productName}`);
            }
          } else if (newSku.sku_code.startsWith('ACC-')) {
            // Accessory product
            const accessoryDetails = await Accessory.findById(oldSku.product_details);
            if (accessoryDetails) {
              productName = accessoryDetails.name || accessoryDetails.brand || 'Accessory';
              if (accessoryDetails.brand && accessoryDetails.name) {
                productName = `${accessoryDetails.brand} ${accessoryDetails.name}`;
              }
              if (accessoryDetails.model) {
                productName += ` (${accessoryDetails.model})`;
              }
              
              let descParts = [];
              if (accessoryDetails.color) descParts.push(accessoryDetails.color);
              if (accessoryDetails.dimensions) descParts.push(accessoryDetails.dimensions);
              if (accessoryDetails.finish) descParts.push(accessoryDetails.finish);
              productDescription = descParts.join(' | ') || accessoryDetails.description || '';
              
              console.log(`✅ Accessory: ${newSku.sku_code} -> ${productName}`);
            }
          } else if (newSku.sku_code.startsWith('TOI-')) {
            // Toilet product
            const toiletDetails = await Toilet.findById(oldSku.product_details);
            if (toiletDetails) {
              productName = toiletDetails.name || toiletDetails.brand || 'Toilet';
              if (toiletDetails.brand && toiletDetails.name) {
                productName = `${toiletDetails.brand} ${toiletDetails.name}`;
              }
              if (toiletDetails.model) {
                productName += ` (${toiletDetails.model})`;
              }
              productDescription = toiletDetails.description || '';
              console.log(`✅ Toilet: ${newSku.sku_code} -> ${productName}`);
            }
          }
        }
        
        // If we couldn't get product details, use manufacturer model as fallback
        if (!productName && oldSku.manufacturer_model) {
          productName = oldSku.manufacturer_model;
          console.log(`⚡ Fallback: ${newSku.sku_code} -> ${productName} (from manufacturer_model)`);
        }
        
        // If we still don't have a name, use the category name
        if (!productName) {
          const categoryName = newSku.sku_code.startsWith('WAL-') ? 'Wall Panel' :
                              newSku.sku_code.startsWith('ACC-') ? 'Accessory' :
                              newSku.sku_code.startsWith('TOI-') ? 'Toilet' : 'Product';
          productName = categoryName;
          console.log(`🆘 Default: ${newSku.sku_code} -> ${productName} (default)`);
        }
        
        // Update the SKU with the proper name and description
        await NewSku.updateOne(
          { _id: newSku._id },
          {
            $set: {
              name: productName,
              description: productDescription,
              manufacturer_model: oldSku.manufacturer_model || newSku.manufacturer_model,
              last_updated_by: 'sku-name-fix-script',
              updatedAt: new Date()
            }
          }
        );
        
      } catch (error) {
        console.error(`❌ Error fixing SKU ${newSku.sku_code}:`, error.message);
      }
    }
    
    console.log('🎉 SKU name fix completed successfully!');
    
    // Show results
    const updatedSkus = await NewSku.find({}, { sku_code: 1, name: 1, description: 1 });
    console.log('\n📋 Updated SKU Names:');
    updatedSkus.forEach(sku => {
      console.log(`  ${sku.sku_code}: ${sku.name}`);
      if (sku.description) {
        console.log(`    Description: ${sku.description}`);
      }
    });
    
  } catch (error) {
    console.error('💥 SKU name fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
if (require.main === module) {
  fixSkuNames()
    .then(() => {
      console.log('✅ SKU name fix script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ SKU name fix script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixSkuNames };
