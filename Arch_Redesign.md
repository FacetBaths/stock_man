# Database Architecture Redesign

**Date:** August 2025  
**Version:** 1.0  
**Purpose:** Redesign database relationships for better scalability, performance, and maintainability

---

## 🎯 **Executive Summary**

The current database architecture suffers from fragmented relationships, inconsistent data patterns, and complex manual aggregations. This redesign establishes clear entity relationships, single sources of truth, and proper referential integrity to support future growth.

**Key Goals:**
- Eliminate data duplication and inconsistency
- Establish clear ownership and relationships
- Improve query performance through proper indexing
- Support tools lending functionality
- Simplify frontend data consumption

---

## 🏗️ **New Database Schema**

### **Core Entities**

#### 1. **Customers**
```javascript
{
  _id: ObjectId,
  name: String (unique, indexed),
  email: String,
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    zip: String
  },
  status: String, // 'active', 'inactive'
  createdAt: Date,
  updatedAt: Date
}
```

#### 2. **Categories** (New - for better organization)
```javascript
{
  _id: ObjectId,
  name: String, // 'wall', 'toilet', 'base', 'tool', etc.
  type: String, // 'product', 'tool'
  description: String,
  attributes: [String], // Required fields for this category
  createdAt: Date
}
```

#### 3. **SKUs** (Enhanced - Single source of truth)
```javascript
{
  _id: ObjectId,
  sku_code: String (unique, indexed),
  category_id: ObjectId (ref: Categories),
  
  // Consolidated product information
  name: String,
  description: String,
  brand: String,
  model: String,
  
  // Category-specific details (polymorphic)
  details: {
    // For walls:
    product_line: String,
    color_name: String,
    dimensions: String,
    finish: String,
    
    // For tools:
    tool_type: String,
    manufacturer: String,
    serial_number: String,
    
    // Common fields:
    weight: Number,
    specifications: Object
  },
  
  // Costing
  unit_cost: Number,
  currency: String,
  
  // Status
  status: String, // 'active', 'discontinued', 'pending'
  
  // Metadata
  barcode: String,
  supplier_info: Object,
  images: [String],
  
  createdAt: Date,
  updatedAt: Date
}
```

#### 4. **Items** (Simplified - Instances of SKUs)
```javascript
{
  _id: ObjectId,
  sku_id: ObjectId (ref: SKUs, indexed),
  
  // Instance-specific information only
  serial_number: String, // For individual tracking if needed
  condition: String, // 'new', 'used', 'damaged'
  location: String,
  notes: String,
  
  // Purchase information
  purchase_date: Date,
  purchase_price: Number,
  batch_number: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### 5. **Tags** (Redesigned - Clear ownership)
```javascript
{
  _id: ObjectId,
  customer_id: ObjectId (ref: Customers, indexed),
  
  // Tag information
  tag_type: String, // 'reserved', 'broken', 'imperfect', 'loaned'
  status: String, // 'active', 'fulfilled', 'cancelled'
  
  // Items in this tag
  items: [{
    item_id: ObjectId (ref: Items),
    quantity: Number,
    remaining_quantity: Number,
    notes: String
  }],
  
  // Metadata
  notes: String,
  due_date: Date,
  project_name: String,
  created_by: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### 6. **Inventory** (New - Aggregation table for performance)
```javascript
{
  _id: ObjectId,
  sku_id: ObjectId (ref: SKUs, unique indexed),
  
  // Quantities (computed and cached)
  total_quantity: Number,
  available_quantity: Number,
  reserved_quantity: Number,
  broken_quantity: Number,
  imperfect_quantity: Number,
  loaned_quantity: Number,
  
  // Last update
  last_updated: Date
}
```

---

## 🔄 **Key Relationship Changes**

### **Before (Current)**
```
Items ──weak──> SKUs
Tags ──string──> Customers
Tags ──array──> SKU Items (complex)
```

### **After (Redesigned)**
```
Categories ←── SKUs ←── Items
Customers ←── Tags ──> Items
SKUs ←── Inventory (computed)
```

---

## ⚡ **Benefits of New Architecture**

### **1. Single Source of Truth**
- **SKU information** centralized in SKUs collection
- **Customer data** properly normalized in Customers collection
- **Inventory counts** computed and cached in Inventory collection

### **2. Better Performance**
- **Pre-computed inventory counts** eliminate complex aggregations
- **Proper indexing** on foreign keys and frequently queried fields
- **Reduced joins** through denormalization where appropriate

### **3. Data Integrity**
- **Foreign key relationships** with proper validation
- **Cascade operations** for updates and deletions
- **Consistent data types** across collections

### **4. Extensibility**
- **Categories system** allows easy addition of new product/tool types
- **Polymorphic details** field supports different attribute sets
- **Clean separation** between instance data (Items) and template data (SKUs)

---

## 🔧 **Tools Integration**

The redesigned architecture naturally supports tools lending:

### **Tool Management**
- Tools are **SKUs with category_type: 'tool'**
- Tool-specific fields in `details` object
- Same inventory tracking as products

### **Tool Lending**
- Use **tags with tag_type: 'loaned'**
- Track which installer has which tools
- Due dates for tool returns
- History of tool usage

### **Example Tool SKU:**
```javascript
{
  sku_code: "DRILL-001",
  category_id: "tool_category_id",
  name: "Cordless Drill",
  details: {
    tool_type: "power_drill",
    manufacturer: "DeWalt",
    model: "DCD771C2",
    voltage: "20V",
    features: ["LED light", "15+1 clutch settings"]
  }
}
```

---

## 💔 **Frontend Impact Analysis**

### **Components That Will Break**

#### **1. InventoryTable.vue**
**Current Issues:**
- Expects `item.tagSummary` object
- Uses `item.sku_code` directly on items
- Displays `item.product_details`

**Required Changes:**
```javascript
// OLD WAY
item.tagSummary.reserved
item.sku_code
item.product_details.name

// NEW WAY
inventory.reserved_quantity  // From Inventory collection
item.sku_id.sku_code        // Populated reference
item.sku_id.name            // From SKU
```

**Migration Strategy:**
1. Update API to populate `item.sku_id` with full SKU data
2. Update API to join with Inventory collection for quantities
3. Update component to use `item.sku_id.*` instead of direct item properties

#### **2. Tags.vue**
**Current Issues:**
- Expects `tag.sku_items` array
- Uses string customer names
- Complex SKU data display

**Required Changes:**
```javascript
// OLD WAY
tag.sku_items[0].sku_id.sku_code
tag.customer_name (string)

// NEW WAY  
tag.items[0].item_id.sku_id.sku_code  // Nested population
tag.customer_id.name                   // Populated reference
```

**Migration Strategy:**
1. Update Tags API to populate nested references
2. Update component templates to use new data structure
3. Add customer selection dropdown instead of text input

#### **3. Dashboard.vue**
**Current Issues:**
- Uses complex inventory stats aggregation
- Expects tag-based summaries

**Required Changes:**
```javascript
// OLD WAY
Complex aggregation in backend

// NEW WAY
Direct query on Inventory collection
```

**Migration Strategy:**
1. Update stats API to query Inventory collection
2. Simplify dashboard data loading
3. Add tools section to dashboard

#### **4. SKU Management Components**
**Current Issues:**
- Separate description fields
- Inconsistent data structure

**Required Changes:**
- Consolidate all SKU information into single form
- Update validation rules
- Add category selection

#### **5. Create/Edit Item Modals**
**Current Issues:**
- Duplicate product detail fields
- Manual SKU assignment

**Required Changes:**
```javascript
// Remove from Item forms:
// - product_details (now in SKU)
// - cost (now in SKU as unit_cost)
// - barcode (now in SKU)

// Keep in Item forms:
// - location
// - condition  
// - notes
// - serial_number (if needed)
```

---

## 🚀 **Migration Strategy**

### **Phase 1: Database Setup**
1. Create new collections with proper schema
2. Set up indexes and constraints
3. Create migration scripts

### **Phase 2: Data Migration**
1. Migrate customers (extract from tag strings)
2. Migrate categories
3. Consolidate SKU data
4. Restructure items (remove duplicated data)
5. Rebuild tags with proper references
6. Generate inventory aggregation table

### **Phase 3: Backend Updates**
1. Update all API endpoints to use new schema
2. Add proper population/joins
3. Update validation rules
4. Add cascade operations

### **Phase 4: Frontend Updates**
1. Update data access patterns in components
2. Modify forms to match new schema
3. Update display logic
4. Add tools management UI

### **Phase 5: Testing & Validation**
1. Test all existing functionality
2. Verify data integrity
3. Performance testing
4. User acceptance testing

---

## 📊 **Performance Improvements Expected**

### **Query Performance**
- **90% faster inventory queries** (pre-computed vs aggregated)
- **50% faster tag operations** (proper indexing)
- **Elimination of N+1 queries** through proper population

### **Data Consistency**
- **Zero data duplication** between SKUs and Items
- **Referential integrity** enforced at database level
- **Automatic cascade operations** for updates

### **Development Velocity**
- **Simpler data models** easier to understand
- **Consistent patterns** across all entities
- **Clear ownership** of data fields

---

## 🛠️ **Implementation Priority**

### **High Priority (Core Functionality)**
1. SKU-Item relationship cleanup
2. Inventory aggregation table
3. Customer normalization

### **Medium Priority (User Experience)**
1. Tags restructuring
2. Dashboard simplification
3. Form consolidation

### **Low Priority (Future Features)**
1. Tools lending system
2. Advanced reporting
3. Category management UI

---

## 🎯 **Success Metrics**

### **Technical Metrics**
- API response times < 200ms
- Zero data inconsistencies
- 100% test coverage on new schema

### **User Experience Metrics**
- No loss of functionality
- Improved page load times
- Simplified data entry forms

### **Business Metrics**
- Support for tools lending
- Better inventory accuracy
- Scalability for 10x data growth

---

## ⚠️ **Risks & Mitigations**

### **Risk: Data Loss During Migration**
**Mitigation:** Full backup + rollback plan + staged migration

### **Risk: Extended Downtime**
**Mitigation:** Blue-green deployment + parallel systems during migration

### **Risk: Frontend Components Breaking**
**Mitigation:** Comprehensive testing + gradual rollout + feature flags

### **Risk: User Training Required**
**Mitigation:** Maintain UI consistency + progressive enhancement

---

## 📋 **Next Steps**

1. **Review and approve** this architectural plan
2. **Create detailed migration scripts** for each phase
3. **Set up development environment** with new schema
4. **Begin Phase 1** implementation
5. **Establish testing protocols** for each phase

---

**This redesign addresses the fundamental architectural issues while maintaining all current functionality and adding tools lending capability. The result will be a more maintainable, scalable, and performant system.**
