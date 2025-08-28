/**
 * Data Validation Rules for JSON to MongoDB Migration
 * 
 * This module provides comprehensive validation rules to ensure data integrity
 * during migration from JSON file database to MongoDB.
 */

class DataValidator {
  constructor(options = {}) {
    this.strictMode = options.strictMode || false;
    this.errors = [];
    this.warnings = [];
    this.stats = {
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      warningCount: 0
    };
  }

  /**
   * Validate complete source data before migration
   */
  async validateSourceData(jsonData) {
    console.log('🔍 Starting source data validation...');
    this.resetStats();

    try {
      // Basic structure validation
      this.validateDataStructure(jsonData);
      
      // Validate each product category
      await this.validateProductCategories(jsonData);
      
      // Cross-reference validation
      await this.validateDataConsistency(jsonData);
      
      console.log('✅ Source data validation complete');
      return this.getValidationResult();
      
    } catch (error) {
      this.addError('VALIDATION_CRITICAL', 'Critical validation error', error.message);
      throw error;
    }
  }

  /**
   * Validate basic JSON structure
   */
  validateDataStructure(data) {
    const requiredArrays = ['items', 'walls', 'toilets', 'bases', 'tubs', 'vanities', 'showerDoors'];
    
    if (!data || typeof data !== 'object') {
      this.addError('STRUCTURE_INVALID', 'Data structure', 'Root data is not a valid object');
      return;
    }

    // Check for required arrays
    requiredArrays.forEach(arrayName => {
      if (!Array.isArray(data[arrayName])) {
        this.addError('STRUCTURE_MISSING', `Missing array: ${arrayName}`, 
          `Required array '${arrayName}' is missing or not an array`);
      }
    });

    // Check for nextId
    if (typeof data.nextId !== 'number') {
      this.addWarning('STRUCTURE_WARNING', 'nextId field', 
        'nextId is not a number, using default value');
    }

    console.log(`📋 Data structure validation: ${this.errors.length === 0 ? 'PASSED' : 'FAILED'}`);
  }

  /**
   * Validate each product category
   */
  async validateProductCategories(data) {
    const categories = [
      { name: 'items', array: data.items, type: 'tool' },
      { name: 'walls', array: data.walls, type: 'product' },
      { name: 'toilets', array: data.toilets, type: 'product' },
      { name: 'bases', array: data.bases, type: 'product' },
      { name: 'tubs', array: data.tubs, type: 'product' },
      { name: 'vanities', array: data.vanities, type: 'product' },
      { name: 'showerDoors', array: data.showerDoors, type: 'product' }
    ];

    for (const category of categories) {
      if (Array.isArray(category.array)) {
        await this.validateCategoryProducts(category.name, category.array, category.type);
      }
    }

    console.log(`📦 Product categories validation: ${this.getValidationStatus()}`);
  }

  /**
   * Validate products within a category
   */
  async validateCategoryProducts(categoryName, products, categoryType) {
    if (!products || products.length === 0) {
      this.addWarning('CATEGORY_EMPTY', `Empty category: ${categoryName}`, 
        `Category '${categoryName}' contains no products`);
      return;
    }

    const seenIds = new Set();
    const seenNames = new Set();

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productContext = `${categoryName}[${i}]`;
      
      this.stats.totalRecords++;
      
      try {
        // Basic product structure validation
        const isValid = this.validateProductStructure(product, productContext, categoryType);
        
        // ID uniqueness validation
        this.validateProductId(product, productContext, seenIds);
        
        // Name uniqueness validation (within category)
        this.validateProductName(product, productContext, seenNames);
        
        // Category-specific validation
        this.validateCategorySpecificFields(product, categoryName, productContext);
        
        if (isValid) {
          this.stats.validRecords++;
        } else {
          this.stats.invalidRecords++;
        }
        
      } catch (error) {
        this.addError('PRODUCT_VALIDATION', productContext, error.message);
        this.stats.invalidRecords++;
      }
    }

    console.log(`  └─ ${categoryName}: ${products.length} products, ${this.stats.validRecords} valid`);
  }

  /**
   * Validate basic product structure
   */
  validateProductStructure(product, context, categoryType) {
    let isValid = true;

    // Required fields validation
    const requiredFields = ['name'];
    const recommendedFields = ['description', 'cost', 'quantity'];
    
    requiredFields.forEach(field => {
      if (!product[field] || (typeof product[field] === 'string' && product[field].trim() === '')) {
        this.addError('FIELD_MISSING', `${context}.${field}`, `Required field '${field}' is missing or empty`);
        isValid = false;
      }
    });

    recommendedFields.forEach(field => {
      if (product[field] === undefined || product[field] === null) {
        this.addWarning('FIELD_RECOMMENDED', `${context}.${field}`, 
          `Recommended field '${field}' is missing`);
      }
    });

    // Data type validation
    if (product.cost !== undefined && (typeof product.cost !== 'number' || product.cost < 0)) {
      this.addError('FIELD_INVALID', `${context}.cost`, 'Cost must be a non-negative number');
      isValid = false;
    }

    if (product.quantity !== undefined && (typeof product.quantity !== 'number' || product.quantity < 0)) {
      this.addError('FIELD_INVALID', `${context}.quantity`, 'Quantity must be a non-negative number');
      isValid = false;
    }

    if (product.active !== undefined && typeof product.active !== 'boolean') {
      this.addWarning('FIELD_TYPE', `${context}.active`, 'Active field should be boolean');
    }

    // Date validation
    if (product.created_date && !this.isValidDate(product.created_date)) {
      this.addWarning('FIELD_INVALID', `${context}.created_date`, 'Invalid date format');
    }

    if (product.updated_date && !this.isValidDate(product.updated_date)) {
      this.addWarning('FIELD_INVALID', `${context}.updated_date`, 'Invalid date format');
    }

    return isValid;
  }

  /**
   * Validate product ID uniqueness
   */
  validateProductId(product, context, seenIds) {
    if (product.id) {
      if (seenIds.has(product.id)) {
        this.addError('ID_DUPLICATE', `${context}.id`, `Duplicate ID: ${product.id}`);
      } else {
        seenIds.add(product.id);
      }
    } else {
      this.addWarning('ID_MISSING', `${context}.id`, 'Product has no ID, will generate during migration');
    }
  }

  /**
   * Validate product name uniqueness within category
   */
  validateProductName(product, context, seenNames) {
    if (product.name) {
      const normalizedName = product.name.toLowerCase().trim();
      if (seenNames.has(normalizedName)) {
        this.addWarning('NAME_DUPLICATE', `${context}.name`, 
          `Duplicate name within category: ${product.name}`);
      } else {
        seenNames.add(normalizedName);
      }
    }
  }

  /**
   * Validate category-specific fields
   */
  validateCategorySpecificFields(product, categoryName, context) {
    switch (categoryName) {
      case 'walls':
        this.validateWallFields(product, context);
        break;
      case 'items':
        this.validateToolFields(product, context);
        break;
      default:
        // Generic product validation
        break;
    }
  }

  /**
   * Validate wall-specific fields
   */
  validateWallFields(product, context) {
    const wallFields = ['product_line', 'color_name', 'dimensions', 'finish'];
    
    wallFields.forEach(field => {
      if (product[field] && typeof product[field] !== 'string') {
        this.addWarning('FIELD_TYPE', `${context}.${field}`, 
          `${field} should be a string`);
      }
    });

    // Validate dimensions format if present
    if (product.dimensions && !this.isValidDimension(product.dimensions)) {
      this.addWarning('FIELD_FORMAT', `${context}.dimensions`, 
        'Dimensions format may be invalid');
    }
  }

  /**
   * Validate tool-specific fields
   */
  validateToolFields(product, context) {
    const toolFields = ['tool_type', 'manufacturer', 'serial_number', 'voltage'];
    
    toolFields.forEach(field => {
      if (product[field] && typeof product[field] !== 'string') {
        this.addWarning('FIELD_TYPE', `${context}.${field}`, 
          `${field} should be a string`);
      }
    });

    if (product.features && !Array.isArray(product.features)) {
      this.addWarning('FIELD_TYPE', `${context}.features`, 
        'Features should be an array');
    }
  }

  /**
   * Validate data consistency across categories
   */
  async validateDataConsistency(data) {
    // Check for naming conflicts across categories
    const allNames = new Map(); // name -> [category, index]
    const categories = ['items', 'walls', 'toilets', 'bases', 'tubs', 'vanities', 'showerDoors'];
    
    categories.forEach(categoryName => {
      if (Array.isArray(data[categoryName])) {
        data[categoryName].forEach((product, index) => {
          if (product.name) {
            const normalizedName = product.name.toLowerCase().trim();
            if (allNames.has(normalizedName)) {
              const existing = allNames.get(normalizedName);
              this.addWarning('NAME_CONFLICT', 'Global name conflict', 
                `Name '${product.name}' appears in both ${existing[0]} and ${categoryName}`);
            } else {
              allNames.set(normalizedName, [categoryName, index]);
            }
          }
        });
      }
    });

    // Validate total record counts
    const totalProducts = categories.reduce((sum, cat) => {
      return sum + (Array.isArray(data[cat]) ? data[cat].length : 0);
    }, 0);

    if (totalProducts === 0) {
      this.addError('DATA_EMPTY', 'No products', 'No products found in any category');
    }

    console.log(`🔗 Data consistency validation: ${totalProducts} total products`);
  }

  /**
   * Validate transformed data before MongoDB insertion
   */
  async validateTransformedData(transformedData) {
    console.log('🔍 Validating transformed data...');
    
    const { categories, skus, instances, inventory } = transformedData;
    
    // Validate categories
    await this.validateMongoCategories(categories);
    
    // Validate SKUs
    await this.validateMongoSKUs(skus);
    
    // Validate instances
    await this.validateMongoInstances(instances);
    
    // Validate inventory
    await this.validateMongoInventory(inventory);
    
    // Cross-reference validation
    await this.validateMongoReferences(transformedData);
    
    console.log('✅ Transformed data validation complete');
    return this.getValidationResult();
  }

  /**
   * Validate MongoDB Category documents
   */
  async validateMongoCategories(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      this.addError('MONGO_CATEGORIES', 'Categories array', 'No categories to migrate');
      return;
    }

    const seenNames = new Set();
    
    categories.forEach((category, index) => {
      const context = `Category[${index}]`;
      
      // Required fields
      if (!category.name || !category.type) {
        this.addError('MONGO_FIELD', context, 'Missing required fields: name or type');
      }
      
      // Valid type
      if (category.type && !['product', 'tool'].includes(category.type)) {
        this.addError('MONGO_FIELD', context, `Invalid category type: ${category.type}`);
      }
      
      // Name uniqueness
      if (category.name) {
        if (seenNames.has(category.name)) {
          this.addError('MONGO_DUPLICATE', context, `Duplicate category name: ${category.name}`);
        } else {
          seenNames.add(category.name);
        }
      }
    });
  }

  /**
   * Validate MongoDB SKU documents
   */
  async validateMongoSKUs(skus) {
    if (!Array.isArray(skus) || skus.length === 0) {
      this.addWarning('MONGO_SKUS', 'SKUs array', 'No SKUs to migrate');
      return;
    }

    const seenSkuCodes = new Set();
    
    skus.forEach((sku, index) => {
      const context = `SKU[${index}]`;
      
      // Required fields
      if (!sku.sku_code || !sku.name || !sku.category_id) {
        this.addError('MONGO_FIELD', context, 'Missing required SKU fields');
      }
      
      // SKU code uniqueness
      if (sku.sku_code) {
        if (seenSkuCodes.has(sku.sku_code)) {
          this.addError('MONGO_DUPLICATE', context, `Duplicate SKU code: ${sku.sku_code}`);
        } else {
          seenSkuCodes.add(sku.sku_code);
        }
      }
      
      // Cost validation
      if (sku.unit_cost < 0) {
        this.addError('MONGO_FIELD', context, 'Unit cost cannot be negative');
      }
    });
  }

  /**
   * Validate MongoDB Instance documents
   */
  async validateMongoInstances(instances) {
    if (!Array.isArray(instances)) {
      this.addError('MONGO_INSTANCES', 'Instances array', 'Instances is not an array');
      return;
    }

    instances.forEach((instance, index) => {
      const context = `Instance[${index}]`;
      
      // Required fields
      if (!instance.sku_id || instance.acquisition_cost === undefined) {
        this.addError('MONGO_FIELD', context, 'Missing required instance fields');
      }
      
      // Cost validation
      if (instance.acquisition_cost < 0) {
        this.addError('MONGO_FIELD', context, 'Acquisition cost cannot be negative');
      }
      
      // Date validation
      if (!this.isValidDate(instance.acquisition_date)) {
        this.addError('MONGO_FIELD', context, 'Invalid acquisition date');
      }
    });
  }

  /**
   * Validate MongoDB Inventory documents
   */
  async validateMongoInventory(inventory) {
    if (!Array.isArray(inventory)) {
      this.addError('MONGO_INVENTORY', 'Inventory array', 'Inventory is not an array');
      return;
    }

    inventory.forEach((inv, index) => {
      const context = `Inventory[${index}]`;
      
      // Required fields
      if (!inv.sku_id) {
        this.addError('MONGO_FIELD', context, 'Missing SKU ID');
      }
      
      // Quantity consistency
      const calculated = (inv.available_quantity || 0) + (inv.reserved_quantity || 0) + 
                        (inv.broken_quantity || 0) + (inv.loaned_quantity || 0);
      
      if (Math.abs(calculated - inv.total_quantity) > 0.01) {
        this.addError('MONGO_FIELD', context, 'Inventory quantity calculation mismatch');
      }
    });
  }

  /**
   * Validate cross-references in MongoDB data
   */
  async validateMongoReferences(data) {
    const { categories, skus, instances, inventory } = data;
    
    // Build reference maps
    const categoryIds = new Set(categories.map(c => c._id?.toString()));
    const skuIds = new Set(skus.map(s => s._id?.toString()));
    
    // Validate SKU -> Category references
    skus.forEach((sku, index) => {
      if (sku.category_id && !categoryIds.has(sku.category_id.toString())) {
        this.addError('MONGO_REFERENCE', `SKU[${index}]`, 'Invalid category reference');
      }
    });
    
    // Validate Instance -> SKU references  
    instances.forEach((instance, index) => {
      if (instance.sku_id && !skuIds.has(instance.sku_id.toString())) {
        this.addError('MONGO_REFERENCE', `Instance[${index}]`, 'Invalid SKU reference');
      }
    });
    
    // Validate Inventory -> SKU references
    inventory.forEach((inv, index) => {
      if (inv.sku_id && !skuIds.has(inv.sku_id.toString())) {
        this.addError('MONGO_REFERENCE', `Inventory[${index}]`, 'Invalid SKU reference');
      }
    });
  }

  /**
   * Utility methods
   */
  isValidDate(date) {
    if (!date) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
  }

  isValidDimension(dimension) {
    if (typeof dimension !== 'string') return false;
    // Basic dimension pattern: number x number (with optional units)
    return /^\d+\.?\d*\s*[x×]\s*\d+\.?\d*/.test(dimension.trim());
  }

  /**
   * Error and warning management
   */
  addError(code, context, message) {
    this.errors.push({ code, context, message, timestamp: new Date() });
  }

  addWarning(code, context, message) {
    this.warnings.push({ code, context, message, timestamp: new Date() });
    this.stats.warningCount++;
  }

  resetStats() {
    this.errors = [];
    this.warnings = [];
    this.stats = {
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      warningCount: 0
    };
  }

  getValidationStatus() {
    return this.errors.length === 0 ? 'PASSED' : 'FAILED';
  }

  getValidationResult() {
    return {
      isValid: this.errors.length === 0,
      hasWarnings: this.warnings.length > 0,
      stats: { ...this.stats },
      errors: [...this.errors],
      warnings: [...this.warnings],
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        validRecords: this.stats.validRecords,
        invalidRecords: this.stats.invalidRecords,
        successRate: this.stats.totalRecords > 0 ? 
          (this.stats.validRecords / this.stats.totalRecords * 100).toFixed(2) + '%' : '0%'
      }
    };
  }

  /**
   * Generate detailed validation report
   */
  generateReport() {
    const result = this.getValidationResult();
    
    console.log('\n📊 VALIDATION REPORT');
    console.log('==========================================');
    console.log(`Status: ${result.isValid ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Total Records: ${result.stats.totalRecords}`);
    console.log(`Valid Records: ${result.stats.validRecords}`);
    console.log(`Invalid Records: ${result.stats.invalidRecords}`);
    console.log(`Success Rate: ${result.summary.successRate}`);
    console.log(`Errors: ${result.summary.totalErrors}`);
    console.log(`Warnings: ${result.summary.totalWarnings}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.code}] ${error.context}: ${error.message}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      result.warnings.slice(0, 10).forEach((warning, index) => { // Show first 10
        console.log(`  ${index + 1}. [${warning.code}] ${warning.context}: ${warning.message}`);
      });
      
      if (result.warnings.length > 10) {
        console.log(`  ... and ${result.warnings.length - 10} more warnings`);
      }
    }
    
    console.log('==========================================\n');
    
    return result;
  }
}

module.exports = DataValidator;
