# SCHEMA MAPPING DOCUMENTATION

## Source Data Analysis

### Current JSON File Structure
Based on analysis of the current data.json file and jsonDB.js configuration, the legacy system stores data in the following structure:

```json
{
  "items": [],           // Generic items
  "walls": [],           // Wall products
  "toilets": [],         // Toilet products  
  "bases": [],           // Base products
  "tubs": [],            // Tub products
  "vanities": [],        // Vanity products
  "showerDoors": [],     // Shower door products
  "nextId": 1            // Auto-increment counter
}
```

### Inferred Legacy Schema Structure
From the route analysis and model structure, the legacy JSON entities likely contain:

#### Generic Item Structure:
```javascript
{
  id: String,              // Auto-generated ID
  name: String,            // Product name
  description: String,     // Product description
  category: String,        // Product category
  cost: Number,            // Unit cost
  quantity: Number,        // Available quantity
  location: String,        // Storage location
  supplier: String,        // Supplier name
  created_date: Date,      // Creation date
  updated_date: Date,      // Last update date
  active: Boolean,         // Active status
  // Category-specific fields vary by product type
}
```

#### Product-Specific Fields:

**Walls:**
```javascript
{
  product_line: String,    // Product line name
  color_name: String,      // Color name
  dimensions: String,      // Product dimensions
  finish: String,          // Finish type
}
```

**Tools (inferred from SKU model):**
```javascript
{
  tool_type: String,       // Type of tool
  manufacturer: String,    // Manufacturer name
  serial_number: String,   // Serial number
  voltage: String,         // Voltage specification
  features: [String],      // Feature list
}
```

## Target MongoDB Schema

### Core Models Mapping

#### 1. Category Migration
**Source:** Product type (walls, toilets, bases, etc.)
**Target:** Category model

```javascript
// Legacy JSON categories → MongoDB Category
{
  name: inferCategoryName(productType),        // e.g., "walls" → "walls"
  type: determineProductType(productType),     // "product" for walls, tubs, etc.
  description: generateDescription(productType),
  status: 'active',
  sort_order: getCategorySortOrder(productType)
}
```

**Category Mapping Rules:**
- walls → { name: "walls", type: "product" }
- toilets → { name: "toilets", type: "product" }
- bases → { name: "bases", type: "product" }
- tubs → { name: "tubs", type: "product" }
- vanities → { name: "vanities", type: "product" }
- showerDoors → { name: "shower-doors", type: "product" }
- items → { name: "tools", type: "tool" } (generic items treated as tools)

#### 2. SKU Migration
**Source:** All product arrays (walls, toilets, bases, etc.)
**Target:** SKU model

```javascript
// Legacy products → MongoDB SKU
{
  sku_code: generateSKUCode(legacy.name, legacy.id, categoryName),
  category_id: categoryMapping[productType],
  name: legacy.name,
  description: legacy.description || '',
  brand: legacy.manufacturer || '',
  model: legacy.model || '',
  details: transformProductDetails(legacy, categoryName),
  unit_cost: legacy.cost || 0,
  cost_history: [{
    cost: legacy.cost || 0,
    effective_date: legacy.created_date || new Date(),
    updated_by: 'migration',
    notes: 'Initial migration from JSON database'
  }],
  status: legacy.active ? 'active' : 'discontinued',
  supplier_info: {
    supplier_name: legacy.supplier || '',
    supplier_sku: '',
    lead_time_days: 0
  },
  stock_thresholds: {
    understocked: 5,
    overstocked: 100
  },
  created_by: 'migration',
  last_updated_by: 'migration'
}
```

**SKU Code Generation Rules:**
- Format: `{CATEGORY_PREFIX}-{SANITIZED_NAME}-{LEGACY_ID}`
- Examples:
  - Wall product: `WALL-PREMIUM-MARBLE-001`
  - Tool: `TOOL-CIRCULAR-SAW-042`

#### 3. Instance Migration
**Source:** Product quantities in legacy JSON
**Target:** Instance model (multiple instances per quantity)

```javascript
// For each unit of quantity in legacy product
{
  sku_id: skuMapping[legacyProductId],
  acquisition_date: legacy.created_date || new Date(),
  acquisition_cost: legacy.cost || 0,
  tag_id: null,  // Initially all instances are available
  location: legacy.location || 'HQ',
  supplier: legacy.supplier || '',
  reference_number: '',
  notes: `Migrated from JSON database. Original ID: ${legacy.id}`,
  added_by: 'migration'
}
```

**Instance Creation Logic:**
- Create N instances for each product where N = legacy.quantity
- All instances start as available (tag_id = null)
- Preserve original acquisition cost for each instance

#### 4. Inventory Migration
**Source:** Aggregated from created instances
**Target:** Inventory model (calculated aggregation)

```javascript
// Calculated from Instance records for each SKU
{
  sku_id: skuId,
  total_quantity: instanceCount,
  available_quantity: availableInstanceCount,
  reserved_quantity: 0,    // Initially 0 - no tags yet
  broken_quantity: 0,      // Initially 0
  loaned_quantity: 0,      // Initially 0
  minimum_stock_level: 5,  // Default threshold
  reorder_point: 5,        // Default reorder point
  maximum_stock_level: 100, // Default maximum
  total_value: instanceCount * averageCost,
  average_cost: calculateAverageCost(instances),
  is_active: true,
  last_updated_by: 'migration'
}
```

#### 5. Tag Migration
**Source:** No existing tags in JSON system
**Target:** Tag model (empty initially)

Since the current JSON system doesn't have a tagging system, no tag migration is needed initially. The new system will start with all instances available.

#### 6. User Migration
**Source:** No user system in JSON
**Target:** User model (create default admin)

```javascript
// Create default admin user for migration
{
  username: 'admin',
  email: 'admin@stockmanager.local',
  password: 'temporary_password_123', // To be changed on first login
  firstName: 'System',
  lastName: 'Administrator',
  role: 'admin',
  isActive: true,
  created_by: 'migration'
}
```

## Data Transformation Rules

### 1. Category-Specific Detail Mapping

**Walls:**
```javascript
details: {
  product_line: legacy.product_line || '',
  color_name: legacy.color_name || '',
  dimensions: legacy.dimensions || '',
  finish: legacy.finish || '',
  specifications: extractWallSpecs(legacy)
}
```

**Tools/Items:**
```javascript
details: {
  tool_type: legacy.tool_type || 'general',
  manufacturer: legacy.manufacturer || '',
  serial_number: legacy.serial_number || '',
  voltage: legacy.voltage || '',
  features: legacy.features || [],
  weight: legacy.weight || null,
  specifications: extractToolSpecs(legacy)
}
```

### 2. Data Validation Rules

**Pre-Migration Validation:**
- Verify all required fields are present
- Check for duplicate names within categories
- Validate numeric fields (cost, quantity) are non-negative
- Ensure date fields are valid dates
- Check for orphaned references

**Post-Migration Validation:**
- Verify record counts match between source and target
- Validate all SKU codes are unique
- Ensure all Instances have valid SKU references
- Verify Inventory aggregations match Instance counts
- Check that all Category references are valid

### 3. Error Handling

**Data Quality Issues:**
- Missing names: Generate from description or use placeholder
- Invalid costs: Default to 0 with warning
- Missing categories: Assign to "uncategorized" category
- Invalid dates: Use migration date as fallback
- Duplicate entries: Add suffix to make unique

**Critical Errors (Migration Abort):**
- Database connection failures
- Insufficient disk space
- Permission errors
- Corrupted source data file

## Migration Sequence

### Phase 1: Preparation
1. Create backup of data.json file
2. Validate source data integrity
3. Create MongoDB database and collections
4. Initialize indexes

### Phase 2: Core Data Migration
1. **Categories** (no dependencies)
   - Create predefined categories for each product type
   - Create default "uncategorized" category
   
2. **Users** (no dependencies)
   - Create default admin user
   - Set temporary password requiring change
   
3. **SKUs** (depends on Categories)
   - Process each product array in order
   - Generate unique SKU codes
   - Map category-specific details
   
4. **Instances** (depends on SKUs)
   - Create multiple instances per product quantity
   - Preserve acquisition costs and dates
   - Set initial location information

### Phase 3: Aggregation and Relationships
5. **Inventory** (calculated from Instances)
   - Calculate quantities per SKU
   - Set default thresholds
   - Calculate total values
   
6. **AuditLog** (track migration)
   - Log migration start/completion
   - Log any data quality issues
   - Record transformation statistics

## Rollback Strategy

### Rollback Triggers:
- Migration validation failures
- Critical errors during transformation
- Post-migration data integrity issues
- User-requested rollback

### Rollback Process:
1. Stop application immediately
2. Restore data.json from backup
3. Clear MongoDB collections
4. Restart application with JSON database
5. Log rollback reasons and statistics

## Success Metrics

### Data Completeness
- 100% of JSON records migrated
- No data loss during transformation
- All relationships properly established

### Data Quality
- All SKU codes unique
- No orphaned references
- Valid category assignments
- Proper Instance-Inventory aggregation

### Performance
- Migration completes within expected time
- No memory leaks or resource exhaustion
- Database queries perform within acceptable limits

---

**Document Version:** 1.0  
**Created:** 2025-08-28 15:40 UTC  
**Status:** Ready for Implementation  
**Dependencies:** Requires access to current data.json file
