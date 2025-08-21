require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('../src/models/Item');
const Wall = require('../src/models/Wall');
const { Toilet, Base, Tub, Vanity, ShowerDoor, RawMaterial, Accessory, Miscellaneous } = require('../src/models/Product');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('🍃 MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const sampleData = {
  walls: [
    {
      product_line: 'Monterey',
      color_name: 'Carrara',
      dimensions: '48x96',
      finish: 'Subway',
      quantity: 8,
      location: 'Warehouse A-1',
      cost: 920,
    },
    {
      product_line: 'Venice',
      color_name: 'Marble White',
      dimensions: '36x48',
      finish: 'Smooth',
      quantity: 12,
      location: 'Warehouse A-2',
      cost: 650,
    },
    {
      product_line: 'Tuscany',
      color_name: 'Beige Stone',
      dimensions: '60x96',
      finish: 'Textured',
      quantity: 3,
      location: 'Showroom',
      cost: 1200,
    },
    {
      product_line: 'Modern',
      color_name: 'Charcoal Gray',
      dimensions: '32x64',
      finish: 'Matte',
      quantity: 15,
      location: 'Warehouse B-1',
      cost: 580,
    }
  ],

  toilets: [
    {
      name: 'EcoFlush Pro',
      brand: 'American Standard',
      model: 'Champion 4 Max',
      color: 'Bone',
      dimensions: '28x15x30',
      rough_in: '12"',
      description: 'High-efficiency dual flush toilet',
      quantity: 6,
      location: 'Warehouse C-1',
      cost: 485,
    },
    {
      name: 'Classic Comfort',
      brand: 'Kohler',
      model: 'Wellworth K-3999',
      color: 'White',
      dimensions: '29x17x31',
      rough_in: '12"',
      description: 'Traditional two-piece toilet with comfort height',
      quantity: 4,
      location: 'Showroom',
      cost: 325,
    },
    {
      name: 'Smart Toilet Pro',
      brand: 'Toto',
      model: 'Washlet G450',
      color: 'Cotton White',
      dimensions: '27x16x29',
      rough_in: '12"',
      description: 'Integrated smart toilet with bidet features',
      quantity: 2,
      location: 'Special Orders',
      cost: 2850,
    }
  ],

  bases: [
    {
      name: 'Neo-Angle Base',
      brand: 'DreamLine',
      model: 'SlimLine 36',
      color: 'White Acrylic',
      dimensions: '36x36x3',
      material: 'Acrylic',
      description: 'Neo-angle corner shower base',
      quantity: 5,
      location: 'Warehouse D-1',
      cost: 295,
    },
    {
      name: 'Rectangle Base',
      brand: 'American Standard',
      model: 'Town Square S',
      color: 'Linen',
      dimensions: '60x32x4',
      material: 'Fiberglass',
      description: 'Standard rectangular shower base',
      quantity: 8,
      location: 'Warehouse D-2',
      cost: 385,
    }
  ],

  tubs: [
    {
      name: 'Freestanding Soaker',
      brand: 'Kohler',
      model: 'Vintage K-700',
      color: 'White',
      dimensions: '66x36x24',
      material: 'Cast Iron',
      description: 'Classic clawfoot freestanding tub',
      quantity: 2,
      location: 'Showroom',
      cost: 1850,
    },
    {
      name: 'Alcove Bathtub',
      brand: 'American Standard',
      model: 'Princeton 60',
      color: 'White',
      dimensions: '60x32x20',
      material: 'Porcelain Steel',
      description: 'Standard alcove bathtub with right-hand drain',
      quantity: 7,
      location: 'Warehouse E-1',
      cost: 425,
    },
    {
      name: 'Jetted Tub',
      brand: 'Jacuzzi',
      model: 'Nova J4D7242',
      color: 'Biscuit',
      dimensions: '72x42x23',
      material: 'Acrylic',
      description: '8-jet whirlpool tub with chromotherapy',
      quantity: 1,
      location: 'Special Orders',
      cost: 3200,
    }
  ],

  vanities: [
    {
      name: 'Double Sink Vanity',
      brand: 'Home Decorators',
      model: 'Thornfield 72',
      color: 'Distressed Grey',
      dimensions: '72x22x35',
      material: 'Engineered Wood',
      description: 'Double sink vanity with marble countertop',
      quantity: 3,
      location: 'Warehouse F-1',
      cost: 1245,
    },
    {
      name: 'Floating Vanity',
      brand: 'Fresca',
      model: 'Vista 30',
      color: 'White Gloss',
      dimensions: '30x18x24',
      material: 'MDF',
      description: 'Wall-mounted single sink vanity',
      quantity: 6,
      location: 'Warehouse F-2',
      cost: 485,
    },
    {
      name: 'Traditional Vanity',
      brand: 'Foremost',
      model: 'Naples 48',
      color: 'Warm Cinnamon',
      dimensions: '48x21x34',
      material: 'Hardwood',
      description: 'Traditional style single sink vanity',
      quantity: 4,
      location: 'Showroom',
      cost: 795,
    }
  ],

  shower_doors: [
    {
      name: 'Frameless Sliding Door',
      brand: 'DreamLine',
      model: 'Enigma-X 68',
      color: 'Clear Glass',
      dimensions: '68x76',
      material: 'Tempered Glass',
      description: 'Frameless sliding shower door with brushed stainless steel hardware',
      quantity: 4,
      location: 'Warehouse G-1',
      cost: 925,
    },
    {
      name: 'Semi-Frameless Pivot',
      brand: 'Delta',
      model: 'Lyndall 36',
      color: 'Clear Glass',
      dimensions: '36x72',
      material: 'Tempered Glass',
      description: 'Semi-frameless pivot shower door',
      quantity: 7,
      location: 'Warehouse G-2',
      cost: 485,
    }
  ],

  raw_materials: [
    {
      name: 'Waterproof Membrane',
      brand: 'RedGard',
      model: 'Liquid Membrane',
      color: 'Red',
      dimensions: '1 gallon',
      material: 'Liquid Polymer',
      description: 'Waterproofing membrane for shower applications',
      quantity: 24,
      location: 'Storage Room A',
      cost: 45,
    },
    {
      name: 'Tile Adhesive',
      brand: 'Custom Building Products',
      model: 'VersaBond Gray',
      color: 'Gray',
      dimensions: '50 lb bag',
      material: 'Modified Thinset',
      description: 'Professional grade tile adhesive',
      quantity: 18,
      location: 'Storage Room B',
      cost: 28,
    },
    {
      name: 'Grout',
      brand: 'Mapei',
      model: 'Keracolor U',
      color: 'Bone',
      dimensions: '25 lb bag',
      material: 'Unsanded Grout',
      description: 'Premium unsanded grout for narrow joints',
      quantity: 32,
      location: 'Storage Room A',
      cost: 22,
    }
  ],

  accessories: [
    {
      name: 'Towel Bar Set',
      brand: 'Moen',
      model: 'Eva 4-piece',
      color: 'Brushed Nickel',
      dimensions: '24" bar + accessories',
      material: 'Stainless Steel',
      description: '4-piece bathroom accessory set',
      quantity: 12,
      location: 'Accessories Storage',
      cost: 125,
    },
    {
      name: 'Shower Head',
      brand: 'Delta',
      model: 'In2ition 5-spray',
      color: 'Chrome',
      dimensions: '4.5" face',
      material: 'Chrome Plated',
      description: 'Dual shower head with handheld',
      quantity: 15,
      location: 'Accessories Storage',
      cost: 89,
    },
    {
      name: 'Bathroom Fan',
      brand: 'Broan',
      model: 'InVent 80CFM',
      color: 'White',
      dimensions: '8.5"x11"',
      material: 'Plastic Housing',
      description: 'Energy efficient bathroom exhaust fan',
      quantity: 8,
      location: 'Electrical Storage',
      cost: 165,
    }
  ],

  miscellaneous: [
    {
      name: 'Plumbing Snake',
      brand: 'Ridgid',
      model: 'PowerSpin 57043',
      color: 'Yellow',
      dimensions: '25ft cable',
      material: 'Steel Cable',
      description: 'Drain cleaning machine for toilets and tubs',
      quantity: 2,
      location: 'Tool Storage',
      cost: 445,
    },
    {
      name: 'Pipe Wrench Set',
      brand: 'CRAFTSMAN',
      model: '3-piece Set',
      color: 'Red Handle',
      dimensions: '10", 14", 18"',
      material: 'Drop Forged Steel',
      description: 'Professional pipe wrench set',
      quantity: 5,
      location: 'Tool Storage',
      cost: 95,
    }
  ]
};

async function createProductAndItem(productType, productData, itemData) {
  let productDetailsDoc;
  
  switch (productType) {
    case 'wall':
      productDetailsDoc = new Wall(productData);
      break;
    case 'toilet':
      productDetailsDoc = new Toilet(productData);
      break;
    case 'base':
      productDetailsDoc = new Base(productData);
      break;
    case 'tub':
      productDetailsDoc = new Tub(productData);
      break;
    case 'vanity':
      productDetailsDoc = new Vanity(productData);
      break;
    case 'shower_door':
      productDetailsDoc = new ShowerDoor(productData);
      break;
    case 'raw_material':
      productDetailsDoc = new RawMaterial(productData);
      break;
    case 'accessory':
      productDetailsDoc = new Accessory(productData);
      break;
    case 'miscellaneous':
      productDetailsDoc = new Miscellaneous(productData);
      break;
    default:
      throw new Error(`Invalid product type: ${productType}`);
  }

  await productDetailsDoc.save();

  const typeMapping = {
    'wall': 'Wall',
    'toilet': 'Toilet',
    'base': 'Base',
    'tub': 'Tub',
    'vanity': 'Vanity',
    'shower_door': 'ShowerDoor',
    'raw_material': 'RawMaterial',
    'accessory': 'Accessory',
    'miscellaneous': 'Miscellaneous'
  };
  
  const item = new Item({
    product_type: productType,
    product_details: productDetailsDoc._id,
    product_type_model: typeMapping[productType],
    quantity: itemData.quantity,
    location: itemData.location || '',
    notes: itemData.notes || '',
    cost: itemData.cost || 0
  });

  await item.save();
  return item;
}

async function populateDatabase() {
  console.log('🚀 Starting sample data population...');

  try {
    // Get current count
    const currentCount = await Item.countDocuments();
    console.log(`📊 Current item count: ${currentCount}`);

    let totalCreated = 0;

    // Create wall items
    console.log('\n🏗️  Creating wall items...');
    for (const wallData of sampleData.walls) {
      const { quantity, location, cost, ...productDetails } = wallData;
      await createProductAndItem('wall', productDetails, { quantity, location, cost });
      totalCreated++;
      console.log(`   ✅ Created wall: ${productDetails.product_line} ${productDetails.color_name}`);
    }

    // Create toilet items
    console.log('\n🚽 Creating toilet items...');
    for (const toiletData of sampleData.toilets) {
      const { quantity, location, cost, ...productDetails } = toiletData;
      await createProductAndItem('toilet', productDetails, { quantity, location, cost });
      totalCreated++;
      console.log(`   ✅ Created toilet: ${productDetails.brand} ${productDetails.model}`);
    }

    // Create base items
    console.log('\n🛁 Creating shower base items...');
    for (const baseData of sampleData.bases) {
      const { quantity, location, cost, ...productDetails } = baseData;
      await createProductAndItem('base', productDetails, { quantity, location, cost });
      totalCreated++;
      console.log(`   ✅ Created base: ${productDetails.brand} ${productDetails.model}`);
    }

    // Create tub items
    console.log('\n🛀 Creating tub items...');
    for (const tubData of sampleData.tubs) {
      const { quantity, location, cost, ...productDetails } = tubData;
      await createProductAndItem('tub', productDetails, { quantity, location, cost });
      totalCreated++;
      console.log(`   ✅ Created tub: ${productDetails.brand} ${productDetails.model}`);
    }

    // Create vanity items
    console.log('\n🪞 Creating vanity items...');
    for (const vanityData of sampleData.vanities) {
      const { quantity, location, cost, ...productDetails } = vanityData;
      await createProductAndItem('vanity', productDetails, { quantity, location, cost });
      totalCreated++;
      console.log(`   ✅ Created vanity: ${productDetails.brand} ${productDetails.model}`);
    }

    // Create shower door items
    console.log('\n🚪 Creating shower door items...');
    for (const doorData of sampleData.shower_doors) {
      const { quantity, location, cost, ...productDetails } = doorData;
      await createProductAndItem('shower_door', productDetails, { quantity, location, cost });
      totalCreated++;
      console.log(`   ✅ Created shower door: ${productDetails.brand} ${productDetails.model}`);
    }

    // Create raw material items
    console.log('\n🧱 Creating raw material items...');
    for (const materialData of sampleData.raw_materials) {
      const { quantity, location, cost, ...productDetails } = materialData;
      await createProductAndItem('raw_material', productDetails, { quantity, location, cost });
      totalCreated++;
      console.log(`   ✅ Created material: ${productDetails.brand} ${productDetails.name}`);
    }

    // Create accessory items
    console.log('\n🔧 Creating accessory items...');
    for (const accessoryData of sampleData.accessories) {
      const { quantity, location, cost, ...productDetails } = accessoryData;
      await createProductAndItem('accessory', productDetails, { quantity, location, cost });
      totalCreated++;
      console.log(`   ✅ Created accessory: ${productDetails.brand} ${productDetails.name}`);
    }

    // Create miscellaneous items
    console.log('\n📦 Creating miscellaneous items...');
    for (const miscData of sampleData.miscellaneous) {
      const { quantity, location, cost, ...productDetails } = miscData;
      await createProductAndItem('miscellaneous', productDetails, { quantity, location, cost });
      totalCreated++;
      console.log(`   ✅ Created misc: ${productDetails.brand} ${productDetails.name}`);
    }

    const finalCount = await Item.countDocuments();
    console.log(`\n🎉 Sample data population completed!`);
    console.log(`📊 Total items created: ${totalCreated}`);
    console.log(`📊 Final item count: ${finalCount}`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Run SKU migration: node scripts/migrate-skus.js`);
    console.log(`   2. Check frontend inventory display`);
    
  } catch (error) {
    console.error('❌ Error during population:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDB();
    await populateDatabase();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

if (require.main === module) {
  main();
}

module.exports = { populateDatabase, sampleData };
