const { MongoClient } = require('mongodb');

async function testCountPipeline() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('stockmanager_dev');
    
    // Simulate the exact pipeline used in the API
    let pipeline = [
      { $match: { is_active: true } },
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
        $lookup: {
          from: 'categories',
          localField: 'sku.category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          needs_reorder: { $lte: ['$available_quantity', '$reorder_point'] },
          utilization_rate: {
            $cond: {
              if: { $gt: ['$total_quantity', 0] },
              then: {
                $multiply: [
                  { $divide: [{ $subtract: ['$total_quantity', '$available_quantity'] }, '$total_quantity'] },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      { $sort: { 'sku.sku_code': 1 } }
    ];

    console.log('=== TESTING COUNT PIPELINE ===');
    
    // Test the count pipeline
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await db.collection('inventory').aggregate(countPipeline).toArray();
    console.log('Count pipeline result:', countResult);
    console.log('Total from count:', countResult.length > 0 ? countResult[0].total : 0);
    
    // Test the main pipeline
    const mainResult = await db.collection('inventory').aggregate(pipeline).toArray();
    console.log('Main pipeline count:', mainResult.length);
    
    if (mainResult.length > 0) {
      console.log('Sample item:', {
        sku_code: mainResult[0].sku?.sku_code,
        category: mainResult[0].category?.name,
        total_quantity: mainResult[0].total_quantity,
        total_value: mainResult[0].total_value
      });
      
      // Show a few more
      console.log('\nAll SKUs found:');
      mainResult.forEach(item => {
        console.log(`- ${item.sku.sku_code} (${item.category?.name}): ${item.total_quantity} items`);
      });
    }
    
    // Test with pagination applied
    const paginatedPipeline = [...pipeline, { $skip: 0 }, { $limit: 50 }];
    const paginatedResult = await db.collection('inventory').aggregate(paginatedPipeline).toArray();
    console.log('\nPaginated result count:', paginatedResult.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testCountPipeline();
