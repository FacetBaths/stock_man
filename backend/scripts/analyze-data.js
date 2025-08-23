const { MongoClient, ObjectId } = require('mongodb');

async function analyzeData() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('stockmanager_dev');
    
    console.log('=== CHECKING SKU ID REFERENCES ===');
    const items = await db.collection('itemnews').find({}).toArray();
    const uniqueSkuIds = [...new Set(items.map(item => item.sku_id.toString()))];
    console.log('Unique SKU IDs in items:', uniqueSkuIds);
    
    console.log('\n=== CHECKING IF SKU IDs EXIST ===');
    for (const skuId of uniqueSkuIds) {
      const sku = await db.collection('skus').findOne({ _id: new ObjectId(skuId) });
      console.log('SKU ID', skuId, 'exists:', !!sku, sku ? '(' + sku.sku_code + ')' : '');
    }
    
    console.log('\n=== SAMPLE FULL ITEM RECORD ===');
    const sampleItem = await db.collection('itemnews').findOne({});
    console.log(JSON.stringify(sampleItem, null, 2));
    
    console.log('\n=== LEGACY ITEMS ===');
    const legacyItems = await db.collection('items').find({}).toArray();
    console.log('Legacy items count:', legacyItems.length);
    if (legacyItems.length > 0) {
      console.log('Sample legacy item:');
      console.log('- Product type:', legacyItems[0].product_type);
      console.log('- Quantity:', legacyItems[0].quantity);
      console.log('- Cost:', legacyItems[0].cost);
      console.log('- SKU code:', legacyItems[0].sku_code);
    }
    
    console.log('\n=== CHECKING SKUNEWS COLLECTION ===');
    const skuNews = await db.collection('skunews').find({}).toArray();
    console.log('SKU News count:', skuNews.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeData();
