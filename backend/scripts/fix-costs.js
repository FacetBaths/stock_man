const { MongoClient } = require('mongodb');

async function fixCosts() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('stockmanager_dev');
    
    console.log('=== FIXING SKU AND INVENTORY COSTS ===');
    
    // Get all items with costs
    const items = await db.collection('itemnews').find({}).toArray();
    console.log(`Found ${items.length} items`);
    
    // Group items by SKU and calculate average costs
    const skuCostData = {};
    let itemsWithCosts = 0;
    
    items.forEach(item => {
      if (item.sku_id && item.purchase_cost && item.purchase_cost > 0) {
        const skuId = item.sku_id.toString();
        
        if (!skuCostData[skuId]) {
          skuCostData[skuId] = {
            totalCost: 0,
            totalQuantity: 0,
            itemCount: 0
          };
        }
        
        skuCostData[skuId].totalCost += item.purchase_cost;
        skuCostData[skuId].totalQuantity += 1; // Each item is 1 unit in new schema
        skuCostData[skuId].itemCount += 1;
        itemsWithCosts++;
      }
    });
    
    console.log(`${itemsWithCosts} items have cost data`);
    console.log(`Cost data available for ${Object.keys(skuCostData).length} SKUs`);
    
    // Update SKUs with calculated average costs
    let skusUpdated = 0;
    for (const skuId in skuCostData) {
      const costData = skuCostData[skuId];
      const avgCost = costData.totalCost / costData.totalQuantity;
      
      const result = await db.collection('skunews').updateOne(
        { _id: new (require('mongodb')).ObjectId(skuId) },
        { $set: { unit_cost: avgCost } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`Updated SKU ${skuId}: $${avgCost.toFixed(2)} avg cost (from ${costData.itemCount} items)`);
        skusUpdated++;
      }
    }
    
    console.log(`\\nUpdated ${skusUpdated} SKUs with cost data`);
    
    // Update inventory records with proper costs and values
    const inventoryRecords = await db.collection('inventory').find({}).toArray();
    let inventoryUpdated = 0;
    let totalInventoryValue = 0;
    
    for (const inventory of inventoryRecords) {
      const skuId = inventory.sku_id.toString();
      
      if (skuCostData[skuId]) {
        const costData = skuCostData[skuId];
        const avgCost = costData.totalCost / costData.totalQuantity;
        const totalValue = avgCost * inventory.total_quantity;
        
        const result = await db.collection('inventory').updateOne(
          { _id: inventory._id },
          { 
            $set: { 
              average_cost: avgCost,
              total_value: totalValue
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`Updated inventory for SKU ${skuId}: ${inventory.total_quantity} items @ $${avgCost.toFixed(2)} = $${totalValue.toFixed(2)}`);
          inventoryUpdated++;
          totalInventoryValue += totalValue;
        }
      }
    }
    
    console.log(`\\n=== COST UPDATE SUMMARY ===`);
    console.log(`SKUs updated: ${skusUpdated}`);
    console.log(`Inventory records updated: ${inventoryUpdated}`);
    console.log(`Total inventory value: $${totalInventoryValue.toFixed(2)}`);
    
    // Verify the updates
    console.log('\\n=== VERIFICATION ===');
    const updatedInventory = await db.collection('inventory').aggregate([
      { $match: { total_value: { $gt: 0 } } },
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
        $project: {
          sku_code: '$sku.sku_code',
          total_quantity: 1,
          average_cost: 1,
          total_value: 1
        }
      }
    ]).toArray();
    
    updatedInventory.forEach(item => {
      console.log(`${item.sku_code}: ${item.total_quantity} items @ $${item.average_cost.toFixed(2)} = $${item.total_value.toFixed(2)}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixCosts();
