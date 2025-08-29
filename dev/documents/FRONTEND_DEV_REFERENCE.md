# FRONTEND DEVELOPMENT REFERENCE
**AUTHORITATIVE GUIDE - ALWAYS REFERENCE THIS BEFORE CODING**

> **🚨 GOLDEN RULE:** Never code frontend components without referencing this document first. All field names, structures, and relationships are EXACT from the tested backend.

**Source Truth:** `/dev/documents/BACKEND_API_REFERENCE.md`
**Last Updated:** 2025-08-28
**Backend Status:** ✅ TESTED AND WORKING

---

## 🏗️ **BACKEND MODEL SPECIFICATIONS**

### **1. INVENTORY MODEL** (Primary Frontend Data)
**Purpose:** Aggregated view of all inventory quantities per SKU
**Frontend Usage:** Main data source for Dashboard and InventoryTable

#### **Exact Fields (Use These Names ONLY):**
```typescript
interface InventoryItem {
  _id: string;                    // Inventory record ID
  sku_id: string;                 // Reference to SKU
  
  // QUANTITY FIELDS (Use exact names)
  total_quantity: number;         // Total instances for this SKU
  available_quantity: number;     // Untagged instances (tag_id: null)
  reserved_quantity: number;      // Tagged as "reserved"
  broken_quantity: number;        // Tagged as "broken"  
  loaned_quantity: number;        // Tagged as "loaned"
  
  // FINANCIAL FIELDS
  total_value: number;            // Sum of all instance acquisition_costs
  average_cost: number;           // Weighted average cost
  
  // BUSINESS LOGIC FLAGS
  is_low_stock: boolean;          // Calculated by backend
  is_out_of_stock: boolean;       // Calculated by backend
  is_overstock: boolean;          // Calculated by backend
  
  // THRESHOLDS
  minimum_stock_level: number;
  reorder_point: number;
  maximum_stock_level: number;
  
  // POPULATED RELATIONSHIPS
  sku: {                          // Populated from SKU model
    _id: string;
    sku_code: string;             // ❌ NOT "item_code"
    name: string;
    description: string;
    brand: string;
    model: string;
    unit_cost: number;
    barcode: string;
    category_id: string;
    status: string;
  };
  category: {                     // Populated from Category model
    _id: string;
    name: string;                 // "toilets", "walls", etc.
    description: string;
  };
  
  // TAG SUMMARY (Aggregated from Tag model)
  tag_summary: {
    reserved: number;             // Count of reserved instances
    broken: number;               // Count of broken instances
    loaned: number;               // Count of loaned instances
    totalTagged: number;          // Sum of all tagged instances
  };
  
  // METADATA
  last_movement_date: string;     // ISO date string
  last_updated_by: string;
  updatedAt: string;              // ISO date string
  createdAt: string;              // ISO date string
}
```

#### **Frontend Display Logic:**
```typescript
// ✅ CORRECT - Use exact backend fields
const displayName = item.sku?.name || 'Unknown Product';
const skuCode = item.sku?.sku_code; // NOT item_code
const categoryName = item.category?.name;
const totalStock = item.total_quantity;
const availableStock = item.available_quantity;

// ✅ CORRECT - Status indicators from backend flags
const isLowStock = item.is_low_stock;
const isOutOfStock = item.is_out_of_stock;
const needsReorder = item.available_quantity <= item.reorder_point;

// ✅ CORRECT - Tag status from tag_summary
const hasReserved = item.tag_summary?.reserved > 0;
const hasBroken = item.tag_summary?.broken > 0;
const hasLoaned = item.tag_summary?.loaned > 0;
```

#### **API Endpoint:**
- **GET** `/api/inventory` - Returns array of InventoryItem objects
- **Query Parameters:** `category_id`, `search`, `status`, `page`, `limit`, `sort_by`, `sort_order`

---

### **2. SKU MODEL** (Product Master Data)
**Purpose:** Single source of truth for all product information
**Frontend Usage:** Product details, creation forms, barcode lookup

#### **Exact Fields:**
```typescript
interface SKU {
  _id: string;
  sku_code: string;               // ❌ NOT "item_code"
  name: string;                   // Product name
  description: string;
  brand: string;
  model: string;
  color: string;
  dimensions: string;
  finish: string;
  unit_cost: number;              // Current cost
  cost_history: Array<{
    cost: number;
    effective_date: string;
    updated_by: string;
    notes: string;
  }>;
  barcode: string;
  category_id: string;            // Reference to Category
  status: 'active' | 'discontinued';
  notes: string;
  
  // POPULATED RELATIONSHIP
  category: {
    _id: string;
    name: string;
    type: 'product' | 'tool';
    description: string;
  };
  
  // METADATA
  createdAt: string;
  updatedAt: string;
}
```

#### **API Endpoints:**
- **GET** `/api/skus` - List SKUs with pagination/filtering
- **GET** `/api/skus/:id` - Get specific SKU
- **POST** `/api/skus` - Create new SKU
- **PUT** `/api/skus/:id` - Update SKU
- **GET** `/api/skus/barcode/:code` - Lookup by barcode

---

### **3. INSTANCE MODEL** (Individual Physical Items)
**Purpose:** Track individual units with costs and locations
**Frontend Usage:** Stock addition, cost breakdowns, FIFO tracking

#### **Exact Fields:**
```typescript
interface Instance {
  _id: string;
  sku_id: string;                 // Reference to SKU
  acquisition_date: string;       // ISO date string
  acquisition_cost: number;       // Frozen at creation
  tag_id: string | null;          // null = available, string = tagged
  location: string;
  supplier: string;
  reference_number: string;
  notes: string;
  added_by: string;
  
  // POPULATED RELATIONSHIPS
  sku: SKU;                       // Full SKU object
  tag?: Tag;                      // If tagged
  
  // METADATA
  createdAt: string;
  updatedAt: string;
}
```

#### **API Endpoints:**
- **GET** `/api/instances/:sku_id` - Get instances for specific SKU
- **POST** `/api/instances/add-stock` - Add new instances
- **PUT** `/api/instances/:id` - Update instance
- **GET** `/api/instances/cost-breakdown/:sku_id` - Cost analysis

---

### **4. TAG MODEL** (Status & Allocation System)
**Purpose:** Manage reservations, tool lending, status tracking
**Frontend Usage:** Tag creation, fulfillment, status displays

#### **Exact Fields:**
```typescript
interface Tag {
  _id: string;
  customer_name: string;          // For reservations
  tag_type: 'reserved' | 'broken' | 'imperfect' | 'loaned' | 'stock';
  status: 'active' | 'fulfilled' | 'cancelled';
  
  // CORE TAG DATA
  sku_items: Array<{
    sku_id: string;
    // NEW ARCHITECTURE - Use selected_instance_ids
    selected_instance_ids: string[];  // Array of Instance IDs
    selection_method: 'auto' | 'manual' | 'fifo' | 'cost_based';
    notes: string;
    
    // DEPRECATED - Don't use these for new code
    quantity: number;               // Will be removed
    remaining_quantity: number;     // Will be removed
    
    // POPULATED
    sku: SKU;                      // Full SKU object
  }>;
  
  // PROJECT INFO
  project_name: string;
  due_date: string;               // ISO date string
  notes: string;
  
  // STATUS TRACKING
  created_by: string;
  fulfilled_by: string;
  fulfilled_date: string;
  cancelled_by: string;
  cancelled_date: string;
  cancellation_reason: string;
  
  // COMPUTED FIELDS (Backend calculated)
  total_quantity: number;         // Sum of selected_instance_ids lengths
  remaining_quantity: number;     // Sum of selected_instance_ids lengths
  is_partially_fulfilled: boolean;
  is_fully_fulfilled: boolean;
  is_overdue: boolean;
  fulfillment_progress: number;   // Percentage
  
  // METADATA
  createdAt: string;
  updatedAt: string;
}
```

#### **Frontend Tag Logic:**
```typescript
// ✅ CORRECT - Calculate quantities from arrays
const tagQuantity = tag.sku_items.reduce((sum, item) => 
  sum + item.selected_instance_ids.length, 0);

// ✅ CORRECT - Check fulfillment status
const isFullyFulfilled = tag.sku_items.every(item => 
  item.selected_instance_ids.length === 0);

// ✅ CORRECT - Create tag payload
const createTagPayload = {
  customer_name: 'John Smith',
  tag_type: 'reserved',
  project_name: 'Kitchen Renovation',
  sku_items: [{
    sku_id: 'sku123',
    quantity: 2,                    // For auto-assignment
    selection_method: 'fifo'        // Backend will populate selected_instance_ids
  }]
};
```

#### **API Endpoints:**
- **GET** `/api/tags` - List tags with filtering
- **GET** `/api/tags/:id` - Get specific tag
- **POST** `/api/tags` - Create new tag
- **PUT** `/api/tags/:id` - Update tag
- **POST** `/api/tags/:id/fulfill` - Fulfill tag items

---

### **5. CATEGORY MODEL** (Product Organization)
**Purpose:** Organize SKUs for filtering and validation
**Frontend Usage:** Category filters, form dropdowns

#### **Exact Fields:**
```typescript
interface Category {
  _id: string;
  name: string;                   // "toilets", "walls", "raw materials"
  type: 'product' | 'tool';
  description: string;
  attributes: string[];           // Required fields for this category
  sort_order: number;
  status: 'active' | 'inactive';
  
  // METADATA
  createdAt: string;
  updatedAt: string;
}
```

#### **API Endpoints:**
- **GET** `/api/categories` - List all categories
- **GET** `/api/categories/:id` - Get specific category
- **POST** `/api/categories` - Create category
- **PUT** `/api/categories/:id` - Update category

---

## 🔗 **MODEL RELATIONSHIPS**

### **Inventory → SKU → Category**
```typescript
// Inventory record contains populated SKU and Category
const inventory: InventoryItem = {
  _id: 'inv123',
  sku_id: 'sku456',
  total_quantity: 10,
  sku: {                          // Populated SKU data
    _id: 'sku456',
    sku_code: 'TOILET-X100',
    name: 'Premium Toilet',
    category_id: 'cat789',
    // ... other SKU fields
  },
  category: {                     // Populated Category data
    _id: 'cat789',
    name: 'toilets',
    type: 'product'
  }
  // ... other inventory fields
};
```

### **Instance → SKU → Tag**
```typescript
// Instance belongs to SKU and optionally to Tag
const instance: Instance = {
  _id: 'inst123',
  sku_id: 'sku456',
  tag_id: 'tag789',              // null if available
  acquisition_cost: 250.00,
  // ... other instance fields
};
```

### **Tag → SKU Items → Instances**
```typescript
// Tag contains array of SKU items, each with instance arrays
const tag: Tag = {
  _id: 'tag123',
  tag_type: 'reserved',
  sku_items: [{
    sku_id: 'sku456',
    selected_instance_ids: ['inst1', 'inst2', 'inst3'], // Specific instances
    selection_method: 'fifo',
    sku: { /* populated SKU data */ }
  }]
  // ... other tag fields
};
```

---

## 🚨 **FRONTEND DEVELOPMENT RULES**

### **NEVER DO:**
- ❌ Transform or rename backend field names
- ❌ Use legacy field names (`item_code`, `item_id`, etc.)
- ❌ Assume field structures - always reference this doc
- ❌ Create computed properties that rename fields
- ❌ Add data transformation layers in stores

### **ALWAYS DO:**
- ✅ Use exact backend field names in components
- ✅ Reference this document before coding any component
- ✅ Use populated relationship data directly
- ✅ Let backend handle all calculations (quantities, costs, flags)
- ✅ Test against actual backend API responses

### **BEFORE WRITING ANY COMPONENT:**
1. ✅ Check this document for exact field names
2. ✅ Verify the API endpoint and response structure
3. ✅ Understand the relationships between models
4. ✅ Use TypeScript interfaces that match exactly

---

## 🎯 **COMMON FRONTEND PATTERNS**

### **Display Inventory Items:**
```vue
<!-- ✅ CORRECT -->
<template>
  <div v-for="item in inventory" :key="item._id">
    <h3>{{ item.sku?.name }}</h3>
    <p>SKU: {{ item.sku?.sku_code }}</p>
    <p>Category: {{ item.category?.name }}</p>
    <p>Total: {{ item.total_quantity }}</p>
    <p>Available: {{ item.available_quantity }}</p>
    <div v-if="item.tag_summary?.reserved > 0">
      Reserved: {{ item.tag_summary.reserved }}
    </div>
  </div>
</template>
```

### **Create Stock Addition Form:**
```typescript
// ✅ CORRECT - Matches backend endpoint exactly
const addStockPayload = {
  sku_id: selectedSku._id,        // NOT item_id
  quantity: formData.quantity,
  unit_cost: formData.cost,
  location: formData.location,
  notes: formData.notes
};

await api.post('/api/instances/add-stock', addStockPayload);
```

### **Filter Categories:**
```typescript
// ✅ CORRECT - Use exact field names
const filterByCategory = (categoryId: string) => {
  return inventory.filter(item => 
    item.sku?.category_id === categoryId ||
    item.category?._id === categoryId
  );
};
```

---

## 📋 **QUICK REFERENCE CHECKLIST**

Before working on any component, verify:

- [ ] Are you using exact backend field names?
- [ ] Have you referenced the correct model section above?
- [ ] Are you using the right API endpoint?
- [ ] Is your TypeScript interface matching the backend exactly?
- [ ] Are you handling populated relationships correctly?
- [ ] Have you avoided any data transformations?

**When in doubt, always reference `/dev/documents/BACKEND_API_REFERENCE.md` for the source truth.**
