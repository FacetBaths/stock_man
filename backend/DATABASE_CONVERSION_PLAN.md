# DATABASE CONVERSION PLAN: SQLite → MongoDB

## Executive Summary
This document outlines the technical plan for migrating the Stock Manager application from SQLite to MongoDB, preserving all existing functionality while enabling enhanced scalability and performance.

## Schema Analysis

### New MongoDB Schema Overview

#### Core Models
1. **SKU** - Single source of truth for products/tools
2. **Instance** - Individual product instances with acquisition tracking
3. **Tag** - Customer assignments with Instance references
4. **Inventory** - Aggregated inventory tracking per SKU
5. **Category** - Product/tool categorization
6. **User** - System users with authentication
7. **AuditLog** - System activity tracking

### Key Schema Relationships

```
Category (1) ← → (Many) SKU
SKU (1) ← → (Many) Instance
Tag (1) ← → (Many) Instance (via selected_instance_ids)
SKU (1) ← → (1) Inventory (aggregation)
```

## Migration Strategy

### Phase 1: Schema Mapping Analysis

#### 1.1 SQLite Schema Discovery
- **Objective:** Document current SQLite database structure
- **Deliverables:** Complete table and relationship documentation
- **Tasks:**
  - Extract table schemas
  - Document foreign key relationships
  - Identify data types and constraints
  - Document business logic embedded in queries

#### 1.2 Data Mapping Rules
- **customers** → Preserved in `Tag.customer_name`
- **categories** → `Category` model
- **products/tools** → `SKU` model with category-specific details
- **items** → `Instance` model with SKU references
- **tags** → `Tag` model with Instance references
- **inventory** → Calculated `Inventory` aggregation model

### Phase 2: Migration Utility Development

#### 2.1 Core Migration Engine

**File Structure:**
```
src/migration/
├── index.js              # Main migration orchestrator
├── config/
│   ├── database.js       # Database connection configs
│   └── mapping.js        # Schema mapping definitions
├── extractors/
│   ├── sqlite-extractor.js  # SQLite data extraction
│   └── data-validator.js    # Source data validation
├── transformers/
│   ├── category-transformer.js
│   ├── sku-transformer.js
│   ├── instance-transformer.js
│   ├── tag-transformer.js
│   └── inventory-transformer.js
├── loaders/
│   ├── mongodb-loader.js    # MongoDB data insertion
│   └── integrity-checker.js # Post-load validation
├── utils/
│   ├── logger.js           # Migration logging
│   ├── backup.js           # Backup procedures
│   └── rollback.js         # Rollback utilities
└── tests/
    ├── unit/              # Unit tests
    └── integration/       # Integration tests
```

#### 2.2 Data Transformation Rules

**Categories Transformation:**
```javascript
// SQLite categories → MongoDB Category
{
  name: sqlite.category_name.toLowerCase(),
  type: determineType(sqlite.category_name), // 'product' or 'tool'
  description: sqlite.description || '',
  status: 'active',
  sort_order: sqlite.sort_order || 0
}
```

**Products/Tools → SKU Transformation:**
```javascript
// SQLite products/tools → MongoDB SKU
{
  sku_code: generateSKUCode(sqlite.name, sqlite.id),
  category_id: categoryMapping[sqlite.category_id],
  name: sqlite.name,
  description: sqlite.description || '',
  brand: sqlite.brand || '',
  model: sqlite.model || '',
  details: transformCategoryDetails(sqlite, category),
  unit_cost: sqlite.cost || 0,
  cost_history: [{
    cost: sqlite.cost || 0,
    effective_date: sqlite.created_date || new Date(),
    updated_by: 'migration',
    notes: 'Initial migration cost'
  }],
  status: sqlite.active ? 'active' : 'discontinued'
}
```

**Items → Instance Transformation:**
```javascript
// SQLite items → MongoDB Instance
{
  sku_id: skuMapping[sqlite.product_id || sqlite.tool_id],
  acquisition_date: sqlite.created_date || new Date(),
  acquisition_cost: sqlite.acquisition_cost || sku.unit_cost,
  tag_id: null, // Initially all instances are available
  location: sqlite.location || 'HQ',
  supplier: sqlite.supplier || '',
  reference_number: sqlite.reference_number || '',
  notes: sqlite.notes || '',
  added_by: 'migration'
}
```

**Tags Transformation:**
```javascript
// SQLite tags → MongoDB Tag with Instance references
{
  customer_name: sqlite.customer_name,
  tag_type: mapTagType(sqlite.tag_type),
  status: mapTagStatus(sqlite.status),
  sku_items: await transformTagItems(sqlite.tag_items),
  notes: sqlite.notes || '',
  due_date: sqlite.due_date,
  project_name: sqlite.project_name || '',
  created_by: sqlite.created_by || 'migration',
  last_updated_by: sqlite.last_updated_by || 'migration'
}
```

#### 2.3 Data Integrity Validation

**Pre-Migration Validation:**
- Verify SQLite database integrity
- Check for orphaned records
- Validate data type compatibility
- Identify potential data loss scenarios

**Post-Migration Validation:**
- Record count verification
- Referential integrity checks
- Business logic validation
- Sample data accuracy verification

### Phase 3: Migration Execution Plan

#### 3.1 Migration Order (Critical for Referential Integrity)
1. **Categories** (no dependencies)
2. **Users** (no dependencies) 
3. **SKUs** (depends on Categories)
4. **Instances** (depends on SKUs)
5. **Inventory** (aggregated from Instances)
6. **Tags** (depends on Instances)
7. **AuditLog** (migration events)

#### 3.2 Migration Scripts

**Main Migration Script:**
```javascript
// src/migration/index.js
const MigrationOrchestrator = require('./orchestrator');

async function runMigration() {
  const orchestrator = new MigrationOrchestrator({
    sqliteDbPath: process.env.SQLITE_DB_PATH,
    mongoDbUri: process.env.MONGODB_URI,
    dryRun: process.env.DRY_RUN === 'true'
  });

  try {
    await orchestrator.validateEnvironment();
    await orchestrator.createBackup();
    await orchestrator.extractSourceData();
    await orchestrator.validateSourceData();
    await orchestrator.transformData();
    await orchestrator.validateTransformedData();
    await orchestrator.loadToMongoDB();
    await orchestrator.validateMigration();
    await orchestrator.generateReport();
  } catch (error) {
    await orchestrator.rollback();
    throw error;
  }
}
```

#### 3.3 Error Handling Strategy

**Transaction Management:**
- Use MongoDB transactions for atomic operations
- Implement checkpoint system for large migrations
- Enable rollback to previous checkpoint on failure

**Error Recovery:**
- Detailed error logging with context
- Continue on non-critical errors with warnings
- Abort on critical errors with full rollback

### Phase 4: Testing Strategy

#### 4.1 Unit Testing
- Individual transformer functions
- Data validation functions
- Utility functions
- Error handling scenarios

#### 4.2 Integration Testing
- End-to-end migration on test data
- Database connection handling
- Transaction rollback scenarios
- Performance benchmarking

#### 4.3 User Acceptance Testing
- Functional testing on migrated data
- Business process validation
- Performance validation
- Data accuracy spot-checks

## Technical Specifications

### System Requirements
- **Node.js:** Version 18+ 
- **MongoDB:** Version 6.0+
- **SQLite:** Version 3.35+
- **Memory:** Minimum 4GB RAM
- **Storage:** Sufficient space for both databases during migration

### Performance Considerations
- **Batch Processing:** Process records in batches of 1000
- **Memory Management:** Stream large datasets
- **Index Creation:** Create MongoDB indexes after data loading
- **Connection Pooling:** Use connection pools for optimal performance

### Security Considerations
- **Database Access:** Read-only access to SQLite during migration
- **Backup Security:** Encrypted backups with access controls
- **Audit Trail:** Complete audit log of migration activities
- **Data Privacy:** Preserve any existing data privacy controls

## Risk Assessment and Mitigation

### High-Risk Items
1. **Data Loss During Migration**
   - **Mitigation:** Complete backups, tested rollback procedures
   - **Contingency:** Immediate rollback capability

2. **Extended Downtime**
   - **Mitigation:** Thorough testing, optimization
   - **Contingency:** Staged migration with minimal downtime

3. **Performance Degradation**
   - **Mitigation:** Performance testing, query optimization
   - **Contingency:** Database tuning, indexing strategies

### Medium-Risk Items
1. **Data Relationship Integrity**
   - **Mitigation:** Comprehensive validation testing
   - **Contingency:** Manual data reconciliation procedures

2. **Business Logic Preservation**
   - **Mitigation:** Business rule validation tests
   - **Contingency:** Post-migration business logic verification

## Success Metrics

### Technical Metrics
- **Data Completeness:** 100% of source records migrated
- **Data Accuracy:** <0.1% data discrepancy rate
- **Performance:** Query response times ≤ SQLite baseline
- **Uptime:** <4 hours total downtime for migration

### Business Metrics
- **Functionality:** 100% of existing features working post-migration
- **User Experience:** No degradation in application usability
- **Data Integrity:** All business relationships preserved
- **Audit Compliance:** Complete migration audit trail

## Timeline

### Development Phase (2 weeks)
- Week 1: Schema analysis, migration utility development
- Week 2: Testing, validation, documentation

### Testing Phase (1 week)
- Days 1-3: Development testing and bug fixes
- Days 4-5: Staging environment testing
- Days 6-7: User acceptance testing

### Production Migration (1 day)
- Hours 1-2: Pre-migration backup and preparation
- Hours 3-6: Data migration execution
- Hours 7-8: Post-migration validation and testing

### Total Project Duration: 4 weeks

---

**Document Version:** 1.0  
**Created:** 2025-08-28 15:25 UTC  
**Last Updated:** 2025-08-28 15:25 UTC  
**Status:** Draft - Technical Review Required  
**Next Review Date:** 2025-08-28 17:00 UTC
