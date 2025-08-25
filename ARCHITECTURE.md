# Stock Manager Architecture - SKU + Inventory System

## ⚠️ CRITICAL NOTICE: NO MORE ITEM COLLECTION

**THE `Item` COLLECTION HAS BEEN COMPLETELY REMOVED FROM THE DATABASE AND SYSTEM.**

**DO NOT REFERENCE, CREATE, OR USE ANY CODE THAT MENTIONS `Item`, `items`, `item_id`, OR THE OLD ITEM-BASED STRUCTURE.**

---

## Current Architecture (NEW)

### Database Collections

1. **SKU** (`skunews` collection) - Product definitions
2. **Inventory** (`inventories` collection) - Stock tracking per SKU
3. **TagNew** (`tagnews` collection) - Tags that reference SKUs
4. **Categories** (`categories` collection) - Product categorization

### Data Flow

```
SKU (Product Definition) → Inventory (Stock Levels) → Tags (References SKUs)
```

---

## What We Have Now

### ✅ SKU Model (`/backend/src/models/SKUNew.js`)
- Contains product information (name, description, brand, etc.)
- Has `unit_cost`, `sku_code`, `category_id`
- One SKU = One product definition

### ✅ Inventory Model (`/backend/src/models/Inventory.js`)
- Contains stock levels for a specific SKU
- Fields: `available_quantity`, `reserved_quantity`, `broken_quantity`, `loaned_quantity`
- One Inventory record per SKU
- **This replaces the old individual Item tracking**

### ✅ TagNew Model (`/backend/src/models/TagNew.js`)
- Contains `sku_items` array that references SKU IDs
- **CORRECT structure**: `sku_items: [{ sku_id, quantity, remaining_quantity }]`
- **WRONG structure**: `items: [{ item_id }]` ← **DO NOT USE THIS**

---

## What We DON'T Have (REMOVED)

### ❌ Item Collection
- **DELETED** - No longer exists
- **DO NOT CREATE** any new Item references
- **DO NOT USE** any existing Item-based code

### ❌ Legacy Structures
- `item_id` references
- Individual item tracking
- Item-based inventory management

---

## Frontend Guidelines

### ✅ CORRECT API Calls
```javascript
// Get inventory data (includes SKU info)
const inventory = await inventoryApi.getInventory()

// Get specific SKU inventory
const skuInventory = await inventoryApi.getSKUInventory(skuId)

// Work with SKU data
item.sku?.sku_code  // SKU code
item.sku?.name      // Product name
item.total_quantity // Total stock
```

### ❌ INCORRECT References (DO NOT USE)
```javascript
// DON'T DO THIS - Item no longer exists
const items = await itemsApi.getItems()
item.product_details // Old structure
item.item_id         // Doesn't exist
```

---

## Backend Guidelines

### ✅ CORRECT Database Operations
```javascript
// Find inventory for a SKU
const inventory = await Inventory.findOne({ sku_id: skuId })

// Find tags that reference a SKU  
const tags = await TagNew.find({ 'sku_items.sku_id': skuId })

// Get SKU information
const sku = await SKUNew.findById(skuId).populate('category_id')
```

### ❌ INCORRECT Operations (DO NOT USE)
```javascript
// DON'T DO THIS - Item collection doesn't exist
const item = await Item.findById(itemId)
const tags = await TagNew.find({ 'items.item_id': itemId })
```

---

## Tag System Guidelines

### ✅ CORRECT Tag Structure
```javascript
// Tags should reference SKUs, not items
{
  customer_name: "Customer",
  tag_type: "reserved",
  sku_items: [
    {
      sku_id: ObjectId("..."),    // References SKU
      quantity: 2,
      remaining_quantity: 2
    }
  ]
}
```

### ❌ INCORRECT Tag Structure (DO NOT CREATE)
```javascript
// DON'T CREATE TAGS LIKE THIS
{
  customer_name: "Customer", 
  tag_type: "reserved",
  items: [                      // Wrong field name
    {
      item_id: ObjectId("..."), // Wrong - item_id doesn't exist
      quantity: 2
    }
  ]
}
```

---

## Common Mistakes to Avoid

### 1. Using Item-based thinking
- **WRONG**: "Each item has a condition and location"
- **RIGHT**: "Each SKU has inventory levels and tags track reservations"

### 2. Creating Item references
- **WRONG**: `tag.items.forEach(item => item.item_id)`
- **RIGHT**: `tag.sku_items.forEach(skuItem => skuItem.sku_id)`

### 3. Legacy API endpoints
- **WRONG**: `/api/items` endpoints
- **RIGHT**: `/api/inventory` and `/api/skus` endpoints

### 4. Frontend data structure assumptions
- **WRONG**: Expecting `item.product_details` structure
- **RIGHT**: Using `item.sku.name` and inventory-level data

---

## Migration Notes

### What Changed
1. **Individual Items** → **SKU + Inventory aggregation**
2. **Item-based tags** → **SKU-based tags**
3. **Item locations/conditions** → **Inventory-level tracking**
4. **Item quantities** → **Inventory quantity buckets**

### Database State
- All `Item` collections have been removed
- All `items` references in tags are legacy data
- Only `SKU`, `Inventory`, and `TagNew` collections are active

---

## Debugging Inventory Issues

### If you see wrong quantities:

1. **Check Inventory collection** - This holds the truth
2. **Check TagNew collection** - Must use `sku_items` not `items`
3. **Run inventory sync** - Recalculates from tag data
4. **DO NOT look for Item collection** - It doesn't exist

### If tags aren't working:

1. **Verify tags use `sku_items`** with `sku_id` references
2. **DO NOT use `items`** with `item_id` references
3. **Update tag creation** to use SKU IDs only

---

## Quick Reference

| OLD (DO NOT USE) | NEW (USE THIS) |
|------------------|----------------|
| `Item.find()` | `Inventory.find().populate('sku_id')` |
| `item.item_id` | `inventory.sku_id` |
| `item.product_details` | `inventory.sku_id.name` |
| `item.quantity` | `inventory.total_quantity` |
| `item.condition` | Use inventory quantity buckets |
| `tag.items` | `tag.sku_items` |
| `/api/items` | `/api/inventory` |

---

## Final Warning

**IF YOU FIND YOURSELF WRITING CODE THAT REFERENCES `Item`, `item_id`, OR THE OLD ITEM STRUCTURE, STOP IMMEDIATELY. THE ARCHITECTURE HAS CHANGED.**

**ALL INVENTORY FUNCTIONALITY NOW USES SKU + INVENTORY MODEL.**

**TAGS MUST REFERENCE SKU IDs, NOT ITEM IDs.**

---

*This document was created to prevent confusion and ensure consistent use of the new SKU+Inventory architecture.*
