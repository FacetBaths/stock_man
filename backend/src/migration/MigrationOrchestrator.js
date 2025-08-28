/**
 * Migration Orchestrator - Main class for legacy MongoDB to new schema migration
 * 
 * Handles the complete migration process:
 * 1. Extract data from legacy MongoDB dump
 * 2. Transform to new schema structure
 * 3. Validate transformed data
 * 4. Load to new MongoDB database
 */

const fs = require('fs').promises;
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { execSync } = require('child_process');
const DataValidator = require('./validators/DataValidator');

class MigrationOrchestrator {
  constructor(options = {}) {
    this.options = {
      dumpPath: options.dumpPath || 'dump/stock_manager',
      mongoUri: options.mongoUri || process.env.MONGODB_URI,
      backupDir: options.backupDir || 'migration_backup',
      dryRun: options.dryRun || false,
      batchSize: options.batchSize || 1000,
      ...options
    };

    this.validator = new DataValidator({ strictMode: false });
    this.stats = {
      startTime: null,
      endTime: null,
      categories: { processed: 0, created: 0, errors: 0 },
      skus: { processed: 0, created: 0, errors: 0 },
      instances: { processed: 0, created: 0, errors: 0 },
      inventory: { processed: 0, created: 0, errors: 0 },
      totalErrors: 0,
      totalWarnings: 0
    };

    this.transformedData = {
      categories: [],
      skus: [],
      instances: [],
      inventory: [],
      users: []
    };

    // Product type to category name mapping
    this.productTypeMapping = {
      'accessory': 'accessories',
      'wall': 'walls',
      'toilet': 'toilets',
      'base': 'bases',
      'tub': 'tubs',
      'vanity': 'vanities',
      'shower door': 'shower doors',
      'showerdoor': 'shower doors',
      'raw material': 'raw materials',
      'miscellaneous': 'miscellaneous'
    };
  }

  /**
   * Run the complete migration process
   */
  async runMigration() {
    console.log('🚀 Starting MongoDB Schema Migration');
    console.log('=====================================');
    
    this.stats.startTime = new Date();

    try {
      // Stage 1: Environment validation and setup
      await this.validateEnvironment();
      await this.createBackupDirectory();

      // Stage 2: Data extraction from BSON dumps
      console.log('\\n📦 Stage 2: Extracting data from BSON dumps...');
      const legacyData = await this.extractLegacyData();

      // Stage 3: Data transformation
      console.log('\\n🔄 Stage 3: Transforming data to new schema...');
      await this.transformData(legacyData);

      // Stage 4: Data validation
      console.log('\\n✅ Stage 4: Validating transformed data...');
      const validationResult = await this.validator.validateTransformedData(this.transformedData);
      
      if (!validationResult.isValid) {
        console.warn(`⚠️  Data validation found ${validationResult.errors.length} issues - proceeding anyway for development migration`);
        console.log('Validation errors:', validationResult.errors.slice(0, 3)); // Show first 3 errors
        this.stats.totalWarnings += validationResult.errors.length;
      }

      if (this.options.dryRun) {
        console.log('\\n🧪 DRY RUN MODE - Skipping database operations');
        this.stats.endTime = new Date(); // Set end time for dry run
        this.generateMigrationReport();
        return;
      }

      // Stage 5: Database operations
      console.log('\\n💾 Stage 5: Loading data to MongoDB...');
      await this.loadToMongoDB();

      // Stage 6: Final validation
      console.log('\\n🔍 Stage 6: Post-migration validation...');
      await this.validateMigration();

      this.stats.endTime = new Date();
      this.generateMigrationReport();

      console.log('\\n🎉 Migration completed successfully!');
      
    } catch (error) {
      this.stats.endTime = new Date();
      this.stats.totalErrors++;
      console.error('\\n❌ Migration failed:', error.message);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  /**
   * Validate environment and prerequisites
   */
  async validateEnvironment() {
    console.log('🔍 Stage 1: Validating environment...');

    // Check if dump directory exists
    const dumpExists = await fs.access(this.options.dumpPath).then(() => true).catch(() => false);
    if (!dumpExists) {
      throw new Error(`Dump directory not found: ${this.options.dumpPath}`);
    }

    // Check MongoDB URI
    if (!this.options.mongoUri) {
      throw new Error('MongoDB URI not provided');
    }

    // Test MongoDB connection
    const client = new MongoClient(this.options.mongoUri);
    try {
      await client.connect();
      await client.db().admin().ping();
      console.log('✅ MongoDB connection verified');
      await client.close();
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }

    // Check required BSON files (categories is optional since we can create from SKUs)
    const requiredFiles = ['skus.bson', 'items.bson'];
    for (const file of requiredFiles) {
      const filePath = path.join(this.options.dumpPath, file);
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        throw new Error(`Required BSON file not found: ${filePath}`);
      }
    }

    // Check if categories.bson exists (optional)
    const categoriesPath = path.join(this.options.dumpPath, 'categories.bson');
    const categoriesExists = await fs.access(categoriesPath).then(() => true).catch(() => false);
    if (!categoriesExists) {
      console.log('ℹ️  categories.bson not found - will create categories from SKU product_type_model');
    }

    console.log('✅ Environment validation passed');
  }

  /**
   * Create backup directory for migration artifacts
   */
  async createBackupDirectory() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupPath = path.join(this.options.backupDir, `migration_${timestamp}`);
    
    await fs.mkdir(this.backupPath, { recursive: true });
    console.log(`📁 Backup directory created: ${this.backupPath}`);
  }

  /**
   * Extract data from legacy BSON dump files
   */
  async extractLegacyData() {
    const legacyData = {
      categories: await this.extractFromBSON('categories.bson'),
      skus: await this.extractFromBSON('skus.bson'),
      items: await this.extractFromBSON('items.bson'),
      walls: await this.extractFromBSON('walls.bson'),
      toilets: await this.extractFromBSON('toilets.bson'),
      bases: await this.extractFromBSON('bases.bson'),
      tubs: await this.extractFromBSON('tubs.bson'),
      vanities: await this.extractFromBSON('vanities.bson'),
      showerdoors: await this.extractFromBSON('showerdoors.bson'),
      accessories: await this.extractFromBSON('accessories.bson'),
      rawmaterials: await this.extractFromBSON('rawmaterials.bson'),
      miscellaneous: await this.extractFromBSON('miscellaneous.bson'),
      users: await this.extractFromBSON('users.bson').catch(() => []) // Optional
    };

    console.log('📊 Extraction Summary:');
    Object.entries(legacyData).forEach(([key, data]) => {
      console.log(`  ${key}: ${Array.isArray(data) ? data.length : 0} records`);
    });

    return legacyData;
  }

  /**
   * Extract data from a single BSON file
   */
  async extractFromBSON(filename) {
    const filePath = path.join(this.options.dumpPath, filename);
    
    // Check if file exists first
    try {
      await fs.access(filePath);
    } catch (error) {
      console.log(`ℹ️  Optional file not found: ${filename}`);
      return [];
    }
    
    try {
      // Use bsondump to convert BSON to JSON
      const result = execSync(`bsondump "${filePath}"`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
      
      // Parse each line as JSON, filtering out status messages
      const lines = result.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.includes('objects found') && 
               !trimmed.includes('write /dev/stdout: broken pipe') &&
               trimmed.startsWith('{');
      });
      
      const data = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          console.warn(`Warning: Could not parse line from ${filename}:`, error.message);
          console.warn(`Line content (first 200 chars): ${line.substring(0, 200)}`);
          return null;
        }
      }).filter(item => item !== null);

      return data;
      
    } catch (error) {
      throw new Error(`Failed to extract ${filename}: ${error.message}`);
    }
  }

  /**
   * Transform legacy data to new schema structure
   */
  async transformData(legacyData) {
    // Transform categories (create from SKUs if categories is empty)
    await this.transformCategories(legacyData.categories, legacyData.skus);

    // Build product details lookup map
    const productDetailsMap = this.buildProductDetailsMap(legacyData);

    // Transform SKUs with consolidated product details
    await this.transformSKUs(legacyData.skus, productDetailsMap);

    // Create temporary SKU for unassigned items
    await this.createUnassignedItemsSKU();

    // Transform items to instances (including unassigned ones)
    await this.transformItemsToInstances(legacyData.items);

    // Calculate inventory from instances
    await this.calculateInventory();

    // Transform users (optional)
    if (legacyData.users && legacyData.users.length > 0) {
      this.transformedData.users = legacyData.users.filter(user => user.username && user.email);
    }

    console.log('🔄 Transformation Summary:');
    console.log(`  Categories: ${this.transformedData.categories.length}`);
    console.log(`  SKUs: ${this.transformedData.skus.length}`);  
    console.log(`  Instances: ${this.transformedData.instances.length}`);
    console.log(`  Inventory: ${this.transformedData.inventory.length}`);
    console.log(`  Users: ${this.transformedData.users.length}`);
  }

  /**
   * Transform categories - create from SKU product_type_model since categories collection is empty
   */
  async transformCategories(categories, skus) {
    const existingCategoryNames = new Set();
    
    // If we have existing categories, transform them normally
    if (categories && categories.length > 0) {
      console.log('📋 Transforming existing categories...');
      for (const category of categories) {
        try {
          if (category.name === 'tools') {
            console.log('ℹ️  Skipping invalid "tools" category (will be recreated properly later)');
            continue;
          }

          const categoryName = category.name.toLowerCase().trim();
          
          // Check for duplicates
          if (existingCategoryNames.has(categoryName)) {
            console.log(`ℹ️  Skipping duplicate category: ${categoryName}`);
            continue;
          }
          
          const transformedCategory = {
            _id: category._id,
            name: categoryName,
            type: 'product',
            description: category.description || '',
            attributes: category.attributes || [],
            sort_order: category.sort_order || 0,
            status: category.status || 'active',
            createdAt: category.createdAt || new Date(),
            updatedAt: category.updatedAt || new Date()
          };

          this.transformedData.categories.push(transformedCategory);
          existingCategoryNames.add(categoryName);
          this.stats.categories.processed++;
        } catch (error) {
          console.error(`Error transforming category ${category._id}:`, error.message);
          this.stats.categories.errors++;
        }
      }
    } else {
      // Create categories from SKU product_type_model
      console.log('📋 Categories collection is empty, creating from SKU product_type_model values...');
      
      const productTypes = new Set();
      skus.forEach(sku => {
        if (sku.product_type_model) {
          productTypes.add(sku.product_type_model);
        }
      });

      console.log('📦 Found product types:', Array.from(productTypes));

      let sortOrder = 1;
      for (const productType of productTypes) {
        try {
          const categoryName = productType.toLowerCase();
          
          // Check for duplicates (shouldn't happen with Set, but safety check)
          if (existingCategoryNames.has(categoryName)) {
            console.log(`ℹ️  Skipping duplicate category from SKU: ${categoryName}`);
            continue;
          }
          
          const transformedCategory = {
            _id: { $oid: require('crypto').randomBytes(12).toString('hex') },
            name: categoryName,
            type: 'product',
            description: this.generateCategoryDescription(productType),
            attributes: this.getCategoryAttributes(productType),
            sort_order: sortOrder++,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          this.transformedData.categories.push(transformedCategory);
          existingCategoryNames.add(categoryName);
          this.stats.categories.processed++;
        } catch (error) {
          console.error(`Error creating category for ${productType}:`, error.message);
          this.stats.categories.errors++;
        }
      }
    }

    this.stats.categories.created = this.transformedData.categories.length;
    console.log(`✅ Categories processed: ${this.stats.categories.created}/${this.stats.categories.processed}`);
  }

  /**
   * Generate description for a category based on product type
   */
  generateCategoryDescription(productType) {
    const descriptions = {
      'Wall': 'Wall panels and components',
      'Accessory': 'Hardware and accessories',
      'RawMaterial': 'Raw materials and supplies',
      'Base': 'Base units and foundations',
      'Tub': 'Bathtubs and tub components',
      'Toilet': 'Toilet fixtures and components',
      'Vanity': 'Bathroom vanities and cabinets',
      'ShowerDoor': 'Shower doors and enclosures',
      'Miscellaneous': 'Other miscellaneous items'
    };
    
    return descriptions[productType] || `${productType} products and components`;
  }

  /**
   * Get attributes for a category based on product type
   */
  getCategoryAttributes(productType) {
    const attributes = {
      'Wall': ['product_line', 'color_name', 'dimensions', 'finish'],
      'Accessory': ['brand', 'model'],
      'RawMaterial': ['material_type', 'grade'],
      'Base': ['brand', 'model', 'color', 'dimensions'],
      'Tub': ['brand', 'model', 'color', 'dimensions'],
      'Toilet': ['brand', 'model', 'color', 'dimensions'],
      'Vanity': ['brand', 'model', 'color', 'dimensions', 'finish'],
      'ShowerDoor': ['brand', 'model', 'dimensions'],
      'Miscellaneous': []
    };
    
    return attributes[productType] || [];
  }

  /**
   * Build lookup map for product details from various collections
   */
  buildProductDetailsMap(legacyData) {
    const detailsMap = new Map();

    // Combine all product detail collections
    const productCollections = [
      { name: 'walls', data: legacyData.walls },
      { name: 'toilets', data: legacyData.toilets },
      { name: 'bases', data: legacyData.bases },
      { name: 'tubs', data: legacyData.tubs },
      { name: 'vanities', data: legacyData.vanities },
      { name: 'showerdoors', data: legacyData.showerdoors },
      { name: 'accessories', data: legacyData.accessories },
      { name: 'rawmaterials', data: legacyData.rawmaterials },
      { name: 'miscellaneous', data: legacyData.miscellaneous }
    ];

    productCollections.forEach(({ name, data }) => {
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item._id) {
            detailsMap.set(item._id.$oid, {
              collectionType: name,
              details: item
            });
          }
        });
      }
    });

    console.log(`📋 Built product details map: ${detailsMap.size} entries`);
    return detailsMap;
  }

  /**
   * Transform SKUs with consolidated product details
   */
  async transformSKUs(skus, productDetailsMap) {
    // Create category lookup map
    const categoryMap = new Map();
    this.transformedData.categories.forEach(cat => {
      categoryMap.set(cat.name, cat._id);
    });

    for (const sku of skus) {
      try {
        // Get product details
        let productDetails = null;
        let categoryId = null;

        if (sku.product_details && sku.product_details.$oid) {
          const detailsEntry = productDetailsMap.get(sku.product_details.$oid);
          if (detailsEntry) {
            productDetails = detailsEntry.details;
            
            // Map category based on collection type
            const categoryName = this.productTypeMapping[detailsEntry.collectionType] || detailsEntry.collectionType;
            categoryId = categoryMap.get(categoryName);
          }
        }

        // Generate SKU name from details
        const skuName = this.generateSKUName(productDetails, sku);

        // Transform cost history
        const costHistory = (sku.cost_history || []).map(entry => ({
          cost: entry.cost || 0,
          effective_date: entry.effective_date || sku.createdAt,
          updated_by: entry.updated_by || 'migration',
          notes: entry.notes || 'Migrated from legacy system'
        }));

        // Create transformed SKU
        const transformedSKU = {
          _id: sku._id,
          sku_code: sku.sku_code,
          category_id: categoryId,
          name: skuName,
          description: sku.description || '',
          brand: sku.manufacturer_model?.split(' ')[0] || '',
          model: sku.manufacturer_model || '',
          details: this.transformProductDetails(productDetails, sku.product_type),
          unit_cost: sku.current_cost || 0,
          cost_history: costHistory,
          status: sku.status || 'active',
          barcode: sku.barcode || '',
          supplier_info: {
            supplier_name: '',
            supplier_sku: '',
            lead_time_days: 0
          },
          stock_thresholds: {
            understocked: sku.stock_thresholds?.understocked || 5,
            overstocked: sku.stock_thresholds?.overstocked || 100
          },
          is_bundle: sku.is_bundle || false,
          bundle_items: sku.bundle_items || [],
          created_by: sku.created_by || 'migration',
          last_updated_by: sku.last_updated_by || 'migration',
          createdAt: sku.createdAt || new Date(),
          updatedAt: sku.updatedAt || new Date()
        };

        this.transformedData.skus.push(transformedSKU);
        this.stats.skus.processed++;

      } catch (error) {
        console.error(`Error transforming SKU ${sku._id}:`, error.message);
        this.stats.skus.errors++;
      }
    }

    this.stats.skus.created = this.transformedData.skus.length;
    console.log(`✅ SKUs transformed: ${this.stats.skus.created}/${this.stats.skus.processed}`);
  }

  /**
   * Generate SKU name from product details
   */
  generateSKUName(productDetails, sku) {
    if (!productDetails) {
      return sku.sku_code || 'Unknown Product';
    }

    // Wall products
    if (productDetails.product_line && productDetails.color_name) {
      const parts = [
        productDetails.product_line,
        productDetails.color_name,
        productDetails.dimensions,
        productDetails.finish
      ].filter(Boolean);
      
      return parts.join(' ');
    }

    // Other products - try to build name from available fields
    const nameFields = [
      productDetails.brand,
      productDetails.model,
      productDetails.name,
      productDetails.description
    ].filter(Boolean);

    return nameFields.length > 0 ? nameFields[0] : sku.sku_code || 'Unknown Product';
  }

  /**
   * Transform product details for embedding in SKU
   */
  transformProductDetails(productDetails, productType) {
    if (!productDetails) {
      return {};
    }

    // Remove MongoDB metadata
    const { _id, __v, createdAt, updatedAt, ...cleanDetails } = productDetails;

    return cleanDetails;
  }

  /**
   * Create a temporary SKU for items that don't have an assigned SKU
   */
  async createUnassignedItemsSKU() {
    // Find or create "miscellaneous" category for unassigned items
    let miscellaneousCategory = this.transformedData.categories.find(cat => cat.name === 'miscellaneous');
    
    if (!miscellaneousCategory) {
      // Create miscellaneous category if it doesn't exist
      miscellaneousCategory = {
        _id: { $oid: require('crypto').randomBytes(12).toString('hex') },
        name: 'miscellaneous',
        type: 'product',
        description: 'Miscellaneous items and unassigned products',
        attributes: [],
        sort_order: 999, // Put at end
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.transformedData.categories.push(miscellaneousCategory);
      console.log('📋 Created miscellaneous category for unassigned items');
    }

    // Create the temporary unassigned items SKU
    const unassignedSKU = {
      _id: { $oid: require('crypto').randomBytes(12).toString('hex') },
      sku_code: 'UNASSIGNED',
      category_id: miscellaneousCategory._id,
      name: 'Unassigned Items',
      description: 'Temporary SKU for items that do not have an assigned SKU. These items should be reviewed and reassigned to appropriate SKUs.',
      brand: '',
      model: '',
      details: {
        product_type: 'unassigned',
        migration_notes: 'This is a temporary SKU created during migration for items without proper SKU assignments'
      },
      unit_cost: 0,
      cost_history: [{
        cost: 0,
        effective_date: new Date(),
        updated_by: 'migration',
        notes: 'Initial cost for unassigned items SKU'
      }],
      status: 'active',
      barcode: '',
      supplier_info: {
        supplier_name: '',
        supplier_sku: '',
        lead_time_days: 0
      },
      stock_thresholds: {
        understocked: 0,
        overstocked: 999999 // High threshold since this is temporary
      },
      is_bundle: false,
      bundle_items: [],
      created_by: 'migration',
      last_updated_by: 'migration',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.transformedData.skus.push(unassignedSKU);
    this.unassignedSKUID = unassignedSKU._id;
    
    console.log('📦 Created temporary SKU for unassigned items: UNASSIGNED');
  }

  /**
   * Transform items to individual instances
   */
  async transformItemsToInstances(items) {
    const skuMap = new Map();
    this.transformedData.skus.forEach(sku => {
      if (sku._id.$oid) {
        skuMap.set(sku._id.$oid, sku);
      }
    });

    let unassignedItemsCount = 0;

    for (const item of items) {
      try {
        // Parse quantity from MongoDB format (could be {$numberInt: "6"} or plain number)
        let quantity = 0;
        if (item.quantity) {
          if (typeof item.quantity === 'object' && item.quantity.$numberInt) {
            quantity = parseInt(item.quantity.$numberInt, 10);
          } else if (typeof item.quantity === 'number') {
            quantity = item.quantity;
          } else {
            quantity = parseInt(item.quantity, 10) || 0;
          }
        }
        
        // Skip items with zero quantity
        if (quantity === 0) {
          console.warn(`Skipping item ${item._id.$oid}: zero quantity`);
          continue;
        }

        let targetSKUID = null;
        let isUnassigned = false;

        // Check if item has a valid SKU assignment
        if (item.sku_id && item.sku_id.$oid) {
          const skuId = item.sku_id.$oid;
          if (skuMap.has(skuId)) {
            targetSKUID = item.sku_id;
          } else {
            // SKU referenced but doesn't exist - assign to unassigned SKU
            console.warn(`Item ${item._id.$oid} references non-existent SKU ${skuId}, assigning to UNASSIGNED`);
            targetSKUID = this.unassignedSKUID;
            isUnassigned = true;
            unassignedItemsCount += quantity;
          }
        } else {
          // No SKU assigned - assign to unassigned SKU
          console.warn(`Item ${item._id.$oid} has no SKU assigned, assigning to UNASSIGNED`);
          targetSKUID = this.unassignedSKUID;
          isUnassigned = true;
          unassignedItemsCount += quantity;
        }

        // Create individual instances for each quantity unit
        for (let i = 0; i < quantity; i++) {
          // Parse cost from MongoDB format
          let cost = 0;
          if (item.cost) {
            if (typeof item.cost === 'object' && item.cost.$numberInt) {
              cost = parseInt(item.cost.$numberInt, 10);
            } else if (typeof item.cost === 'number') {
              cost = item.cost;
            } else {
              cost = parseFloat(item.cost) || 0;
            }
          }

          const instance = {
            sku_id: targetSKUID,
            acquisition_date: item.createdAt || new Date(),
            acquisition_cost: cost,
            tag_id: null, // All instances start as available
            location: item.location || 'HQ',
            supplier: '',
            reference_number: '',
            notes: isUnassigned ? 
              `UNASSIGNED: Migrated from legacy item ${item._id.$oid} (instance ${i + 1}/${quantity}). Original SKU: ${item.sku_id?.$oid || 'none'}. Requires manual SKU assignment.` :
              `Migrated from legacy item ${item._id.$oid}. Instance ${i + 1} of ${quantity}`,
            added_by: 'migration'
          };

          this.transformedData.instances.push(instance);
        }

        this.stats.instances.processed += quantity;

      } catch (error) {
        console.error(`Error transforming item ${item._id}:`, error.message);
        this.stats.instances.errors++;
      }
    }

    this.stats.instances.created = this.transformedData.instances.length;
    
    if (unassignedItemsCount > 0) {
      console.log(`⚠️  ${unassignedItemsCount} instances were assigned to temporary UNASSIGNED SKU`);
      this.stats.totalWarnings++;
    }
    
    console.log(`✅ Instances created: ${this.stats.instances.created} from ${items.length} items`);
  }

  /**
   * Calculate inventory aggregations from instances
   */
  async calculateInventory() {
    const inventoryMap = new Map();

    // Group instances by SKU ID
    this.transformedData.instances.forEach(instance => {
      let skuId;
      if (instance.sku_id && typeof instance.sku_id === 'object' && instance.sku_id.$oid) {
        skuId = instance.sku_id.$oid;
      } else if (typeof instance.sku_id === 'string') {
        skuId = instance.sku_id;
      } else {
        console.warn('Instance has invalid sku_id format:', instance.sku_id);
        return;
      }
      
      if (!inventoryMap.has(skuId)) {
        inventoryMap.set(skuId, {
          instances: [],
          totalCost: 0
        });
      }

      const entry = inventoryMap.get(skuId);
      entry.instances.push(instance);
      entry.totalCost += instance.acquisition_cost || 0;
    });

    // Create inventory records
    for (const [skuId, data] of inventoryMap) {
      try {
        const totalQuantity = data.instances.length;
        const averageCost = totalQuantity > 0 ? data.totalCost / totalQuantity : 0;

        const inventory = {
          sku_id: { $oid: skuId },
          total_quantity: totalQuantity,
          available_quantity: totalQuantity, // All instances start available
          reserved_quantity: 0,
          broken_quantity: 0,
          loaned_quantity: 0,
          minimum_stock_level: 5, // Default
          reorder_point: 5,
          maximum_stock_level: 100,
          total_value: data.totalCost,
          average_cost: averageCost,
          is_active: true,
          is_low_stock: totalQuantity <= 5,
          is_out_of_stock: totalQuantity === 0,
          is_overstock: totalQuantity > 100,
          last_movement_date: new Date(),
          last_updated_by: 'migration'
        };

        this.transformedData.inventory.push(inventory);
        this.stats.inventory.processed++;

      } catch (error) {
        console.error(`Error calculating inventory for SKU ${skuId}:`, error.message);
        this.stats.inventory.errors++;
      }
    }

    this.stats.inventory.created = this.transformedData.inventory.length;
    console.log(`✅ Inventory calculated: ${this.stats.inventory.created} records`);
  }

  /**
   * Load transformed data to MongoDB
   */
  async loadToMongoDB() {
    const client = new MongoClient(this.options.mongoUri);
    
    try {
      await client.connect();
      const db = client.db();

      console.log('🗄️  Clearing existing collections...');
      
      // Clear existing collections
      const collections = ['categories', 'skus', 'instances', 'inventory'];
      for (const collectionName of collections) {
        try {
          await db.collection(collectionName).deleteMany({});
          console.log(`  ✅ Cleared ${collectionName}`);
        } catch (error) {
          console.log(`  ℹ️  Collection ${collectionName} doesn't exist yet`);
        }
      }

      // Load data in dependency order
      await this.loadCollection(db, 'categories', this.transformedData.categories);
      await this.loadCollection(db, 'skus', this.transformedData.skus);
      await this.loadCollection(db, 'instances', this.transformedData.instances);
      await this.loadCollection(db, 'inventory', this.transformedData.inventory);

      if (this.transformedData.users.length > 0) {
        await this.loadCollection(db, 'users', this.transformedData.users);
      }

      console.log('✅ All data loaded successfully');

    } finally {
      await client.close();
    }
  }

  /**
   * Convert BSON-style ObjectIds to actual ObjectIds for MongoDB storage
   */
  convertObjectIds(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertObjectIds(item));
    }

    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        if (value.$oid) {
          // Convert {$oid: "string"} to ObjectId
          converted[key] = new ObjectId(value.$oid);
        } else {
          // Recursively convert nested objects
          converted[key] = this.convertObjectIds(value);
        }
      } else {
        converted[key] = value;
      }
    }
    return converted;
  }

  /**
   * Load a single collection with batch processing
   */
  async loadCollection(db, collectionName, data) {
    if (!data || data.length === 0) {
      console.log(`  ℹ️  No data to load for ${collectionName}`);
      return;
    }

    const collection = db.collection(collectionName);
    const batches = [];
    
    // Convert ObjectIds and split data into batches
    const convertedData = data.map(doc => this.convertObjectIds(doc));
    
    for (let i = 0; i < convertedData.length; i += this.options.batchSize) {
      batches.push(convertedData.slice(i, i + this.options.batchSize));
    }

    console.log(`  📦 Loading ${data.length} documents to ${collectionName} in ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      await collection.insertMany(batches[i], { ordered: false });
      console.log(`    ✅ Batch ${i + 1}/${batches.length} completed`);
    }

    console.log(`  ✅ ${collectionName}: ${data.length} documents loaded`);
  }

  /**
   * Validate migration results
   */
  async validateMigration() {
    const client = new MongoClient(this.options.mongoUri);
    
    try {
      await client.connect();
      const db = client.db();

      // Count documents in each collection
      const counts = {
        categories: await db.collection('categories').countDocuments(),
        skus: await db.collection('skus').countDocuments(),
        instances: await db.collection('instances').countDocuments(),
        inventory: await db.collection('inventory').countDocuments()
      };

      console.log('📊 Post-migration collection counts:');
      Object.entries(counts).forEach(([collection, count]) => {
        console.log(`  ${collection}: ${count} documents`);
      });

      // Validate data integrity
      const skusWithoutCategory = await db.collection('skus').countDocuments({ category_id: null });
      const instancesWithoutSKU = await db.collection('instances').countDocuments({ sku_id: null });
      const inventoryMismatches = await this.validateInventoryIntegrity(db);

      if (skusWithoutCategory > 0) {
        console.warn(`⚠️  ${skusWithoutCategory} SKUs have no category assigned`);
        this.stats.totalWarnings++;
      }

      if (instancesWithoutSKU > 0) {
        console.warn(`⚠️  ${instancesWithoutSKU} instances have no SKU assigned`);
        this.stats.totalWarnings++;
      }

      if (inventoryMismatches > 0) {
        console.warn(`⚠️  ${inventoryMismatches} inventory records have calculation mismatches`);
        this.stats.totalWarnings++;
      }

      console.log('✅ Post-migration validation complete');

    } finally {
      await client.close();
    }
  }

  /**
   * Validate inventory calculations match instance counts
   */
  async validateInventoryIntegrity(db) {
    const pipeline = [
      {
        $lookup: {
          from: 'instances',
          localField: 'sku_id',
          foreignField: 'sku_id',
          as: 'actual_instances'
        }
      },
      {
        $addFields: {
          actual_count: { $size: '$actual_instances' },
          recorded_count: '$total_quantity'
        }
      },
      {
        $match: {
          $expr: { $ne: ['$actual_count', '$recorded_count'] }
        }
      }
    ];

    const mismatches = await db.collection('inventory').aggregate(pipeline).toArray();
    return mismatches.length;
  }

  /**
   * Generate comprehensive migration report
   */
  generateMigrationReport() {
    const duration = this.stats.endTime ? 
      ((this.stats.endTime - this.stats.startTime) / 1000).toFixed(2) : 'N/A';

    console.log('\\n📊 MIGRATION REPORT');
    console.log('===================');
    console.log(`Start Time: ${this.stats.startTime?.toISOString()}`);
    console.log(`End Time: ${this.stats.endTime?.toISOString()}`);
    console.log(`Duration: ${duration} seconds`);
    console.log(`Dry Run: ${this.options.dryRun ? 'Yes' : 'No'}`);
    console.log('');

    console.log('📈 TRANSFORMATION STATISTICS:');
    Object.entries(this.stats).forEach(([key, value]) => {
      if (typeof value === 'object' && value.processed !== undefined) {
        console.log(`  ${key.toUpperCase()}:`);
        console.log(`    Processed: ${value.processed}`);
        console.log(`    Created: ${value.created}`);
        console.log(`    Errors: ${value.errors}`);
        console.log(`    Success Rate: ${value.processed > 0 ? ((value.created / value.processed) * 100).toFixed(1) : 0}%`);
        console.log('');
      }
    });

    console.log(`Total Errors: ${this.stats.totalErrors}`);
    console.log(`Total Warnings: ${this.stats.totalWarnings}`);
    console.log(`Overall Status: ${this.stats.totalErrors === 0 ? '✅ SUCCESS' : '❌ COMPLETED WITH ERRORS'}`);
    console.log('===================');
  }
}

module.exports = MigrationOrchestrator;
