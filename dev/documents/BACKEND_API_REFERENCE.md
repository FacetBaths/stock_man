# BACKEND API REFERENCE
**AUTHORITATIVE DOCUMENTATION FOR FRONTEND DEVELOPMENT**

**CRITICAL:** This backend is TESTED and WORKING. Do NOT modify backend to fit frontend preferences.
Frontend must adapt to these EXACT structures and endpoints.

**Last Updated:** 2025-08-27 20:54 UTC
**Backend Status:** ENHANCED WITH INSTANCE ARCHITECTURE 🏗️

---

## 🚨 FRONTEND DEVELOPMENT RULES

### **ABSOLUTE PROHIBITIONS:**
- ❌ **NEVER modify backend models, routes, or API responses**
- ❌ **NEVER add new backend endpoints during frontend work**
- ❌ **NEVER change existing API response structures**
- ❌ **NEVER modify database schema**

### **REQUIRED APPROACH:**
- ✅ **Frontend MUST adapt to backend structure**
- ✅ **Use EXACT field names from API responses**
- ✅ **Handle backend data structure as-is**
- ✅ **Test against actual backend endpoints**

---

## 📋 DATABASE MODELS (CURRENT ARCHITECTURE)

### **SKU Model** (Primary Product Definition)
```javascript
{
  "_id": "ObjectId",
  "sku_code": "String (unique)",
  "product_type": "String (toilet, sink, etc.)",
  "product_details": "ObjectId (ref to product type collection)",
  "current_cost": "Number",
  "cost_history": [
    {
      "cost": "Number",
      "effective_date": "Date",
      "updated_by": "String",
      "notes": "String"
    }
  ],
  "barcode": "String",
  "description": "String",
  "notes": "String",
  "status": "String (active/discontinued)",
  "stock_thresholds": {
    "understocked": "Number",
    "overstocked": "Number"
  },
  "created_by": "String",
  "last_updated_by": "String",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### **Instance Model** (Individual Physical Items)
```javascript
{
  "_id": "ObjectId",
  "sku_id": "ObjectId (ref to SKU)",
  "acquisition_date": "Date",
  "acquisition_cost": "Number",
  "tag_id": "ObjectId (ref to Tag) or null",
  "location": "String",
  "supplier": "String",
  "reference_number": "String",
  "notes": "String",
  "added_by": "String",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### **Tag Model** (Instance-Based Status/Allocation System)
```javascript
{
  "_id": "ObjectId",
  "customer_name": "String",
  "tag_type": "String (reserved/broken/imperfect/loaned/stock)",
  "status": "String (active/fulfilled/cancelled)",
  "sku_items": [
    {
      "sku_id": "ObjectId (ref to SKU)",
      // NEW: Instance-based architecture (single source of truth)
      "selected_instance_ids": ["ObjectId (refs to Instance)"],
      "selection_method": "String (auto/manual/fifo/cost_based)",
      "notes": "String",
      // DEPRECATED: Legacy fields for migration compatibility
      "quantity": "Number (calculated as selected_instance_ids.length)",
      "remaining_quantity": "Number (calculated as selected_instance_ids.length)"
    }
  ],
  "project_name": "String",
  "due_date": "Date",
  "notes": "String",
  "created_by": "String",
  "fulfilled_by": "String",
  "fulfilled_date": "Date",
  "cancelled_by": "String",
  "cancelled_date": "Date",
  "cancellation_reason": "String",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### **Inventory Model** (Aggregated Quantities)
```javascript
{
  "_id": "ObjectId",
  "sku_id": "ObjectId (ref to SKU)",
  "total_quantity": "Number",
  "available_quantity": "Number",
  "reserved_quantity": "Number",
  "broken_quantity": "Number",
  "loaned_quantity": "Number",
  "total_value": "Number",
  "average_cost": "Number",
  "minimum_stock_level": "Number",
  "reorder_point": "Number",
  "maximum_stock_level": "Number",
  "is_low_stock": "Boolean",
  "is_out_of_stock": "Boolean",
  "is_overstock": "Boolean",
  "last_updated_by": "String",
  "last_movement_date": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## 🔗 API ENDPOINTS (TESTED AND WORKING)

### **Authentication**
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - User logout

### **SKUs**
- `GET /api/skus` - List all SKUs (with pagination, search, filters)
- `GET /api/skus/:id` - Get specific SKU
- `POST /api/skus` - Create new SKU
- `PUT /api/skus/:id` - Update SKU
- `DELETE /api/skus/:id` - Delete SKU
- `GET /api/skus/barcode/:code` - Lookup SKU by barcode

### **Instances**
- `GET /api/instances/:sku_id` - Get instances for specific SKU
- `POST /api/instances/add-stock` - Add new stock instances
- `PUT /api/instances/:id` - Update instance details
- `GET /api/instances/cost-breakdown/:sku_id` - Get cost analysis

### **Tags**
- `GET /api/tags` - List tags (with filters: status, customer, type)
- `GET /api/tags/:id` - Get specific tag
- `POST /api/tags` - Create new tag
- `PUT /api/tags/:id` - Update tag
- `POST /api/tags/:id/fulfill` - Fulfill tag items
- `POST /api/tags/:id/cancel` - Cancel tag
- `GET /api/tags/stats` - Get tag statistics
- `GET /api/tags/overdue/list` - Get overdue tags
- `GET /api/tags/customer/:customerName` - Get tags by customer

### **Inventory**
- `GET /api/inventory` - Get inventory summary (with pagination, filters)
- `GET /api/inventory/stats` - Get inventory statistics
- `GET /api/inventory/low-stock` - Get low stock items

### **Categories**
- `GET /api/categories` - List all categories
- `GET /api/categories/:id` - Get specific category
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### **Export/Import**
- `GET /api/export/inventory` - Export inventory (CSV/JSON)
- `GET /api/export/skus` - Export SKUs (CSV/JSON)
- `GET /api/export/tags` - Export tags (CSV/JSON)
- `GET /api/export/templates/sku-import` - Get SKU import template
- `GET /api/export/templates/stock-import` - Get stock import template
- `POST /api/import/skus` - Import SKUs
- `POST /api/import/stock` - Import stock instances

---

## 📤 CRITICAL API RESPONSE STRUCTURES

### **Inventory GET Response**
```javascript
{
  "inventory": [
    {
      "_id": "ObjectId",
      "sku_id": "ObjectId",
      "total_quantity": 10,
      "available_quantity": 5,
      "reserved_quantity": 3,
      "broken_quantity": 1,
      "loaned_quantity": 1,
      "total_value": 2500.00,
      "average_cost": 250.00,
      "sku": {
        "_id": "ObjectId",
        "sku_code": "TOILET-12345",
        "name": "Premium Toilet Model X",
        "description": "High-efficiency premium toilet with dual flush",
        "brand": "AcmePlumbing",
        "model": "PT-X100",
        "unit_cost": 250.00,
        "barcode": "123456789012",
        "category_id": "ObjectId",
        "status": "active"
      },
      "category": {
        "_id": "ObjectId",
        "name": "Toilets",
        "description": "Bathroom toilet fixtures"
      },
      "needs_reorder": false,
      "utilization_rate": 50.0,
      "has_tags": true,
      "tag_summary": {
        "reserved": 3,
        "broken": 1,
        "loaned": 1,
        "totalTagged": 5
      },
      "is_low_stock": false,
      "is_out_of_stock": false,
      "is_overstock": false,
      "minimum_stock_level": 5,
      "reorder_point": 3,
      "maximum_stock_level": 50,
      "last_movement_date": "2025-08-27T12:00:00.000Z",
      "last_updated_by": "admin",
      "updatedAt": "2025-08-27T12:00:00.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_items": 1,
    "items_per_page": 50
  },
  "filters": {
    "category_id": null,
    "search": null,
    "status": "all",
    "sort_by": "sku_code",
    "sort_order": "asc"
  }
}
```

### **Tag GET Response**
```javascript
{
  "tags": [
    {
      "_id": "ObjectId",
      "customer_name": "Customer Name",
      "tag_type": "reserved",
      "status": "active",
      "sku_items": [
        {
          "sku_id": {
            "_id": "ObjectId",
            "sku_code": "TOILET-12345",
            "description": "Premium Toilet"
          },
          // NEW: Instance-based tracking
          "selected_instance_ids": ["instanceId1", "instanceId2"],
          "selection_method": "fifo",
          "notes": "Special requirements",
          // CALCULATED: From selected_instance_ids.length
          "quantity": 2,
          "remaining_quantity": 2
        }
      ],
      "project_name": "Project ABC",
      "due_date": "2025-09-01T00:00:00.000Z",
      "notes": "Customer notes",
      "created_by": "admin",
      "total_quantity": 2,
      "remaining_quantity": 2,
      "is_partially_fulfilled": false,
      "is_fully_fulfilled": false,
      "is_overdue": false,
      "fulfillment_progress": 0
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalTags": 1,
    "limit": 50,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

## 🔄 CRITICAL BUSINESS LOGIC

### **Tag Creation Process (Instance-Based)**
1. Validates SKU availability in inventory
2. **Instance selection options**:
   - **Auto (FIFO)**: System selects oldest available instances
   - **Cost-based**: System selects lowest/highest cost instances  
   - **Manual**: Frontend provides specific `selected_instance_ids`
3. Populates `selected_instance_ids` arrays in `sku_items`
4. Assigns `tag_id` to selected instances
5. Updates inventory quantities: moves instances from available → reserved/broken/loaned
6. **Quantity calculation**: `quantity = selected_instance_ids.length` (computed, not stored)

### **Tag Fulfillment Process (Instance-Based)**
1. **Precise fulfillment**: Specify exact quantities per SKU to fulfill
2. **Instance selection**: Choose N oldest instances from `selected_instance_ids` arrays
3. **Instance deletion**: Delete selected instance records from database
4. **Array update**: Remove fulfilled instance IDs from `selected_instance_ids` arrays
5. **Inventory update**: Decreases `total_quantity` and appropriate status quantity
6. **Status check**: Mark tag as fulfilled when all `selected_instance_ids` arrays are empty
7. **Audit trail**: Records fulfillment date, user, and exact instances consumed

### **Inventory Aggregation (Instance-Based)**
- **total_quantity**: COUNT of all instances with this `sku_id` (regardless of `tag_id`)
- **available_quantity**: COUNT of instances with this `sku_id` where `tag_id = null`
- **reserved_quantity**: COUNT of instances with this `sku_id` where tag has `tag_type = 'reserved'`
- **broken_quantity**: COUNT of instances with this `sku_id` where tag has `tag_type = 'broken'`  
- **loaned_quantity**: COUNT of instances with this `sku_id` where tag has `tag_type = 'loaned'`
- **Data integrity**: All counts derived from actual Instance records, ensuring accuracy

---

## 🚨 FRONTEND REQUIREMENTS

### **Data Display Requirements (Instance-Based)**
- Use `sku_code` for SKU identification (not legacy item codes)
- **Quantity calculation**: Use `selected_instance_ids.length` for current quantities
- Show `remaining_quantity` for active tags (computed from array lengths)
- Display cost information from `acquisition_cost` in instances
- Use `tag_summary` for inventory status indicators
- **Manual selection support**: Display instance details when `selection_method = 'manual'`

### **Form Requirements (Instance-Based)**
- SKU selection must validate against `/api/skus`
- Stock additions use `/api/instances/add-stock` endpoint
- **Tag creation supports two formats**:
  - **Auto**: `{ sku_id, quantity, selection_method: 'fifo'/'cost_based' }`
  - **Manual**: `{ sku_id, selected_instance_ids: [...], selection_method: 'manual' }`
- **Fulfillment**: Send `{ item_id: sku_id, quantity_fulfilled }` to fulfill specific quantities

### **State Management Requirements (Instance-Based)**
- Store SKU data separately from inventory data
- Instance data is nested under SKU context
- **Tags reference specific instances**: `selected_instance_ids` arrays contain exact instances
- **Quantity calculations**: Frontend computes quantities as `selected_instance_ids.length`
- Inventory is aggregated view, not raw data
- **Migration compatibility**: Support both old quantity fields and new arrays during transition

---

## ⚠️ LEGACY STRUCTURES TO AVOID

### **DELETED MODELS** (Do NOT reference these):
- ❌ `Item` model (deleted)
- ❌ `UnassignedItem` model (deleted) 
- ❌ Legacy `SKU` structure with embedded items

### **DELETED ROUTES** (Do NOT call these):
- ❌ `/api/items/*` (removed)
- ❌ `/api/unassigned-items/*` (removed)
- ❌ `/api/barcode/*` (moved to SKU routes)

### **LEGACY FIELD NAMES** (Do NOT use these):
- ❌ `item_id` (use `sku_id`)
- ❌ `item_code` (use `sku_code`)
- ❌ `items` arrays (use `sku_items`)

---

## 🧪 BACKEND TESTING STATUS

**All endpoints tested and confirmed working:**
- ✅ Authentication and authorization
- ✅ SKU CRUD operations
- ✅ Instance stock management  
- ✅ Tag creation and fulfillment
- ✅ Inventory aggregation
- ✅ Export/import functionality
- ✅ Barcode operations
- ✅ **MAJOR ENHANCEMENT**: Instance-based tag architecture implemented
- ✅ **PRECISION CONTROL**: Exact instance tracking and selection
- ✅ **MIGRATION READY**: Backward compatibility and conversion script

**Backend is ENHANCED and PRODUCTION-READY with next-generation instance architecture.**

---

## 📞 WHEN FRONTEND ISN'T WORKING

### **DON'T:**
- ❌ Modify backend models
- ❌ Change API response structures
- ❌ Add backend endpoints
- ❌ Modify database queries

### **DO:**
- ✅ Check this reference document
- ✅ Test API endpoints with curl/Postman
- ✅ Adapt frontend data structures
- ✅ Update frontend interfaces to match backend
- ✅ Fix frontend code to use correct field names

---

**Remember: Backend is TESTED and WORKING. Frontend must adapt to backend, not the other way around.**
