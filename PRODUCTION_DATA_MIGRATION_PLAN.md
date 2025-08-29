# PRODUCTION DATA MIGRATION PLAN

**Last Updated:** 2025-08-29 15:15 UTC  
**Status:** READY FOR EXECUTION

## 🚨 **CRITICAL ISSUES IDENTIFIED**

### **Primary Problem:** 42/50 Items Don't Have SKUs Yet!
- **Production:** 50 total items, only 8 have `sku_id` field
- **Issue:** 42 items (84%) reference product detail collections but no SKUs exist
- **Consequence:** Previous migration lost these items because there was no SKU to map them to

### **Data Structure Challenges:**
1. **Legacy Structure:** Items reference `product_details` ObjectId pointing to separate collections (walls, accessories, etc.)
2. **Missing SKUs:** Most product details don't have corresponding SKU records
3. **Different Naming:** Production uses `items` → New architecture uses `instances`
4. **Manual Creation Required:** Need to create SKUs for unmapped product details

---

## 📊 **PRODUCTION DATA ANALYSIS**

### **Collections Overview:**
```
Production (test database):
├── items: 50 records (8 with SKU, 42 without SKU)
├── skus: 8 records  
├── tags: 3 records
├── Product Detail Collections:
│   ├── walls: 18 records
│   ├── accessories: 13 records  
│   ├── miscellaneous: 12 records
│   ├── rawmaterials: 6 records
│   ├── tubs: 1 record
│   ├── toilets: 1 record
│   ├── bases: 1 record
│   └── showerdoors: 1 record
├── categories: 0 records (MISSING!)
└── users: 0 records (MISSING!)
```

### **Target Architecture (stockmanager_dev):**
```
Local Development:
├── instances: 17 records (from previous migration)
├── skus: 6 records
├── tags: 1 record  
├── inventory: 6 records (aggregated)
├── categories: 9 records ✅
├── users: 1 record ✅
└── auditlogs: activity tracking
```

---

## 🎯 **MIGRATION STRATEGY**

### **Phase 1: SKU Creation for Unmapped Product Details**
**CRITICAL:** Must create SKUs for 42 items that don't have them

#### **Step 1.1: Category Mapping**
Create categories that match production product types:
- `walls` → category: `walls` (product)  
- `accessories` → category: `accessories` (product)
- `tubs` → category: `tubs` (product)
- `toilets` → category: `toilets` (product) 
- `vanities` → category: `vanities` (product)
- `bases` → category: `bases` (product)
- `showerdoors` → category: `showerdoors` (product)
- `miscellaneous` → category: `miscellaneous` (product)
- `rawmaterials` → category: `rawmaterials` (product)

#### **Step 1.2: SKU Generation Rules**
For each product detail record without a corresponding SKU:

**Walls Example:**
```javascript
// Product Detail: walls collection
{
  "_id": "689e46eb844159e352af5144",
  "product_line": "Monterey", 
  "color_name": "Carrara",
  "dimensions": "36x96",
  "finish": "Subway"
}

// Generate SKU:
{
  "sku_code": "WALL-689e46eb", // Auto-generated from ObjectId
  "category_id": ObjectId("walls_category_id"),
  "name": "Monterey Carrara 36x96 Subway Panel",
  "brand": "Samuel Mueller", // Default for walls
  "details": {
    "product_line": "Monterey",
    "color_name": "Carrara", 
    "dimensions": "36x96",
    "finish": "Subway"
  },
  "unit_cost": 0, // Will be filled from item.cost
  "status": "active"
}
```

**Accessories Example:**
```javascript
// Product Detail: accessories collection  
{
  "_id": "68a382ce574fa54c42be9af5",
  "name": "Grab Bar",
  "brand": "Samuel Mueller", 
  "model": "Barrington",
  "color": "Brushed Stainless",
  "dimensions": "16\"",
  "finish": "Knurled"
}

// Generate SKU:
{
  "sku_code": "ACC-68a382ce", 
  "category_id": ObjectId("accessories_category_id"),
  "name": "Grab Bar",
  "brand": "Samuel Mueller",
  "model": "Barrington", 
  "details": {
    "color": "Brushed Stainless",
    "dimensions": "16\"", 
    "finish": "Knurled"
  }
}
```

### **Phase 2: Item → Instance Conversion**
Convert all 50 items to instances using proper SKU mapping

#### **Step 2.1: Items With Existing SKUs (8 items)**
Direct conversion:
```javascript
// Production Item
{
  "_id": ObjectId("689e46eb844159e352af5146"),
  "product_type": "wall",
  "product_details": ObjectId("689e46eb844159e352af5144"), 
  "sku_id": ObjectId("68a785ade2eccdc6855d3429"),
  "quantity": 1,
  "location": "HQ",
  "cost": 465,
  "createdAt": "2025-08-14T20:28:27.472Z"
}

// Target Instance
{
  "sku_id": ObjectId("68a785ade2eccdc6855d3429"), // Keep existing
  "acquisition_date": "2025-08-14T20:28:27.472Z",
  "acquisition_cost": 465,
  "tag_id": null,
  "location": "HQ", 
  "supplier": "Unknown", // Default
  "reference_number": "", 
  "notes": "Migrated from production item",
  "added_by": "migration"
}
```

#### **Step 2.2: Items Without SKUs (42 items)**  
Create SKU first, then convert:
1. **Lookup product details** using `product_details` ObjectId
2. **Create corresponding SKU** using generation rules above
3. **Convert item to instance** using new SKU ID
4. **Update item cost** → SKU unit_cost if not set

### **Phase 3: Tag Migration**
Convert 3 existing tags to instance-based structure

#### **Current Tag Structure:**
```javascript
{
  "_id": ObjectId("689e561d1da835664f1d19e0"),
  "item_id": ObjectId("689e4997844159e352af5181"), // OLD: Single item reference
  "customer_name": "TEST",
  "quantity": 1,
  "tag_type": "reserved", 
  "status": "fulfilled"
}
```

#### **Target Tag Structure:**
```javascript
{
  "customer_name": "TEST",
  "tag_type": "reserved",
  "status": "fulfilled", 
  "sku_items": [{
    "sku_id": ObjectId("mapped_sku_id"), // Map from item_id → sku_id 
    "selected_instance_ids": [ObjectId("instance_id")], // Find instance for this item
    "selection_method": "manual",
    "notes": "Migrated from legacy tag"
  }]
}
```

### **Phase 4: User & Category Creation**
Since production has no users or categories, we need to create them

#### **Categories to Create:**
```javascript
const categoriesToCreate = [
  {name: "walls", type: "product", description: "Wall panels and surfaces"},
  {name: "accessories", type: "product", description: "Bathroom accessories"}, 
  {name: "tubs", type: "product", description: "Bathtubs and tub components"},
  {name: "toilets", type: "product", description: "Toilets and toilet components"},
  {name: "bases", type: "product", description: "Shower bases and pans"},
  {name: "showerdoors", type: "product", description: "Shower doors and enclosures"},
  {name: "miscellaneous", type: "product", description: "Miscellaneous products"}, 
  {name: "rawmaterials", type: "product", description: "Raw materials and supplies"}
];
```

#### **Default Admin User:**
```javascript
{
  username: "admin",
  email: "admin@facetrenovations.us", 
  password: "hashedPassword", // Will prompt user
  firstName: "Admin",
  lastName: "User",
  role: "admin",
  isActive: true
}
```

---

## 🛠️ **IMPLEMENTATION APPROACH**

### **Pre-Migration Validation:**
1. **Backup both databases** before any changes
2. **Validate connection strings** and database access
3. **Test write permissions** on target database  
4. **Verify schema compatibility** with current models

### **Migration Execution Order:**
1. ✅ **Create Categories** (8 new categories)
2. ✅ **Create Admin User** (prompt for password)  
3. ✅ **Generate Missing SKUs** (for 42 unmapped product details)
4. ✅ **Convert Items → Instances** (all 50 items)
5. ✅ **Convert Tags** (3 tags to instance-based)
6. ✅ **Generate Inventory Records** (aggregate from instances)
7. ✅ **Validation & Verification**

### **Interactive Prompts Needed:**
- **Admin password:** Secure password for default user
- **Supplier names:** For instances without supplier info  
- **Default costs:** For SKUs without pricing
- **Mapping conflicts:** When product details can't be clearly categorized

---

## ⚠️ **RISK MITIGATION**

### **Data Safety:**
- [ ] **Complete backup** of production database 
- [ ] **Complete backup** of local development database
- [ ] **Rollback scripts** prepared and tested
- [ ] **Validation checksums** for data integrity

### **Migration Validation:**
- [ ] **Record counts match:** 50 items → 50 instances (+ new SKUs)
- [ ] **All items mapped:** No orphaned or unmapped records  
- [ ] **Cost preservation:** All acquisition costs transferred
- [ ] **Tag integrity:** All tag relationships maintained
- [ ] **API functionality:** All endpoints work with migrated data

### **Recovery Plan:**
- **If migration fails:** Restore from backups, analyze issues
- **If data corrupted:** Rollback scripts + fresh migration attempt  
- **If API breaks:** Validate schema compliance, fix model mismatches

---

## 📋 **SUCCESS CRITERIA**

### **Quantitative Goals:**
- ✅ **50/50 items successfully converted** to instances
- ✅ **~42 new SKUs created** for unmapped product details  
- ✅ **3/3 tags migrated** to instance-based structure
- ✅ **8 categories created** matching production types
- ✅ **1 admin user created** for system access
- ✅ **All API endpoints functional** with migrated data

### **Qualitative Goals:**
- ✅ **No data loss:** Every production record has corresponding target record
- ✅ **Referential integrity:** All relationships properly maintained
- ✅ **Cost accuracy:** Financial data perfectly preserved  
- ✅ **Searchable inventory:** All products findable and manageable
- ✅ **Working workflows:** Can add stock, create tags, fulfill orders

---

## 🚀 **NEXT STEPS**

1. **Review this plan** and confirm mapping strategy
2. **Build migration utility** with dry-run capability
3. **Test on database copies** before production run  
4. **Execute migration** with full validation
5. **Verify system functionality** end-to-end

**Key Questions for You:**
1. **Default supplier names** for instances without supplier info?
2. **Password requirements** for default admin user?
3. **Pricing strategy** for generated SKUs without costs?
4. **Any product categories** I'm missing or should rename?
