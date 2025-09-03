# TOOL INSTANCE MANAGEMENT SYSTEM - COMPREHENSIVE GUIDE

**Purpose**: This document explains the complete tool checkout/return system architecture, common issues, and debugging procedures for future AI agents and developers.

**Last Updated**: 2025-09-02  
**System Status**: ⚠️ PARTIALLY WORKING - Instance assignment logic fixed but data inconsistencies remain  

---

## 🏗️ SYSTEM ARCHITECTURE OVERVIEW

### **Core Concept: Instance-Based Tool Tracking**

The system tracks **individual physical tool instances** rather than just quantities. Each physical tool gets an `Instance` record that can be:
- **Available** (`tag_id: null`) - Ready for checkout
- **Tagged** (`tag_id: ObjectId`) - Assigned to a checkout/loan/reservation

### **Key Models**

1. **SKU**: Tool definition (what the tool is)
2. **Instance**: Individual physical tool (specific tool #1, #2, etc.)  
3. **Tag**: Checkout/loan/reservation (who has what tools)
4. **Category**: Tool categorization (`type: 'tool'`)

---

## 📊 DATABASE SCHEMA

### **SKU Model** (Tool Definitions)
```javascript
{
  _id: ObjectId,
  sku_code: "DRILL-001",
  name: "Power Drill",
  category_id: ObjectId, // References Category with type: 'tool'
  unit_cost: 89.99,
  status: "active"
}
```

### **Instance Model** (Physical Tools)
```javascript
{
  _id: ObjectId,
  sku_id: ObjectId,        // Which tool type
  tag_id: ObjectId | null, // null = available, ObjectId = assigned to tag
  acquisition_cost: 89.99,
  location: "Tool Storage",
  added_by: "admin"
}
```

### **Tag Model** (Checkouts/Loans)
```javascript
{
  _id: ObjectId,
  customer_name: "John Smith",
  tag_type: "loaned",
  status: "active",
  sku_items: [
    {
      sku_id: ObjectId,
      selected_instance_ids: [ObjectId, ObjectId], // CRITICAL: Instance IDs
      quantity: 2,           // Should equal selected_instance_ids.length
      remaining_quantity: 2  // Should equal selected_instance_ids.length
    }
  ]
}
```

### **Category Model** (Tool Categories)
```javascript
{
  _id: ObjectId,
  name: "power tools",
  type: "tool",  // CRITICAL: Distinguishes tools from products
  status: "active"
}
```

---

## 🔄 CRITICAL BUSINESS FLOWS

### **1. Tool Creation Flow**

**Frontend**: `AddToolModal.vue` → `inventoryStore.createItem()`

**Backend Flow**:
```
1. POST /api/skus (create SKU)
2. POST /api/instances/add-stock (create instances if quantity > 0)
```

**Expected Result**:
- 1 SKU record created
- N Instance records created (where N = requested quantity)
- All instances have `tag_id: null` (available)

**⚠️ COMMON ISSUE**: Tools created with `quantity: 0` have no instances and cannot be checked out.

### **2. Tool Checkout Flow**

**Frontend**: Tools page → Create checkout → Select tools & customer

**Backend Flow**:
```
1. POST /api/tools/checkout
   - Validates all SKUs are tools
   - Creates Tag with sku_items
   - Calls tag.assignInstances()
   - CRITICAL: Calls tag.save() to persist selected_instance_ids
```

**Expected Result**:
- Tag created with status: 'active'
- Each sku_item has populated selected_instance_ids array
- Instance records updated with tag_id pointing to the tag
- Quantities: quantity = remaining_quantity = selected_instance_ids.length

### **3. Tool Return Flow (Partial)**

**Frontend**: Return dialog → Select specific instances → Submit

**Backend Flow**:
```
1. POST /api/tools/:tagId/partial-return
   - Validates instance ownership
   - Updates instances: tag_id = null (or new condition tag)
   - Removes returned instance IDs from sku_items arrays
   - Filters out sku_items with 0 remaining instances
   - Marks tag as fulfilled if no instances remain
```

---

## 🔍 KEY METHODS AND ENDPOINTS

### **Core Backend Methods**

#### **Tag.assignInstances()** (Critical Method)
**Location**: `src/models/Tag.js:182-242`
**Purpose**: Assigns available instances to tag sku_items

```javascript
// Pseudo-code flow:
for each sku_item in tag.sku_items:
  1. Find available instances (tag_id: null)
  2. Select N instances using FIFO/auto/manual method
  3. Update sku_item.selected_instance_ids = [instanceId1, instanceId2...]
  4. Update instances: set tag_id = this.tag._id

// ⚠️ CRITICAL: This method modifies the tag in-memory but DOES NOT SAVE
// Caller MUST call tag.save() after assignInstances()
```

#### **Instance Assignment Logic**
```javascript
// AUTO selection (FIFO - oldest first)
const availableInstances = await Instance.find({ 
  sku_id: item.sku_id, 
  tag_id: null 
}).sort({ acquisition_date: 1 }).limit(requestedQuantity);

// Update tag
item.selected_instance_ids = availableInstances.map(inst => inst._id);

// Update instances
await Instance.updateMany(
  { _id: { $in: instanceIds } },
  { tag_id: this._id }
);
```

### **Critical API Endpoints**

#### **POST /api/tools/checkout** 
**Purpose**: Create new tool checkout/loan
**Key Logic**:
```javascript
const tag = new Tag(tagData);
await tag.save();

await tag.assignInstances();
await tag.save(); // ⚠️ CRITICAL: Must save after assignInstances
```

#### **POST /api/tools/:id/partial-return**
**Purpose**: Return specific instances from a checkout
**Key Logic**:
```javascript
// Remove returned instances from original tag
tag.sku_items = tag.sku_items.filter(item => {
  // Remove returned instance IDs from selected_instance_ids
  // Only keep sku_items with remaining instances > 0
});
```

#### **GET /api/tools/tags**
**Purpose**: Get tool checkouts/loans with populated data
**Key Parameters**: `include_items=true` to populate sku details

---

## ❌ KNOWN ISSUES AND SYMPTOMS

### **Issue #1: Empty selected_instance_ids Arrays**
**Symptom**: Frontend shows "0 in this checkout" for all tools
**Root Cause**: Tag's sku_items have empty selected_instance_ids arrays
**Debug Check**:
```bash
# Check tag structure
node -e "
const Tag = require('./src/models/Tag');
const tag = await Tag.findById('TAG_ID');
console.log(tag.sku_items[0].selected_instance_ids.length); // Should be > 0
"
```

**Common Causes**:
1. `tag.save()` not called after `assignInstances()`
2. No available instances for the SKU
3. `assignInstances()` method failed silently

### **Issue #2: Tools Have No Instances** 
**Symptom**: Cannot create checkouts - "Not enough available instances"
**Root Cause**: SKUs created without corresponding Instance records
**Debug Check**:
```bash
# Check instance count for a tool
node -e "
const Instance = require('./src/models/Instance');
const count = await Instance.countDocuments({ sku_id: 'SKU_ID', tag_id: null });
console.log('Available instances:', count); // Should be > 0
"
```

**Solution**: Create instances via `POST /api/instances/add-stock`

### **Issue #3: Data Inconsistency**
**Symptom**: Instances are tagged but tag's selected_instance_ids is empty
**Root Cause**: Instance.tag_id updated but Tag.sku_items.selected_instance_ids not synced
**Solution**: Manual data repair or re-run assignInstances + save

---

## 🐛 DEBUGGING PROCEDURES

### **1. Check Tool Categories**
```bash
node -e "
const Category = require('./src/models/Category');
const toolCats = await Category.find({ type: 'tool' });
console.log('Tool categories:', toolCats.length);
"
```

### **2. Check Tool SKUs and Instances**
```bash
node -e "
const SKU = require('./src/models/SKU');
const Instance = require('./src/models/Instance');

const toolSKUs = await SKU.find({ category_id: 'TOOL_CATEGORY_ID' });
for (const sku of toolSKUs) {
  const totalInstances = await Instance.countDocuments({ sku_id: sku._id });
  const available = await Instance.countDocuments({ sku_id: sku._id, tag_id: null });
  console.log(sku.sku_code, 'Total:', totalInstances, 'Available:', available);
}
"
```

### **3. Check Tag Data Structure**
```bash
node -e "
const Tag = require('./src/models/Tag');
const tag = await Tag.findById('TAG_ID');
console.log('Tag structure:', {
  customer: tag.customer_name,
  status: tag.status,
  sku_items: tag.sku_items.map(item => ({
    sku_id: item.sku_id,
    quantity: item.quantity,
    selected_ids_count: (item.selected_instance_ids || []).length,
    actual_ids: item.selected_instance_ids
  }))
});
"
```

### **4. Check Instance Assignments**
```bash
node -e "
const Instance = require('./src/models/Instance');
const taggedInstances = await Instance.find({ tag_id: 'TAG_ID' });
console.log('Tagged instances:', taggedInstances.length);
taggedInstances.forEach(inst => {
  console.log('Instance:', inst._id, 'SKU:', inst.sku_id, 'Tag:', inst.tag_id);
});
"
```

---

## 🔧 REPAIR PROCEDURES

### **Fix Empty selected_instance_ids**
```javascript
// Find tag with data inconsistency
const tag = await Tag.findById('TAG_ID');
const instances = await Instance.find({ tag_id: tag._id });

// Group instances by SKU
const instancesBySKU = {};
instances.forEach(inst => {
  const skuId = inst.sku_id.toString();
  if (!instancesBySKU[skuId]) instancesBySKU[skuId] = [];
  instancesBySKU[skuId].push(inst._id);
});

// Update tag sku_items
tag.sku_items.forEach(item => {
  const skuId = item.sku_id.toString();
  const assignedInstances = instancesBySKU[skuId] || [];
  
  if (assignedInstances.length > 0) {
    item.selected_instance_ids = assignedInstances;
    item.quantity = assignedInstances.length;
    item.remaining_quantity = assignedInstances.length;
  }
});

await tag.save();
```

### **Add Instances to Existing Tools**
```javascript
const sku = await SKU.findOne({ sku_code: 'TOOL-CODE' });
const quantity = 2; // Number of instances to create

for (let i = 0; i < quantity; i++) {
  const instance = new Instance({
    sku_id: sku._id,
    acquisition_date: new Date(),
    acquisition_cost: sku.unit_cost || 100,
    location: 'Tool Storage',
    supplier: 'Initial Stock',
    notes: 'Added for checkout functionality',
    added_by: 'system'
  });
  await instance.save();
}
```

---

## ✅ VERIFICATION CHECKLIST

After any fix, verify these conditions:

### **Tool Creation Verification**
- [ ] SKU created with correct category (type: 'tool')
- [ ] Instance records created for each quantity requested  
- [ ] All instances have `tag_id: null` (available)

### **Checkout Verification**
- [ ] Tag created with `status: 'active'`
- [ ] Each sku_item has `selected_instance_ids.length > 0`
- [ ] Each sku_item has `quantity = remaining_quantity = selected_instance_ids.length`
- [ ] Instance records have `tag_id` pointing to the tag
- [ ] Frontend shows correct counts: "N in this checkout"

### **Return Verification**
- [ ] Returned instances have `tag_id: null` or new condition tag
- [ ] Tag's sku_items have instance IDs removed from selected_instance_ids
- [ ] sku_items with 0 remaining instances removed from tag
- [ ] Tag marked as `fulfilled` if no instances remain

---

## 🚨 CURRENT SYSTEM STATE

### **Issue Reported**: 
"TEST tag showing 3 SKUs and no instances"

### **Immediate Debugging Steps**:
1. Find the TEST tag: `Tag.findOne({ customer_name: 'TEST' })`
2. Check its sku_items structure for selected_instance_ids
3. Check if instances exist: `Instance.find({ tag_id: testTag._id })`
4. Run data consistency repair if needed

### **Expected Fix**:
Either the TEST tag needs instance assignment repair, or the TEST tag's instances need to be created/reassigned.

---

## 📝 DEVELOPER NOTES

- **Always call `tag.save()` after `assignInstances()`**
- **Quantities are computed, not stored**: `quantity = selected_instance_ids.length`
- **Instance.tag_id is the source of truth** for which tag an instance belongs to
- **Frontend debugging**: Check browser console logs for tag data structure
- **Backend debugging**: Add console.log to trace assignInstances flow

This system is **instance-centric** - everything revolves around tracking individual physical tools through their lifecycle of available → assigned → returned.
