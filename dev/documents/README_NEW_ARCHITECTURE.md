# New Database Architecture - Complete Model Documentation

## Overview
This directory contains the completely redesigned database architecture that addresses all the architectural flaws in the original system. The new design provides proper normalization, referential integrity, and scalable relationships.

## ✅ **COMPLETED MODELS**

### 1. **Customer.js** - Customer Management
- **Purpose**: Single source of truth for all customer information
- **Key Features**:
  - Proper validation and standardization
  - Contact information management
  - Billing/shipping address separation
  - Customer status tracking
  - Comprehensive indexing
- **Relationships**: 
  - One-to-Many with Tags (customer_id)
  - Referenced in audit logs

### 2. **Category.js** - Hierarchical Product Categories
- **Purpose**: Organize SKUs into logical categories (including tools)
- **Key Features**:
  - Hierarchical structure (parent/child categories)
  - Tools as a category type
  - SEO-friendly slugs
  - Status management (active/inactive)
- **Relationships**:
  - One-to-Many with SKUs (category_id)
  - Self-referencing for hierarchy (parent_id)

### 3. **SKUNew.js** - Single Source of Truth for Products
- **Purpose**: Central repository for all product information
- **Key Features**:
  - Complete product specifications
  - Tools lending support
  - Pricing and cost tracking
  - Image and document attachments
  - Comprehensive validation
  - Performance optimized indexes
- **Relationships**:
  - Belongs-to Category (category_id)
  - One-to-Many with Items (sku_id)
  - One-to-One with Inventory (sku_id)

### 4. **ItemNew.js** - Individual Product Instances
- **Purpose**: Track individual instances of SKUs with unique properties
- **Key Features**:
  - Instance-specific data only (serial numbers, condition, location)
  - References SKU for product information
  - Status tracking (available, reserved, broken, loaned)
  - Location and condition management
- **Relationships**:
  - Belongs-to SKU (sku_id) - gets all product info from here
  - Referenced by Tags through items array

### 5. **TagNew.js** - Proper Relationship Management
- **Purpose**: Manage customer reservations and tool lending
- **Key Features**:
  - Proper foreign key references (no more string relationships)
  - Support for all tag types including tool lending
  - Partial fulfillment tracking
  - Business logic methods for operations
  - Comprehensive status management
- **Relationships**:
  - Belongs-to Customer (customer_id)
  - References multiple Items through items array
  - Tracks fulfillment status and history

### 6. **Inventory.js** - Real-time Inventory Aggregation
- **Purpose**: Provide fast, accurate inventory levels per SKU
- **Key Features**:
  - Real-time quantity tracking by status (available, reserved, broken, loaned)
  - Stock level alerts (low stock, out of stock, overstock)
  - Location tracking
  - Financial valuation (total value, average cost)
  - Automatic status flag calculations
  - Business logic for inventory operations
- **Relationships**:
  - One-to-One with SKU (sku_id)
  - Aggregates data from all Items of a SKU

### 7. **AuditLog.js** - Complete Activity Tracking
- **Purpose**: Track all system changes and user activities
- **Key Features**:
  - Comprehensive event logging
  - User activity tracking
  - System event monitoring
  - Error logging with stack traces
  - Performance metrics tracking
  - Capped collection for performance
- **Relationships**:
  - References any entity through entity_type/entity_id
  - User activity correlation

## 🔄 **DATA FLOW & RELATIONSHIPS**

### **Proper Data Flow:**
```
Customer → Tag → Items → SKU ← Category
                   ↓
               Inventory (aggregated)
                   ↓
              AuditLog (tracking)
```

### **Key Improvements Over Old System:**
1. **Single Source of Truth**: SKU contains all product info
2. **Proper Foreign Keys**: ObjectId references with referential integrity
3. **No Data Duplication**: Information stored once, referenced everywhere
4. **Tools Integration**: Tools are just a category of SKU with lending support
5. **Real-time Inventory**: Accurate, fast inventory tracking
6. **Complete Audit Trail**: Every action tracked and logged

## 📊 **PERFORMANCE OPTIMIZATIONS**

### **Indexing Strategy:**
- **Primary Keys**: All ObjectId fields indexed
- **Foreign Keys**: All reference fields indexed
- **Query Fields**: Common filter fields indexed
- **Compound Indexes**: Multi-field queries optimized
- **Text Search**: Full-text search on product names/descriptions

### **Query Performance:**
- **Populated Queries**: Efficient relationship loading
- **Aggregation Pipelines**: Complex reporting queries
- **Static Methods**: Pre-optimized common queries
- **Caching Ready**: Structure supports Redis caching

## 🛡️ **DATA INTEGRITY FEATURES**

### **Validation:**
- **Schema Validation**: Mongoose schema validation
- **Business Logic Validation**: Custom validation methods
- **Data Sanitization**: Automatic trimming and formatting
- **Required Fields**: Proper required field enforcement

### **Referential Integrity:**
- **Foreign Key Constraints**: Proper ObjectId references
- **Cascade Operations**: Managed through application logic
- **Orphan Prevention**: Validation prevents orphaned records

## 🔧 **BUSINESS LOGIC METHODS**

Each model includes comprehensive business logic methods:
- **CRUD Operations**: Create, read, update, delete
- **Status Management**: State transitions and validation
- **Reporting Methods**: Common business queries
- **Utility Methods**: Data transformation and calculations

## 📁 **FILE STRUCTURE**
```
/models/
├── Customer.js          # Customer management
├── Category.js          # Product categories (including tools)
├── SKUNew.js           # Product master data
├── ItemNew.js          # Product instances
├── TagNew.js           # Customer relationships
├── Inventory.js        # Inventory aggregation
├── AuditLog.js         # Activity tracking
├── newModels.js        # Central export file
└── README_NEW_ARCHITECTURE.md  # This file
```

## 🚀 **NEXT STEPS**
1. ✅ **Database Models** - COMPLETE
2. ⏳ **Migration Scripts** - Create data transformation scripts
3. ⏳ **API Updates** - Update backend endpoints
4. ⏳ **Frontend Updates** - Update React components
5. ⏳ **Testing** - Comprehensive test suite
6. ⏳ **Deployment** - Staging and production deployment

---

## 💡 **USAGE EXAMPLES**

### Import Models:
```javascript
// Import all models
const { Customer, SKUNew, ItemNew, TagNew, Inventory, AuditLog } = require('./newModels');

// Or import individually
const Customer = require('./Customer');
const SKUNew = require('./SKUNew');
```

### Create Relationships:
```javascript
// Create a tag with proper relationships
const tag = new TagNew({
  customer_id: customerId,
  tag_type: 'loaned',
  items: [{
    item_id: itemId,
    quantity: 2,
    notes: 'Need back by Friday'
  }]
});
```

### Query with Population:
```javascript
// Get tag with full customer and item details
const tag = await TagNew.findById(tagId)
  .populate('customer_id')
  .populate({
    path: 'items.item_id',
    populate: {
      path: 'sku_id',
      populate: {
        path: 'category_id'
      }
    }
  });
```

This new architecture provides a solid, scalable foundation that will eliminate the data inconsistency issues and support the business requirements including tools lending management.
