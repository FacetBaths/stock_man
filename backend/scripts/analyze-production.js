const { MongoClient } = require('mongodb');

async function analyzeProdDB() {
  const client = new MongoClient('mongodb+srv://stockman:uwClxAy6dFHVW42r@cluster0.55teuc.mongodb.net/?retryWrites=true&w=majority');
  
  try {
    await client.connect();
    console.log('✅ Connected to production database');
    
    const db = client.db('stock_manager');
    
    // Get collection names
    const collections = await db.listCollections().toArray();
    console.log('\n=== COLLECTIONS IN PRODUCTION ===');
    collections.forEach(col => console.log('-', col.name));
    
    // Analyze items collection
    const itemsCount = await db.collection('items').countDocuments();
    console.log('\n=== ITEMS ANALYSIS ===');
    console.log('Total items:', itemsCount);
    
    if (itemsCount > 0) {
      const sampleItems = await db.collection('items').find({}).limit(3).toArray();
      console.log('\nSample items:');
      sampleItems.forEach((item, i) => {
        console.log(`Item ${i + 1}:`);
        console.log('- Product Type:', item.product_type);
        console.log('- Quantity:', item.quantity);
        console.log('- Cost:', item.cost);
        console.log('- SKU Code:', item.sku_code);
        console.log('- Location:', item.location);
        console.log('- Has product_details:', !!item.product_details);
        if (item.product_details) {
          console.log('- Product details keys:', Object.keys(item.product_details));
        }
        console.log('---');
      });
      
      // Get unique product types
      const productTypes = await db.collection('items').distinct('product_type');
      console.log('\nUnique product types:', productTypes);
      
      // Get items with and without SKU codes
      const withSKU = await db.collection('items').countDocuments({ sku_code: { $exists: true, $ne: null, $ne: '' } });
      const withoutSKU = itemsCount - withSKU;
      console.log('\nSKU Distribution:');
      console.log('- Items with SKU code:', withSKU);
      console.log('- Items without SKU code:', withoutSKU);
      
      // Quantity analysis
      const totalQuantity = await db.collection('items').aggregate([
        { $group: { _id: null, total: { $sum: '$quantity' } } }
      ]).toArray();
      console.log('- Total quantity across all items:', totalQuantity[0]?.total || 0);
    }
    
    // Check if categories exist
    const categoriesCount = await db.collection('categories').countDocuments();
    console.log('\n=== CATEGORIES ===');
    console.log('Categories count:', categoriesCount);
    
    if (categoriesCount > 0) {
      const categories = await db.collection('categories').find({}).toArray();
      categories.forEach(cat => console.log('- ' + cat.name));
    }
    
    // Check users
    const usersCount = await db.collection('users').countDocuments();
    console.log('\n=== USERS ===');
    console.log('Users count:', usersCount);
    
    // Check tags
    const tagsCount = await db.collection('tags').countDocuments();
    console.log('\n=== TAGS ===');
    console.log('Tags count:', tagsCount);
    
    if (tagsCount > 0) {
      const sampleTags = await db.collection('tags').find({}).limit(2).toArray();
      console.log('\nSample tags:');
      sampleTags.forEach((tag, i) => {
        console.log(`Tag ${i + 1}:`);
        console.log('- Type:', tag.tag_type);
        console.log('- Customer:', tag.customer_name);
        console.log('- Item IDs:', tag.item_ids?.length || 0);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

analyzeProdDB();
