# Frontend Redesign Plan

**Date:** August 2025  
**Version:** 1.0  
**Purpose:** Redesign frontend to align with proper backend architecture and warehouse workflows

---

## 🎯 **Executive Summary**

The frontend needs complete restructuring to work with the proper backend architecture where:
- **Tags reference Items** (not SKUs directly)
- **Items reference SKUs** (with quantity = 1 per Item)
- **Bundle SKUs** expand into component Items
- **Tools** use the same system but with different workflows
- **Scanning** is the primary input method with fallback search/browse

**Core Goals:**
- Align all data flows with Items → SKUs → Inventory architecture
- Prioritize scanner-first workflows with fallback interfaces
- Handle bundle SKUs transparently in all operations
- Separate tool lending from product inventory
- Streamline receiving → tagging → fulfillment workflows

---

## 🏗️ **Data Architecture Changes**

### **Current Frontend Problems**
```javascript
// WRONG - Frontend currently does this:
const payload = {
  items: [{
    item_id: "sku_id_12345", // SKU ID, not Item ID
    quantity: 5              // Multiple units per "item"
  }]
}
```

### **Correct Backend Contract**
```javascript
// CORRECT - What backend expects:
const payload = {
  items: [{
    item_id: "item_id_67890", // Actual Item record ID
    quantity: 1               // Always 1 per Item record
  }]
}
```

### **New Data Flow**
```
Scanner Input (SKU) → Find/Create Items → Reference Items in Tags → Update Inventory
```

---

## 🔧 **Core Workflows & Requirements**

### **1. Receiving Workflow (Primary)**
**Most common daily operation**

**User Story:** "I received a shipment for Job #1234. I scan each item to add it to inventory and immediately tag it as reserved for that customer."

**Technical Requirements:**
- Scan SKU or Bundle SKU
- Auto-create Item records (quantity=1 each)
- Immediately offer to tag items during receiving
- Handle bundle expansion transparently
- Default location to 'HQ'
- Batch operations for efficiency

**UI Requirements:**
- Prominent scan input that doesn't close on Enter
- Real-time feedback showing what was added
- Quick tag assignment during receiving
- Progress indicator for batch operations

### **2. Tagging Workflow**
**Reserve, broken, loaned, imperfect items**

**User Story:** "I need to reserve 3 wall panels for Smith job. I scan each panel and tag them all at once."

**Technical Requirements:**
- Scan to find available Items (quantity > 0)
- Support both individual and batch tagging
- Validate Item availability before tagging
- Handle bundle SKU scanning (find component Items)
- Create tags with proper Item references

**UI Requirements:**
- Scanner input with live Item lookup
- Visual feedback showing selected Items
- Fallback searchable Item list
- Batch tagging interface
- Tag type selection (reserved/broken/etc.)

### **3. Send for Install / Product Used**
**Remove items from inventory and tags**

**User Story:** "Job is complete. I scan the items that were used to remove them from inventory and close the tag."

**Technical Requirements:**
- Scan to find tagged Items
- Remove from both tags and inventory
- Auto-close empty tags
- Handle partial tag fulfillment
- Audit trail for used items

**UI Requirements:**
- Scanner input for fulfillment
- Show tag status and remaining items
- Confirmation before removal
- Progress tracking for large jobs

### **4. Tool Lending**
**Track tool borrowing and returns**

**User Story:** "John Doe is borrowing the laser level for the weekend. I scan the tool and assign it to him."

**Technical Requirements:**
- Use existing tag system with tag_type: 'loaned'
- Track borrower, borrow date, return date
- Tools excluded from inventory counts
- +1/-1 quantity on return/borrow
- Tool-specific category filtering

**UI Requirements:**
- Tool-specific interface (separate from products)
- Borrower selection/entry
- Due date setting
- Return scanning workflow
- Tool availability status

### **5. SKU Management + Bundle SKUs**
**Define products and bundle relationships**

**User Story:** "We have a new shower kit bundle. I need to define which individual items make up this bundle."

**Technical Requirements:**
- CRUD operations for SKUs
- Bundle configuration interface
- Bundle component validation
- Category management (products vs tools)
- Cost tracking

**UI Requirements:**
- SKU creation/editing forms
- Bundle component selection
- Bundle testing (availability checking)
- Category assignment
- Scanner-safe inputs (don't close modals on Enter)

---

## 📊 **API Contract Requirements**

### **Items API (New/Enhanced)**
```javascript
// GET /api/items - List all items with availability
{
  items: [{
    _id: "item_id",
    sku_id: {
      _id: "sku_id",
      sku_code: "SMMW3696-47V",
      name: "Wall Panel",
      category_id: { name: "wall" }
    },
    quantity: 1,
    location: "HQ",
    condition: "new"
  }]
}

// POST /api/items/scan - Scan SKU to find/create Items
{
  sku_code: "SMMW3696-47V",
  quantity_to_add: 3, // For receiving
  location: "HQ"
}
```

### **Bundle SKU Expansion**
```javascript
// GET /api/skus/:sku_code/expand - Handle bundle SKUs
{
  is_bundle: true,
  components: [{
    sku_id: "component_sku_1",
    quantity: 2
  }],
  available_sets: 1 // How many complete bundles available
}
```

### **Tag Creation (Fixed)**
```javascript
// POST /api/tags - Create with Item IDs
{
  customer_name: "Smith Job",
  tag_type: "reserved", 
  items: [{
    item_id: "actual_item_id", // Not SKU ID!
    quantity: 1,
    notes: ""
  }]
}
```

---

## 🎨 **Page-by-Page Redesign**

### **1. Dashboard Page**
**Current Issues:**
- Uses complex inventory aggregations
- Mixes products and tools in counts

**New Requirements:**
- Separate product vs tool metrics
- Items-based counting (not SKU-based)
- Bundle availability summary
- Scanner input for quick actions

**UI Changes:**
- Header: Persistent scan input + mode selector
- Cards: Products, Tools, Active Tags, Recent Activity
- Quick Actions: Receive, Tag, Send for Install
- Alerts: Low stock, overdue tags, unreturned tools

### **2. Inventory Page**
**Current Issues:**
- Shows aggregate inventory counts
- No Item-level visibility

**New Requirements:**
- Show all Items with SKU details
- Filter by availability, location, condition
- Support both product and tool views
- Bundle availability indicators

**UI Changes:**
- Scan input for quick lookup
- Filterable table: SKU, Location, Condition, Quantity
- Bundle expansion view
- Product/Tool toggle
- Item actions: Tag, Move, Edit

### **3. Tag Management Page**
**Current Issues:**
- Expects SKU-based tag structure
- Complex nested data access

**New Requirements:**
- Show tags with Item details populated
- Support partial fulfillment
- Tool loans vs product reservations

**UI Changes:**
- Tag list with Item breakdown
- Scan input for fulfillment
- Filter by tag type, customer, status
- Bulk actions for fulfillment
- Tool return interface

### **4. Receiving Page (New)**
**Primary workflow page**

**Requirements:**
- Scan-first interface for adding inventory
- Immediate tagging option
- Batch processing
- Bundle SKU handling
- Real-time feedback

**UI Design:**
- Large scan input field
- Received items queue
- Quick tag assignment
- Location override
- Batch operations panel

### **5. SKU Management Page**
**Current Issues:**
- No bundle SKU support
- Scanner input may close modals

**New Requirements:**
- Bundle SKU creation/editing
- Component selection interface
- Scanner-safe forms
- Tool vs product categorization

**UI Changes:**
- SKU CRUD with category selection
- Bundle management modal
- Component picker with availability
- Scanner input safeguards
- Tool-specific fields

### **6. Tools Page (New)**
**Dedicated tool lending interface**

**Requirements:**
- Tool-only item filtering  
- Loan creation/management
- Borrower tracking
- Return workflow
- Availability status

**UI Design:**
- Tool inventory view
- Loan creation form
- Active loans list
- Return scanning interface
- Borrower history

---

## 🚀 **Implementation Phases**

### **Phase 1: Core Data Layer**
**Priority: Critical**
1. Fix API utility functions to use Item IDs
2. Update TypeScript interfaces for proper contracts
3. Create Item-based data fetching hooks
4. Implement scanner input components

**Components to Update:**
- `api.ts` - All functions to use Item IDs
- `types.ts` - Item, Tag, SKU interfaces  
- Scanner input component (reusable)
- Item lookup utilities

### **Phase 2: Basic Item Management**
**Priority: High**
1. Update Inventory page for Item-based display
2. Fix Tag creation to use Item selection
3. Implement basic receiving workflow
4. Bundle SKU expansion logic

**Components to Update/Create:**
- `InventoryTable.vue` → `ItemsTable.vue`
- `CreateTagModal.vue` → Scanner + Item selection
- `ReceivingPage.vue` (new)
- Bundle expansion utilities

### **Phase 3: Advanced Workflows**
**Priority: Medium**
1. Tool lending system
2. Send for Install workflow  
3. SKU management with bundles
4. Dashboard updates

**Components to Update/Create:**
- `ToolsPage.vue` (new)
- `SKUManagement.vue` - Add bundle support
- `SendForInstall.vue` (new)
- `Dashboard.vue` - Separate metrics

### **Phase 4: Polish & Optimization**
**Priority: Low**
1. Advanced filtering and search
2. Batch operations optimization
3. Mobile responsiveness
4. Performance optimizations

---

## 🔧 **Technical Requirements**

### **Scanner Integration**
- Prevent Enter key from closing modals during scan input
- Auto-focus scan inputs after operations
- Visual feedback for successful scans
- Error handling for invalid SKUs

### **Bundle SKU Handling**
- Transparent expansion in all workflows
- Availability checking across components
- Visual indication of bundle vs individual items
- Component shortage warnings

### **Real-time Updates**
- Inventory counts update after operations
- Tag status changes reflected immediately  
- Multi-user conflict handling
- Optimistic updates with rollback

### **Error Handling**
- Invalid SKU scanning feedback
- Insufficient quantity warnings
- Network error recovery
- Data validation errors

---

## 📱 **UI/UX Requirements**

### **Scanner-First Design**
- Large, prominent scan inputs on all relevant pages
- Auto-focus after successful operations
- Visual scan feedback (green flash, sound)
- Keyboard shortcuts for power users

### **Fallback Interfaces**
- Searchable/filterable lists when scan fails
- Manual SKU entry with validation
- Browse by category functionality
- Recent items quick-select

### **Responsive Design**
- Desktop-first for warehouse management
- Tablet compatibility for mobile scanning
- Touch-friendly buttons and inputs
- Readable text at warehouse distances

### **Progress Feedback**
- Loading states for scan operations
- Progress bars for batch operations
- Success/error notifications
- Real-time inventory updates

---

## ⚠️ **Breaking Changes & Migration**

### **Data Access Patterns**
```javascript
// OLD WAY - Remove all instances
item.tagSummary.reserved
item.sku_code  
item.product_details

// NEW WAY - Update to
inventory.reserved_quantity
item.sku_id.sku_code
item.sku_id.name
```

### **API Calls**
```javascript
// OLD - Remove
tagApi.createTag({
  items: [{ item_id: sku_id, quantity: 5 }]
})

// NEW - Replace with
itemApi.findBySKU(sku_code).then(items => {
  tagApi.createTag({
    items: items.map(item => ({ item_id: item._id, quantity: 1 }))
  })
})
```

### **Component Props**
- All components expecting SKU-based data need Item-based props
- Tag displays need nested population (items → sku_id)
- Inventory displays need aggregation from Items

---

## 🎯 **Success Metrics**

### **Functional Requirements**
- ✅ All workflows use proper Item → SKU relationships
- ✅ Bundle SKUs work transparently in all operations  
- ✅ Scanner integration doesn't break modal workflows
- ✅ Tools are tracked separately from product inventory
- ✅ Tags reference actual Item records

### **Performance Requirements**
- Scanner response time < 200ms
- Page load times < 1 second
- Batch operations handle 100+ items
- Real-time updates propagate within 2 seconds

### **User Experience Requirements**
- Warehouse staff can complete receiving workflow in < 30 seconds per item
- Scanner-first operations require no mouse interaction
- Error states provide clear next steps
- Fallback interfaces are intuitive for non-tech users

---

## 📋 **Implementation Checklist**

### **Phase 1 - Data Layer** 
- [ ] Update `api.ts` for Item-based endpoints
- [ ] Fix TypeScript interfaces (`CreateTagRequest`, etc.)
- [ ] Create reusable Scanner component
- [ ] Implement Item lookup utilities
- [ ] Add bundle expansion helpers

### **Phase 2 - Core Pages**
- [ ] Redesign Inventory page for Items
- [ ] Fix Tag creation with Item selection  
- [ ] Create Receiving page
- [ ] Update Dashboard with proper metrics
- [ ] Test scanner integration

### **Phase 3 - Advanced Features**
- [ ] Build Tools lending system
- [ ] Implement Send for Install workflow
- [ ] Add Bundle SKU management
- [ ] Create batch operation interfaces
- [ ] Add tool-specific category handling

### **Phase 4 - Polish**
- [ ] Mobile responsiveness testing
- [ ] Performance optimization
- [ ] Error handling improvements  
- [ ] User acceptance testing
- [ ] Documentation updates

---

**This redesign transforms the frontend from a SKU-centric system to a proper Item-based warehouse management interface, aligned with the backend architecture and real-world scanning workflows.**
