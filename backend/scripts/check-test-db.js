const { MongoClient } = require('mongodb');

async function checkTestDB() {
  const client = new MongoClient('mongodb+srv://stockman:uwClxAy6dFHVW42r@cluster0.55teuc.mongodb.net/?retryWrites=true&w=majority');
  
  try {
    await client.connect();
    console.log('✅ Connected to production cluster');
    
    const db = client.db('test');
    const collections = await db.listCollections().toArray();
    
    console.log('\n=== TEST DATABASE COLLECTIONS ===');
    
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`- Collection: ${col.name} | Documents: ${count}`);
      
      if (count > 0) {
        const sample = await db.collection(col.name).findOne();
        console.log(`  Sample keys:`, Object.keys(sample));
        
        if (col.name === 'items') {
          console.log('  Sample item:');
          console.log('    - Product Type:', sample.product_type);
          console.log('    - Quantity:', sample.quantity);
          console.log('    - Cost:', sample.cost);
          console.log('    - SKU Code:', sample.sku_code);
          console.log('    - Location:', sample.location);
          
          // Get totals
          const totalQuantity = await db.collection('items').aggregate([
            { $group: { _id: null, total: { $sum: '$quantity' }, count: { $sum: 1 } } }
          ]).toArray();
          
          const productTypes = await db.collection('items').distinct('product_type');
          
          console.log('\\n  ITEMS SUMMARY:');
          console.log('    - Total items:', totalQuantity[0]?.count || 0);
          console.log('    - Total quantity:', totalQuantity[0]?.total || 0);
          console.log('    - Product types:', productTypes);
        }
        
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

checkTestDB();
