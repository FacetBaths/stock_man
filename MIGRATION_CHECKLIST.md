# Stock Manager Migration Checklist

**Last Updated:** 2025-08-26 01:16 UTC
**Status:** 5/12 Backend Tasks Complete, Frontend Not Started

## 📋 Backend Migration Tasks

### ✅ Phase 1: Model Architecture (COMPLETED)
- [x] **Delete all legacy models and references**
  - [x] Remove Item.js, legacy SKU.js models
  - [x] Remove all imports/references throughout codebase
  - [x] Clean up legacy route files (barcode.js, items.js, unassigned-items.js)
  - [x] **Status:** COMPLETE ✅

- [x] **Create Instance model for individual cost tracking**
  - [x] Replace complex Item model with simple Instance model
  - [x] Track acquisition_cost, location, tag_id per instance
  - [x] Create instances routes for stock management
  - [x] **Status:** COMPLETE ✅

### ✅ Phase 2: Tag System Migration (COMPLETED)
- [x] **Fix Tag model to be SKU-based status system**
  - [x] Update Tag model to reference SKUs directly (not legacy items)
  - [x] Change sku_items structure to work with Instance model
  - [x] Update tag creation to work with Instance selection (FIFO vs cost-based)
  - [x] Test tag fulfillment with Instance deletion
  - [x] **Status:** COMPLETE ✅

### ✅ Phase 3: Route Architecture (MOSTLY COMPLETE)
- [x] **Update SKU routes** - COMPLETE ✅
- [x] **Update Inventory routes** - COMPLETE ✅
- [x] **Fix tags.js routes to work with Instance model**
  - [x] Update POST /api/tags to use Instance selection
  - [x] Fix tag fulfillment to delete Instances
  - [x] Update GET routes to populate Instance data
  - [x] **Status:** COMPLETE ✅

- [x] **Update export/import functionality** - COMPLETE ✅
  - [x] Fix export.js to work with SKU/Instance/Inventory data
  - [x] Add CSV import for SKUs and bulk stock additions  
  - [x] Add JSON import/export for complete data backup/restore
  - [x] Create import validation and conflict resolution
  - [x] Test export functionality with new data structure
  - [x] **Status:** COMPLETE ✅

### ❌ Phase 4: Integration Features (PENDING)
- [ ] **Integrate barcode functionality into SKU routes**
  - [ ] Move barcode scanning from legacy routes to SKU management
  - [ ] Add barcode lookup for stock additions
  - [ ] Remove separate barcode.js file
  - [ ] **Status:** NOT STARTED ❌

- [ ] **Replace all auth with authEnhanced**
  - [ ] Audit all routes to use authEnhanced middleware
  - [ ] Remove legacy auth.js middleware
  - [ ] Test role-based permissions
  - [ ] **Status:** MOSTLY DONE, NEEDS VERIFICATION ❌

### ❌ Phase 5: Backend Polish (PENDING)
- [ ] **Test all API endpoints**
  - [ ] Test SKU CRUD operations
  - [ ] Test Instance stock management
  - [ ] Test Tag creation with Instance selection
  - [ ] Test Inventory aggregation accuracy
  - [ ] **Status:** NOT STARTED ❌

- [ ] **Performance optimization**
  - [ ] Ensure proper database indexing
  - [ ] Test query performance with large datasets
  - [ ] Optimize aggregation pipelines
  - [ ] **Status:** NOT STARTED ❌

## 🎨 Frontend Migration Tasks

### ❌ Phase 6: Frontend Architecture (NOT STARTED)
- [ ] **Update TypeScript interfaces**
  - [ ] Remove legacy Item interfaces
  - [ ] Add Instance interface
  - [ ] Update SKU interface to match backend
  - [ ] Update API response types
  - [ ] **Status:** NOT STARTED ❌

- [ ] **Update Pinia stores**
  - [ ] inventory.ts store for new architecture
  - [ ] sku.ts store for SKU management
  - [ ] tag.ts store for new tag system
  - [ ] **Status:** NOT STARTED ❌

### ❌ Phase 7: Component Migration (NOT STARTED)
- [ ] **Update InventoryTable.vue**
  - [ ] Show SKU-based data instead of items
  - [ ] Add Instance cost information
  - [ ] Update search/filtering
  - [ ] **Status:** NOT STARTED ❌

- [ ] **Update AddItemModal.vue → AddStockModal.vue**
  - [ ] Change to add instances with cost tracking
  - [ ] Add supplier and reference number fields
  - [ ] Remove legacy item fields
  - [ ] **Status:** NOT STARTED ❌

- [ ] **Update CreateTagModal.vue**
  - [ ] Show available instances for selection
  - [ ] Implement FIFO vs cost-based selection
  - [ ] Update to work with new tag structure
  - [ ] **Status:** NOT STARTED ❌

- [ ] **Fix frontend category dropdown issue**
  - [ ] Ensure categories API serves proper data
  - [ ] Test dashboard category filtering
  - [ ] **Status:** NOT STARTED ❌

### ❌ Phase 8: Frontend Polish (NOT STARTED)
- [ ] **Update Dashboard.vue**
  - [ ] Show inventory stats from new architecture
  - [ ] Update charts and metrics
  - [ ] **Status:** NOT STARTED ❌

- [ ] **Update all other components**
  - [ ] Tags.vue view
  - [ ] SKUManagement.vue view
  - [ ] Any other components referencing old models
  - [ ] **Status:** NOT STARTED ❌

## 🔄 Database Conversion Utility

### ❌ Phase 9: Production Database Migration (CRITICAL)
- [ ] **Create db_conversion utility**
  - [ ] Build script to convert production database to new architecture
  - [ ] Map legacy Item records to Instance model with acquisition costs
  - [ ] Convert legacy SKU records to new SKU structure with details object
  - [ ] Migrate Tag records from item-based to SKU/Instance-based structure
  - [ ] Handle data conflicts and validation errors gracefully
  - [ ] Create interactive prompts for missing/ambiguous data
  - [ ] Generate conversion report with statistics and warnings
  - [ ] Create rollback mechanism for safety
  - [ ] **Status:** NOT STARTED ❌
  - [ ] **Priority:** RUN ONCE, AFTER ALL OTHER TASKS COMPLETE

## 🧪 Testing & Deployment

### ❌ Phase 10: Final Testing (NOT STARTED)
- [ ] **End-to-end testing**
  - [ ] Test complete workflows (add stock → create tags → fulfill)
  - [ ] Test user roles and permissions
  - [ ] Test error handling
  - [ ] **Status:** NOT STARTED ❌

- [ ] **Deployment verification**
  - [ ] Test on staging environment
  - [ ] Verify database migrations work
  - [ ] Test production deployment
  - [ ] **Status:** NOT STARTED ❌

## 📊 Progress Summary

**Overall Progress:** 5/28 Major Tasks Complete (18%)

### Backend: 5/12 Complete (42%)
- ✅ Model Architecture: 2/2 complete
- ✅ Tag System: 1/1 complete  
- ✅ Route Architecture: 4/4 complete
- ❌ Integration: 0/3 complete
- ❌ Polish: 0/2 complete

### Frontend: 0/10 Complete (0%)
- ❌ Architecture: 0/4 complete
- ❌ Components: 0/4 complete
- ❌ Polish: 0/2 complete

### Database Conversion: 0/1 Complete (0%)
- ❌ Production migration utility: 0/1 complete

### Testing & Deployment: 0/3 Complete (0%)
- ❌ All testing tasks pending

---

## 🚨 CRITICAL NEXT STEPS:
1. **Integrate barcode functionality** into SKU routes
3. **Verify all routes use authEnhanced** middleware
4. **Begin frontend migration** once backend is stable

## 📝 Notes:
- Instance model successfully replaces complex Item model
- Cost tracking now works at individual instance level
- Repository structure is clean and organized
- Need to focus on completing backend before frontend migration
