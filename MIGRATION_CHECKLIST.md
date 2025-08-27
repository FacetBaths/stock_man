# Stock Manager Migration Checklist

**Last Updated:** 2025-08-27 20:54 UTC
**Status:** 10/10 Backend Tasks Complete (100% - INSTANCE ARCHITECTURE), 6/10 Frontend Tasks Complete

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

### ✅ Phase 3: Route Architecture (COMPLETED)
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

### ✅ Phase 4: Integration Features (COMPLETED)
- [x] **Add template download endpoints for import formats** - COMPLETE ✅
  - [x] Create GET /api/export/templates/sku-import endpoint (CSV & JSON)
  - [x] Create GET /api/export/templates/stock-import endpoint (CSV & JSON)
  - [x] Use only actual model fields (no made-up fields)
  - [x] Include realistic example data for both creating SKUs and stock instances
  - [x] JSON format should include field descriptions and validation rules
  - [x] CSV format should be ready for Excel/Google Sheets
  - [x] **Status:** COMPLETED ✅ (Added 2025-08-26)

- [x] **Integrate barcode functionality into SKU routes** - COMPLETE ✅
  - [x] Move barcode scanning from legacy routes to SKU management
  - [x] Add barcode lookup for stock additions
  - [x] Remove separate barcode.js file (none existed)
  - [x] **Status:** COMPLETE ✅ (Added 2025-08-26)

- [x] **Replace all auth with authEnhanced** - COMPLETE ✅
  - [x] Audit all routes to use authEnhanced middleware
  - [x] Remove legacy auth.js middleware (no legacy middleware found)
  - [x] Test role-based permissions
  - [x] **Status:** COMPLETE ✅ (Verified 2025-08-26)

### ✅ Phase 5: Backend Polish (COMPLETED)
- [x] **Test all API endpoints** - COMPLETE ✅
  - [x] Test SKU CRUD operations
  - [x] Test Instance stock management
  - [x] Test Tag creation with Instance selection
  - [x] Test Tag fulfillment with Instance deletion
  - [x] Test Inventory aggregation accuracy
  - [x] Test Export/Import functionality
  - [x] Test Barcode lookup and stock addition
  - [x] Test Categories CRUD and filtering
  - [x] Test User authentication and role permissions
  - [x] CRITICAL BUG FIXED: Authentication system AuditLog validation errors
  - [x] CRITICAL BUG FIXED: Security logging now works properly
  - [x] CRITICAL BUG FIXED: Tag fulfillment now properly clears reserved inventory
  - [x] **Status:** COMPLETE ✅ (Completed 2025-08-26 05:20 UTC)

- [x] **🏗️ MAJOR: Implement Instance-Based Tag System Architecture** - COMPLETED 2025-08-27
  - [x] Complete redesign of Tag model to use selected_instance_ids arrays
  - [x] Replace quantity/remaining_quantity dual-tracking with single source of truth
  - [x] Enhance API routes to support instance-based operations
  - [x] Create comprehensive migration script for existing tag data
  - [x] Update frontend interfaces and components for instance calculations
  - [x] Add foundation for manual instance selection (FIFO, cost-based, manual)
  - [x] Maintain backward compatibility during transition period
  - [x] **Enhancement:** Eliminates quantity mismatch issues permanently
  - [x] **Benefit:** Enables precise instance tracking and selection
  - [x] **Impact:** Foundation for advanced inventory management features
  - [x] **Status:** COMPLETE ✅ (Major architectural improvement)

- [ ] **Performance optimization**
  - [ ] Ensure proper database indexing
  - [ ] Test query performance with large datasets
  - [ ] Optimize aggregation pipelines
  - [ ] **Status:** DEFERRED ⏸️ (Low priority - after frontend completion)

## 🎨 Frontend Migration Tasks

### ✅ Phase 6: Frontend Architecture (IN PROGRESS)
- [x] **Update TypeScript interfaces** - COMPLETED 2025-08-26 04:24 UTC
  - [x] Remove legacy Item interfaces
  - [x] Add Instance interface
  - [x] Update SKU interface to match backend
  - [x] Update API response types
  - [x] **Status:** COMPLETE ✅

- [x] **Update Pinia stores** - COMPLETED 2025-08-26 04:58 UTC
  - [x] inventory.ts store updated for new architecture
  - [x] sku.ts store verified for SKU management
  - [x] tag.ts store verified for new tag system
  - [x] instancesApi created for stock management
  - [x] All legacy API calls removed from components
  - [x] **Status:** COMPLETE ✅

### ✅ Phase 7: Component Migration (4/6 COMPLETE)
- [x] **Update InventoryTable.vue** - COMPLETED 2025-08-26 17:16 UTC
  - [x] Show SKU-based data instead of items
  - [x] Add Instance cost information
  - [x] Update search/filtering
  - [x] CRITICAL BUG FIXED: Infinite loop causing system freeze
  - [x] **Status:** COMPLETE ✅

- [x] **Update AddItemModal.vue → AddStockModal.vue** - COMPLETED 2025-08-26 18:01 UTC
  - [x] Rename component file to AddStockModal.vue
  - [x] Update import statements in parent components
  - [x] Change to add instances with cost tracking
  - [x] Add supplier and reference number fields  
  - [x] Remove legacy item fields
  - [x] **Status:** COMPLETE ✅

- [x] **Update CreateTagModal.vue** - ENHANCED 2025-08-27 20:54 UTC
  - [x] Show available instances for selection
  - [x] Implement FIFO vs cost-based selection
  - [x] Update to work with new instance-based tag structure
  - [x] Removed legacy CreateTagModal.vue, renamed CreateTagModalNew.vue
  - [x] Updated imports in Tags.vue, removed debugging logs
  - [x] ENHANCED: Added instance selection foundation for manual selection
  - [x] UPDATED: Component calculations use selected_instance_ids.length
  - [x] **Status:** COMPLETE ✅ (Enhanced with instance architecture)

- [ ] **Fix frontend category dropdown issue**
  - [ ] Ensure categories API serves proper data
  - [ ] Test dashboard category filtering
  - [ ] **Status:** NOT STARTED ❌

- [x] **Update Tags.vue for instance-based calculations** - COMPLETED 2025-08-27 20:54 UTC
  - [x] Updated quantity calculations to use selected_instance_ids.length
  - [x] Enhanced display functions to work with instance arrays
  - [x] Updated table formatting for new tag structure
  - [x] Maintained backward compatibility during transition
  - [x] **Status:** COMPLETE ✅

- [ ] **Fix category display in inventory items**
  - [ ] Investigate why TEST TOILET shows "Unknown Category" in inventory table
  - [ ] Verify SKU-to-category relationship in database and API responses
  - [ ] Fix category population in inventory table display
  - [ ] Test that all inventory items show correct category names
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

**Overall Progress:** 16/24 Major Tasks Complete (67%) - INSTANCE ARCHITECTURE COMPLETE

### Backend: 10/10 Complete (100%) + 1 Deferred
- ✅ Model Architecture: 2/2 complete
- ✅ Tag System: 1/1 complete  
- ✅ Route Architecture: 4/4 complete
- ✅ Integration: 3/3 complete
- ✅ Polish: 3/3 complete (INSTANCE ARCHITECTURE MAJOR ENHANCEMENT, 1 deferred performance)

### Frontend: 6/10 Complete (60%)
- ✅ Architecture: 2/2 complete
- ⏳ Components: 4/6 complete (INSTANCE ARCHITECTURE ENHANCED)
- ❌ Polish: 0/2 complete

### Database Conversion: 0/1 Complete (0%)
- ❌ Production migration utility: 0/1 complete

### Testing & Deployment: 0/3 Complete (0%)
- ❌ All testing tasks pending

---

## 🚨 CRITICAL NEXT STEPS:
1. **Performance optimization** - complete backend before frontend migration
2. **Begin frontend migration** once backend is fully stable

## 📝 Notes:
- Instance model successfully replaces complex Item model
- Cost tracking now works at individual instance level
- Repository structure is clean and organized
- Need to focus on completing backend before frontend migration

