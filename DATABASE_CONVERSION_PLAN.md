# DATABASE CONVERSION UTILITY PLAN

**Purpose:** Convert production database from legacy architecture to new instance-based architecture

**Created:** 2025-08-28 14:55 UTC
**Status:** PREPARATION COMPLETE - Ready for implementation after all other tasks

---

## 🎯 **CONVERSION REQUIREMENTS** (from MIGRATION_CHECKLIST.md lines 187-198)

### **Core Tasks:**
1. **Map legacy Item records → Instance model** with acquisition costs
2. **Convert legacy SKU records** → new SKU structure with details object  
3. **Migrate Tag records** from item-based → SKU/Instance-based structure
4. **Handle data conflicts** and validation errors gracefully
5. **Create interactive prompts** for missing/ambiguous data
6. **Generate conversion report** with statistics and warnings
7. **Create rollback mechanism** for safety
8. **Priority:** RUN ONCE, AFTER ALL OTHER TASKS COMPLETE

---

## 📋 **CONVERSION MAPPING STRATEGY**

### **1. Legacy Item → Instance Conversion**
```javascript
// Legacy Item structure (to be converted)
{
  _id: ObjectId,
  sku_id: ObjectId,
  acquisition_date: Date,
  acquisition_cost: Number,
  location: String,
  // ... other legacy fields
}

// New Instance structure (target)
{
  _id: ObjectId,
  sku_id: ObjectId,
  acquisition_date: Date,
  acquisition_cost: Number, // Frozen at creation
  tag_id: null,            // Initially available
  location: String,
  supplier: String,        // Prompt if missing
  reference_number: String // Prompt if missing
}
```

### **2. Legacy SKU → New SKU Conversion**
```javascript
// Legacy SKU (complex embedded structure)
{
  _id: ObjectId,
  sku_code: String,
  // ... embedded product details
}

// New SKU (clean reference-based)  
{
  _id: ObjectId,
  sku_code: String,
  category_id: ObjectId,   // Map to categories
  name: String,
  // ... clean structure from ARCHITECTURE.md
}
```

### **3. Legacy Tag → Instance-Based Tag Conversion**
```javascript
// Legacy Tag (item-based)
{
  sku_items: [{
    sku_id: ObjectId,
    quantity: Number,
    remaining_quantity: Number
  }]
}

// New Tag (instance-based)
{
  sku_items: [{
    sku_id: ObjectId,
    selected_instance_ids: [ObjectId], // Array of specific instances
    selection_method: 'fifo',          // Default to FIFO
    // quantity calculated as selected_instance_ids.length
  }]
}
```

---

## 🛠️ **IMPLEMENTATION APPROACH**

### **Phase 1: Analysis & Validation**
1. **Scan production database** for data integrity issues
2. **Count records** for conversion estimation  
3. **Identify conflicts** (missing references, orphaned data)
4. **Generate analysis report** with statistics

### **Phase 2: Data Preparation**
1. **Create backup** of production database
2. **Create rollback scripts** for safety
3. **Prepare conversion mappings** with user prompts
4. **Test conversion on copy** of production data

### **Phase 3: Interactive Conversion**
1. **Prompt for missing data** (suppliers, reference numbers)
2. **Handle conflicts** with user decisions
3. **Convert in order:** Items → Instances, Tags → Instance-based
4. **Validate converted data** against new schema

### **Phase 4: Verification & Reporting**
1. **Run data integrity checks** on converted database
2. **Generate conversion report** with statistics
3. **Test API endpoints** with converted data
4. **Prepare rollback procedure** documentation

---

## 🚨 **CRITICAL SAFETY MEASURES**

### **Before Conversion:**
- [ ] **Full database backup** created and verified
- [ ] **Rollback script** tested on sample data
- [ ] **Conversion utility** tested on development copy
- [ ] **All team members notified** of maintenance window

### **During Conversion:**
- [ ] **Monitor conversion progress** with detailed logging
- [ ] **Handle errors gracefully** with user prompts
- [ ] **Maintain audit trail** of all changes made
- [ ] **Stop on critical errors** to prevent data corruption

### **After Conversion:**
- [ ] **Verify data integrity** with comprehensive checks
- [ ] **Test all API endpoints** work with converted data
- [ ] **Run frontend application** to ensure compatibility
- [ ] **Keep rollback available** for emergency recovery

---

## 📊 **CONVERSION SCRIPT STRUCTURE**

```
scripts/
├── db_conversion/
│   ├── conversion_utility.js     # Main conversion orchestrator
│   ├── analyzers/
│   │   ├── data_analyzer.js      # Scan and analyze existing data
│   │   ├── conflict_detector.js  # Find orphaned/conflicting records
│   │   └── statistics_generator.js # Generate conversion statistics
│   ├── converters/
│   │   ├── item_to_instance.js   # Convert Items → Instances
│   │   ├── sku_converter.js      # Convert legacy SKUs → new structure
│   │   └── tag_converter.js      # Convert Tags → instance-based
│   ├── validators/
│   │   ├── schema_validator.js   # Validate against new schemas
│   │   └── integrity_checker.js  # Check referential integrity
│   ├── utils/
│   │   ├── backup_manager.js     # Database backup/restore
│   │   ├── prompt_manager.js     # Interactive user prompts
│   │   └── rollback_generator.js # Create rollback scripts
│   └── reports/
│       ├── analysis_report.js    # Pre-conversion analysis
│       ├── conversion_report.js  # Post-conversion summary
│       └── error_logger.js       # Detailed error logging
```

---

## ✅ **PREPARATION STATUS**

- [x] **Requirements analyzed** from MIGRATION_CHECKLIST.md
- [x] **Conversion strategy designed** for all legacy structures
- [x] **Implementation approach planned** with safety measures
- [x] **Script structure designed** for modular development
- [x] **Safety measures defined** for production conversion
- [x] **Ready for implementation** after frontend completion

---

## 🎯 **NEXT STEPS**

1. **Complete current frontend task** (workflow testing)
2. **Implement database conversion utility** using this plan
3. **Test conversion thoroughly** on development data
4. **Schedule production conversion** after all testing complete

**Priority:** Execute AFTER all other migration tasks complete (Phase 9)
