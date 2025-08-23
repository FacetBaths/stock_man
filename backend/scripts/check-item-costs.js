const { MongoClient } = require('mongodb');

async function checkItemCosts() {
  const prodClient = new MongoClient('mongodb+srv://stockman:uwClxAy6dFHVW42r@cluster0.55teuc.mongodb.net/?retryWrites=true&w=majority');
  
  try {
    await prodClient.connect();
    const prodDB = prodClient.db('test');
    
    console.log('=== PRODUCTION ITEM COSTS ===');
    const items = await prodDB.collection('items').find({}).toArray();
    
    let itemsWithCost = 0;
    let totalValue = 0;
    
    items.forEach(item => {
      if (item.cost && item.cost > 0) {
        console.log(`Item: ${item.product_type} - Cost: $${item.cost} - Qty: ${item.quantity} - Total: $${item.cost * item.quantity}`);
        itemsWithCost++;
        totalValue += (item.cost * item.quantity);
      }
    });
    
    console.log(`\nSummary: ${itemsWithCost}/${items.length} items have costs`);
    console.log(`Total inventory value: $${totalValue}`);
    
    // Group by SKU ID to see average costs
    console.log('\n=== ITEMS BY SKU WITH COSTS ===');
    const skuGroups = {};
    items.forEach(item => {
      if (item.sku_id && item.cost > 0) {
        const skuId = item.sku_id.toString();
        if (!skuGroups[skuId]) {
          skuGroups[skuId] = { items: [], totalCost: 0, totalQty: 0 };
        }
        skuGroups[skuId].items.push(item);
        skuGroups[skuId].totalCost += (item.cost * item.quantity);
        skuGroups[skuId].totalQty += item.quantity;
      }
    });
    
    for (const skuId in skuGroups) {
      const group = skuGroups[skuId];
      const avgCost = group.totalCost / group.totalQty;
      console.log(`SKU ID ${skuId}: Avg cost $${avgCost.toFixed(2)} (from ${group.items.length} items, ${group.totalQty} total qty)`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prodClient.close();
  }
}

checkItemCosts();
