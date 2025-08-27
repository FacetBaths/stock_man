# Stock Manager System Architecture

## Overview

A modern inventory management system for Facet Renovations, built with Vue 3, TypeScript, Express, and MongoDB. Features a clean SKU-centric architecture with individual product instance tracking, supporting both material inventory management and tool lending to installers.

## 🎯 **BUSINESS PURPOSE**

### Core Functions
- **Inventory Management**: Track materials and tools for renovation projects
- **Tool Lending**: Check out company tools to installers with return tracking
- **Material Reservations**: Reserve materials for specific jobs and customers
- **Cost Tracking**: Track acquisition costs at the individual item level
- **Real-time Inventory**: Automatic quantity aggregation with financial valuation

### Key Business Features
- **SKU-centric architecture** - Single source of truth for products
- **Individual instance tracking** - Track acquisition costs and locations per unit
- **Smart tagging system** - Reserve materials and lend tools to installers
- **Bundle/Kit support** - Composite products that create multiple component instances
- **Role-based access control** - Admin/Warehouse (full access), Sales (read-only, no costs)
- **Financial dashboard** - Real-time inventory valuation based on acquisition costs

## 🏗️ **SYSTEM ARCHITECTURE**

### Data Flow
```
Stock Receipt → Instances → Tag Assignment → Tag Fulfillment → Instance Deletion
     ↓              ↓             ↓              ↓              ↓
  Add Stock    Track Costs   Reserve/Lend   Complete Job   Update Totals
     ↓              ↓             ↓              ↓              ↓
Bundle SKUs → Component SKUs → Real-time → Inventory → Financial
Processing      Creation      Tracking    Aggregation   Dashboard
```

### Model Relationships
```
Category ←─── SKU ←─── Instance ←─── Tag
    ↓          ↓         ↓           ↓
 Product    Master    Physical    Status
Organization  Data     Items    Tracking
    ↓          ↓         ↓           ↓
Filtering → Inventory ← Quantities ← User Actions
         Aggregation              ↓
             ↓                AuditLog
        Dashboard            (Tracking)
```

## 📊 **DATABASE MODELS**

### 1. **SKU** - Product Master Data
- **Purpose**: Single source of truth for all product and tool information
- **Key Features**:
  - Unique SKU codes with barcode support
  - Category-based organization (tools vs products)
  - Bundle/kit support for composite products
  - Cost history tracking
  - Product specifications and details
- **Schema Highlights**:
  ```javascript
  {
    sku_code: String (unique, indexed),
    category_id: ObjectId → Category,
    name: String,
    details: { // Polymorphic based on category
      product_line: String, // For wall panels
      color_name: String,
      dimensions: String,
      finish: String,
      tool_type: String,    // For tools
      specifications: Mixed
    },
    unit_cost: Number,
    cost_history: [{ cost, effective_date, updated_by }],
    is_bundle: Boolean,
    bundle_items: [{ sku_id: ObjectId, quantity: Number }],
    status: ['active', 'discontinued', 'pending']
  }
  ```

### 2. **Instance** - Individual Physical Items
- **Purpose**: Track individual units with acquisition costs and locations
- **Key Features**:
  - One record per physical item received
  - Frozen acquisition cost (never changes)
  - Location tracking
  - Tag assignment via tag_id
  - FIFO assignment by acquisition_date
- **Schema Highlights**:
  ```javascript
  {
    sku_id: ObjectId → SKU,
    acquisition_date: Date,
    acquisition_cost: Number, // Frozen at creation
    tag_id: ObjectId → Tag,   // null = available
    location: String,
    supplier: String,
    reference_number: String
  }
  ```
- **Lifecycle**:
  1. Created when stock is received (tag_id: null)
  2. Assigned to tags when allocated (set tag_id)
  3. Deleted when tag is fulfilled (consumed/used)


### 3. **Tag** - Instance-Based Status and Allocation System
- **Purpose**: Manage reservations, tool lending, and status tracking with precise instance control
- **Tag Types**: `reserved`, `loaned`, `broken`, `imperfect`, `stock` *(Note: No "available" type - availability determined by `tag_id: null` on instances)*
- **Key Features**:
  - Links customers/installers to **specific instance arrays**
  - **Single source of truth**: `quantity = selected_instance_ids.length`
  - Supports **precise partial fulfillment**
  - **Manual instance selection** with FIFO/cost-based automation
  - Complete audit trail with exact instance tracking
- **Schema Highlights**:
  ```javascript
  {
    tag_type: ['reserved', 'loaned', 'broken', 'imperfect', 'stock'],
    customer_name: String,     // For reservations
    project_name: String,
    due_date: Date,
    sku_items: [{ 
      sku_id: ObjectId,
      // NEW: Instance-based architecture
      selected_instance_ids: [ObjectId], // Exact instances in this tag
      selection_method: ['auto', 'manual', 'fifo', 'cost_based'],
      notes: String,
      // DEPRECATED: Legacy fields for migration compatibility
      quantity: Number,          // Will be removed after migration
      remaining_quantity: Number // Will be removed after migration
    }],
    status: ['active', 'fulfilled', 'cancelled'],
    created_by: String,
    fulfilled_date: Date
  }
  ```
- **Business Logic**:
  - `assignInstances()`: Assign specific instances to tag (FIFO/cost-based/manual)
  - `fulfillSpecificItems()`: Delete specific instances from arrays, update inventory
  - `isFullyFulfilled()`: Check if all selected_instance_ids arrays are empty

### 4. **Inventory** - Real-time Aggregation
- **Purpose**: Provide fast, accurate inventory levels and financial data per SKU
- **Key Features**:
  - One record per SKU (unique constraint)
  - Real-time quantity tracking by status
  - Financial valuation from instance costs
  - Stock level alerts and thresholds
  - Business logic methods for operations
- **Schema Highlights**:
  ```javascript
  {
    sku_id: ObjectId → SKU (unique),
    total_quantity: Number,     // COUNT of all instances with this sku_id (regardless of tag_id)
    available_quantity: Number, // COUNT of instances with this sku_id where tag_id = null
    reserved_quantity: Number,
    broken_quantity: Number,
    loaned_quantity: Number,    // Tools lent to installers
    total_value: Number,        // Sum of instance acquisition costs
    average_cost: Number,       // Weighted average
    is_low_stock: Boolean,      // Calculated flags
    is_out_of_stock: Boolean,
    minimum_stock_level: Number,
    reorder_point: Number
  }
  ```
- **Key Constraint**: `total_quantity` in inventory = count of instances for that SKU
- **Business Methods**:
  - `reserveQuantity()`, `releaseReservedQuantity()`
  - `addStock()`, `removeStock()`, `moveInventory()`
  - `needsReorder()`, `getSummary()`

### 5. **Category** - Product Organization
- **Purpose**: Organize SKUs for filtering and validation
- **Key Features**:
  - Tool vs Product distinction
  - Required attribute validation
  - Prevents typos in category assignment
  - Display ordering support
- **Schema Highlights**:
  ```javascript
  {
    name: String (unique, lowercase),
    type: ['product', 'tool'],
    description: String,
    attributes: [String],     // Required fields for this category
    sort_order: Number,
    status: ['active', 'inactive']
  }
  ```
- **Static Methods**: `getProductCategories()`, `getToolCategories()`

### 6. **User** - Authentication and Authorization
- **Purpose**: Role-based access control
- **Roles**:
  - **Admin**: Full system access + technical settings
  - **Warehouse**: Full inventory operations (same as Admin for business functions)
  - **Sales**: Read-only access, no cost data visibility
- **Schema Highlights**:
  ```javascript
  {
    username: String (unique),
    email: String,
    password: String (hashed),
    role: ['admin', 'warehouse', 'sales'],
    is_active: Boolean,
    last_login: Date
  }
  ```

### 7. **AuditLog** - Activity Tracking
- **Purpose**: Troubleshooting and accountability ("when something gets fucked up")
- **Key Features**:
  - Complete user action tracking
  - System event logging
  - Error tracking with stack traces
  - Performance monitoring
- **Schema Highlights**:
  ```javascript
  {
    user_id: ObjectId → User,
    action: String,
    entity_type: String,      // 'SKU', 'Instance', 'Tag', etc.
    entity_id: ObjectId,
    changes: Mixed,           // Before/after data
    ip_address: String,
    user_agent: String,
    timestamp: Date
  }
  ```

## 🔄 **BUSINESS WORKFLOWS**

### Stock Receipt Workflow
1. **Scan bundle or individual SKU** (barcode or manual entry)
2. **Bundle processing**: If bundle SKU, create instances for each component SKU
3. **Instance creation**: Create individual Instance records with acquisition costs
4. **Inventory update**: Aggregate quantities updated automatically

**Example**: Receive bundle `SMMWK603696-47V`:
- Creates 2 instances of `SMMW3696-47V` (36x96 panels)
- Creates 1 instance of `SMMW6096-47V` (60x96 panel)  
- Creates 1 instance of corner pieces SKU
- Updates 3 separate inventory records (not the bundle inventory)

### Tag Creation Workflow (Material Reservation)
1. **Create tag**: Customer, project, SKUs with quantities OR specific instance selections
2. **Instance selection options**:
   - **Auto (FIFO)**: System assigns oldest available instances
   - **Cost-based**: System assigns lowest/highest cost instances
   - **Manual**: User selects specific instances via UI
3. **Instance assignment**: Set `tag_id` on selected instances, populate `selected_instance_ids` arrays
4. **Inventory update**: `available_quantity -= count`, `reserved_quantity += count`
5. **Quantity calculation**: Tag quantities computed as `selected_instance_ids.length` (single source of truth)

### Tag Creation Workflow (Tool Lending)
1. **Create tag**: Installer name, tools needed, due date
2. **Instance assignment**: Assign specific tool instances to installer
3. **Inventory update**: `available_quantity -= quantity`, `loaned_quantity += quantity`

### Tag Fulfillment Workflow (Instance-Based)
1. **Precise fulfillment**: Select specific quantities per SKU (not necessarily all tagged items)
2. **Instance selection**: Choose N oldest instances from `selected_instance_ids` arrays
3. **Instance deletion**: Delete selected instance records from database
4. **Array update**: Remove fulfilled instance IDs from `selected_instance_ids` arrays
5. **Inventory update**: 
   - `total_quantity -= fulfilled_count` (items consumed)
   - `reserved_quantity -= fulfilled_count` or `loaned_quantity -= fulfilled_count`
6. **Financial impact**: Dashboard reflects exact lost inventory value from deleted instances
7. **Tag status**: Mark as fulfilled when all `selected_instance_ids` arrays are empty

**Example**: Fulfill 2 reserved panels (1×$500, 1×$800):
- Total inventory value decreases by $1,300
- 2 instance records deleted
- Inventory: `total_quantity: 6, available_quantity: 6, reserved_quantity: 0`

## 📊 **PERFORMANCE OPTIMIZATIONS**

### Indexing Strategy
- **Primary Keys**: All ObjectId fields indexed automatically
- **Foreign Keys**: All reference fields (sku_id, category_id, tag_id) indexed
- **Business Queries**: 
  - `sku_code` (unique, compound searches)
  - `barcode` (sparse index, lookup queries)
  - `acquisition_date` (FIFO ordering)
  - `is_active`, `status` fields (filtering)
- **Compound Indexes**: 
  - `{sku_id: 1, tag_id: 1}` (available instances)
  - `{category_id: 1, status: 1}` (category filtering)
  - `{is_active: 1, available_quantity: 1, reorder_point: 1}` (reorder queries)

### Query Performance
- **Populated Queries**: Efficient relationship loading with selective field population
- **Aggregation Pipelines**: Complex inventory reporting and financial calculations
- **Static Methods**: Pre-optimized common business queries
- **Caching Ready**: Structure supports Redis caching for dashboard data

### Database Design Benefits
- **Single Source of Truth**: SKU contains all product information
- **Proper Foreign Keys**: ObjectId references with referential integrity  
- **No Data Duplication**: Information stored once, referenced everywhere
- **Real-time Aggregation**: Accurate, fast inventory tracking
- **Financial Accuracy**: Instance-level cost tracking prevents averaging errors

## 🛡️ **DATA INTEGRITY FEATURES**

### Schema Validation
- **Mongoose Schema Validation**: Type checking, required fields, enums
- **Business Logic Validation**: Custom validation methods in models
- **Data Sanitization**: Automatic trimming, case formatting, index preparation
- **Required Fields**: Proper enforcement prevents incomplete records

### Referential Integrity
- **Foreign Key Constraints**: ObjectId references validated on creation
- **Cascade Operations**: Managed through application logic and middleware
- **Orphan Prevention**: Validation prevents creation of orphaned records
- **Constraint Enforcement**: Database constraints for critical relationships

### Business Rule Enforcement
- **Quantity Validation**: Cannot reserve more than available
- **Status Transitions**: Valid state changes enforced in model methods
- **Bundle Consistency**: Bundle components must exist and be active
- **Cost Immutability**: Instance acquisition costs never change after creation

## 🔧 **BUSINESS LOGIC METHODS**

### SKU Model Methods
- **Bundle Processing**: `processBundle()` - Create component instances
- **Cost Management**: `updateCost()` - Add to cost history
- **Availability**: `getAvailableQuantity()` - Real-time available count

### Instance Model Methods  
- **Assignment**: `assignToTag()` - Set tag_id and update status
- **FIFO Selection**: Static method `getOldestAvailable()` for tag assignment
- **Cost Selection**: Static method `getByCost()` for specific cost instances

### Tag Model Methods
- **Instance Assignment**: `assignInstances()` - FIFO/cost-based/manual assignment to tag
- **Specific Fulfillment**: `fulfillSpecificItems(skuId, quantity)` - Delete N instances for specific SKU
- **Full Fulfillment**: `fulfillItems()` - Delete all instances in all arrays
- **Status Checking**: `isFullyFulfilled()`, `isPartiallyFulfilled()` - Check array emptiness
- **Quantity Calculation**: `getTotalQuantity()`, `getTotalRemainingQuantity()` - Sum array lengths

### Inventory Model Methods
- **Quantity Management**: `reserveQuantity()`, `releaseReservedQuantity()`
- **Stock Operations**: `addStock()`, `removeStock()`, `moveInventory()`
- **Business Intelligence**: `needsReorder()`, `getSummary()`
- **Reporting**: Static methods for low stock, out of stock, total value

## 📁 **CURRENT FILE STRUCTURE**

```
backend/src/models/
├── SKU.js              # Product master data
├── Instance.js         # Individual physical items
├── Tag.js              # Status and allocation system  
├── Inventory.js        # Real-time aggregation
├── Category.js         # Product organization
├── User.js             # Authentication and roles
└── AuditLog.js         # Activity tracking

backend/src/routes/
├── skus.js             # SKU CRUD + barcode operations
├── instances.js        # Instance management
├── tags.js             # Tag creation and fulfillment
├── inventory.js        # Inventory reporting + sync
├── export.js           # Import/export functionality
├── categories.js       # Category management
└── users.js            # Authentication

frontend/ (Vue 3 + TypeScript)
├── src/stores/         # Pinia state management
├── src/components/     # Vue components
├── src/views/          # Page-level views
└── src/types/          # TypeScript interfaces
```

## 💡 **USAGE EXAMPLES**

### Import Models
```javascript
// Import individual models
const SKU = require('./models/SKU');
const Instance = require('./models/Instance');  
const Tag = require('./models/Tag');
const Inventory = require('./models/Inventory');
```

### Create Tag with Instance Assignment (New Architecture)
```javascript
// Option 1: Auto-assign with FIFO (backward compatible)
const tag = new Tag({
  tag_type: 'reserved',
  customer_name: 'John Smith', 
  project_name: 'Kitchen Renovation',
  sku_items: [{
    sku_id: skuId,
    quantity: 2, // Used for auto-assignment
    selection_method: 'fifo', // or 'cost_based'
    notes: 'Carrara Velvet panels for backsplash'
  }]
});
await tag.assignInstances();

// Option 2: Manual instance selection (new capability)
const tag = new Tag({
  tag_type: 'reserved',
  customer_name: 'John Smith',
  project_name: 'Kitchen Renovation', 
  sku_items: [{
    sku_id: skuId,
    selected_instance_ids: [instanceId1, instanceId2], // Specific instances
    selection_method: 'manual',
    notes: 'Specific high-quality panels selected'
  }]
});
await tag.assignInstances(); // Validates and assigns the specific instances

// Quantities are calculated automatically as selected_instance_ids.length
console.log(tag.getTotalQuantity()); // Returns 2
```

### Bundle Processing
```javascript
// Process bundle SKU
const bundleSKU = await SKU.findOne({ sku_code: 'SMMWK603696-47V' });
if (bundleSKU.is_bundle) {
  // Creates instances for each component SKU
  const instances = await bundleSKU.processBundle(quantity, acquisitionCost);
  // Updates inventory for component SKUs, not bundle SKU
}
```

### Query with Population
```javascript
// Get inventory with SKU and category details
const inventory = await Inventory.find({ is_active: true })
  .populate({
    path: 'sku_id',
    populate: {
      path: 'category_id',
      select: 'name type'
    },
    select: 'sku_code name brand model unit_cost status'
  })
  .sort({ available_quantity: 1 });
```

### Financial Reporting
```javascript
// Get total inventory value
const totalValue = await Inventory.getTotalInventoryValue();

// Get cost breakdown for specific SKU
const instances = await Instance.find({ sku_id: skuId, tag_id: null })
  .sort({ acquisition_cost: 1 });
const costBreakdown = instances.reduce((acc, instance) => {
  acc.totalCost += instance.acquisition_cost;
  acc.averageCost = acc.totalCost / instances.length;
  return acc;
}, { totalCost: 0, averageCost: 0 });
```

## 🚀 **CURRENT MIGRATION STATUS**

### ✅ **COMPLETED (Phase 1-4)**
1. **Database Models** - All 7 models implemented with business logic
2. **Backend API Routes** - Complete CRUD operations and business workflows  
3. **Authentication System** - Role-based access with JWT tokens
4. **Import/Export System** - CSV/JSON import with templates
5. **Barcode Integration** - Lookup and stock addition via barcode scanning

### ✅ **COMPLETED (Phase 5 - MAJOR ENHANCEMENT)**
1. **API Endpoint Testing** - Comprehensive testing completed ✅
2. **Instance-Based Tag Architecture** - Revolutionary upgrade completed ✅
   - Eliminated quantity/remaining_quantity dual-tracking
   - Single source of truth: quantity = selected_instance_ids.length
   - Precise instance control and manual selection capability
   - Migration script created for existing data conversion
3. **Performance Optimization** - Deferred until post-launch ⏸️

### 🔜 **PENDING (Phase 6-10)**
1. **Frontend Migration** - Vue 3 components and TypeScript interfaces
2. **Component Updates** - Inventory table, tag creation, stock management  
3. **Database Conversion** - Production data migration utility
4. **End-to-End Testing** - Complete workflow testing
5. **Production Deployment** - Staging and live deployment

---

This architecture provides a solid, scalable foundation that eliminates data inconsistency issues while supporting all business requirements including tool lending to installers, material reservations for jobs, and accurate financial tracking at the individual item level.
