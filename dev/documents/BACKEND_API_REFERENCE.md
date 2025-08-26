# BACKEND API REFERENCE
**AUTHORITATIVE DOCUMENTATION FOR FRONTEND DEVELOPMENT**

**CRITICAL:** This backend is TESTED and WORKING. Do NOT modify backend to fit frontend preferences.
Frontend must adapt to these EXACT structures and endpoints.

**Last Updated:** 2025-08-26 04:00 UTC
**Backend Status:** STABLE AND TESTED ✅

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

### **Tag Model** (Status/Allocation System)
```javascript
{
  "_id": "ObjectId",
  "customer_name": "String",
  "tag_type": "String (reserved/broken/imperfect/loaned/stock)",
  "status": "String (active/fulfilled/cancelled)",
  "sku_items": [
    {
      "sku_id": "ObjectId (ref to SKU)",
      "quantity": "Number",
      "notes": "String",
      "remaining_quantity": "Number"
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
        "description": "Premium Toilet",
        "current_cost": 250.00
      },
      "needs_reorder": false,
      "utilization_rate": 50.0,
      "has_tags": true,
      "tag_summary": {
        "reserved": 3,
        "broken": 1,
        "loaned": 1,
        "totalTagged": 5
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_items": 1,
    "items_per_page": 50
  },
  "filters": {
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
          "quantity": 2,
          "notes": "Special requirements",
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

### **Tag Creation Process**
1. Validates SKU availability in inventory
2. Uses FIFO (First-In-First-Out) for instance selection
3. Moves instances from available → reserved/broken/loaned
4. Updates inventory quantities automatically
5. Assigns tag_id to selected instances

### **Tag Fulfillment Process**
1. Deletes assigned instances from database
2. Updates inventory: decreases total_quantity and reserved_quantity
3. Marks tag as fulfilled
4. Records fulfillment date and user

### **Inventory Aggregation**
- **total_quantity**: Count of all instances for SKU
- **available_quantity**: Instances where tag_id is null
- **reserved_quantity**: Instances tagged as 'reserved'
- **broken_quantity**: Instances tagged as 'broken'  
- **loaned_quantity**: Instances tagged as 'loaned'

---

## 🚨 FRONTEND REQUIREMENTS

### **Data Display Requirements**
- Use `sku_code` for SKU identification (not legacy item codes)
- Show `remaining_quantity` for active tags
- Display cost information from `acquisition_cost` in instances
- Use `tag_summary` for inventory status indicators

### **Form Requirements**
- SKU selection must validate against `/api/skus`
- Stock additions use `/api/instances/add-stock` endpoint
- Tag creation requires `sku_items` array format (not legacy item format)

### **State Management Requirements**
- Store SKU data separately from inventory data
- Instance data is nested under SKU context
- Tags reference SKUs, not individual instances in UI
- Inventory is aggregated view, not raw data

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
- ✅ **CRITICAL BUG FIXED**: Tag fulfillment properly clears reserved inventory

**Backend is STABLE and PRODUCTION-READY for frontend integration.**

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
