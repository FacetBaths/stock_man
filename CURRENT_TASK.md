# CURRENT TASK: Create Tool-Specific API Endpoints

**Task:** 2 of 13  
**Branch:** `feature/tools-management`  
**Phase:** Backend (Phase 1)  
**Estimated Time:** 3 hours  
**Status:** ❌ PENDING

---

## 🎯 **TASK OVERVIEW**
Create dedicated API endpoints for tools management that return only tool-related data, complementing the existing product endpoints.

## ✅ **SUCCESS CRITERIA**
- [ ] Create `GET /api/tools/inventory` - tools-only inventory view
- [ ] Create `GET /api/tools/skus` - tools-only SKU management
- [ ] Create `GET /api/tools/tags` - tools-only checkout/loans view
- [ ] Create `POST /api/tools/checkout` - checkout tools to contractors
- [ ] All endpoints return properly filtered tool data only
- [ ] Test endpoints with curl/Postman

## 🔧 **TECHNICAL REQUIREMENTS**

### **Files to Create:**
1. `backend/src/routes/tools.js` - New tools router with tool-specific endpoints

### **Files to Modify:**
1. `backend/src/server.js` - Add tools route to express app
2. `backend/src/app.js` - Add tools route to express app (if separate)

### **Implementation Details:**
- **Tools Inventory API**: Mirror `/api/inventory` but with `category.type = 'tool'` filter
- **Tools SKUs API**: Mirror `/api/skus` but with `category.type = 'tool'` filter
- **Tools Tags API**: Mirror `/api/tags` but include only tags with tool SKUs
- **Tools Checkout API**: New endpoint for checking out tools to contractors

### **Backend Logic Pattern:**
```javascript
// Tools filter pattern (opposite of product filter):
{
  $lookup: {
    from: 'categories',
    localField: 'category_id', 
    foreignField: '_id',
    as: 'category'
  }
},
{
  $match: {
    'category.type': 'tool'  // Include ONLY tools
  }
}
```

## 🧪 **TESTING REQUIREMENTS**

### **Validation Steps:**
1. **Before Changes**: Create test tool categories and SKUs
2. **Test Current Behavior**: Verify tools appear in existing endpoints
3. **After Changes**: Verify tools are filtered out
4. **Regression Test**: Verify products still work normally

### **Test Commands:**
```bash
# Test new tools endpoints
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/tools/inventory"
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/tools/skus"
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/tools/tags"

# Test tools checkout endpoint
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contractor_name": "John Doe", "project_name": "Site A", "due_date": "2024-01-15", "sku_items": [{"sku_id": "TOOL_ID", "quantity": 1}]}' \
  "http://localhost:5000/api/tools/checkout"
```

## 📋 **STEP-BY-STEP PLAN**

### **Step 1: Study Existing Route Patterns**
- [ ] Examine `backend/src/routes/inventory.js` structure and patterns
- [ ] Examine `backend/src/routes/skus.js` structure and patterns
- [ ] Examine `backend/src/routes/tags.js` structure and patterns
- [ ] Understand authentication and validation patterns

### **Step 2: Create Tools Router File**
- [ ] Create `backend/src/routes/tools.js` with express router
- [ ] Import necessary models (Category, SKU, Tag, Inventory, etc.)
- [ ] Set up basic authentication middleware
- [ ] Add route structure skeleton

### **Step 3: Implement Tools Inventory Endpoint**
- [ ] Create `GET /api/tools/inventory` endpoint
- [ ] Copy aggregation pipeline from inventory.js
- [ ] Modify filters to include ONLY `category.type = 'tool'`
- [ ] Test endpoint returns only tool inventory

### **Step 4: Implement Tools SKUs Endpoint** 
- [ ] Create `GET /api/tools/skus` endpoint
- [ ] Copy query logic from skus.js
- [ ] Modify filters to include ONLY `category.type = 'tool'`
- [ ] Test endpoint returns only tool SKUs

### **Step 5: Implement Tools Tags Endpoint**
- [ ] Create `GET /api/tools/tags` endpoint
- [ ] Copy query logic from tags.js
- [ ] Modify filters to include only tags with tool SKUs
- [ ] Test endpoint returns only tool-related tags

### **Step 6: Implement Tools Checkout Endpoint**
- [ ] Create `POST /api/tools/checkout` endpoint
- [ ] Copy checkout logic from existing tag creation
- [ ] Ensure it creates tags for tool checkout (not product fulfillment)
- [ ] Test tool checkout creates proper tag relationships

### **Step 7: Register Routes and Test**
- [ ] Add tools router to `backend/src/server.js`
- [ ] Test all endpoints with curl/Postman
- [ ] Verify existing product endpoints still work
- [ ] Verify tools and products remain completely separated

## ⚠️ **POTENTIAL RISKS**
- **Code Duplication**: Copying existing route logic may lead to maintenance issues
- **Route Conflicts**: Ensure tools routes don't conflict with existing routes
- **Authentication**: Maintain same security level as existing endpoints
- **Data Consistency**: Tool filtering must be consistent across all new endpoints

---

## 📝 **IMPLEMENTATION NOTES**

### **Before Starting:**
1. Study existing route files to understand patterns
2. Plan the tools router structure
3. Ensure Task 1 (filtering) is complete and working

### **During Implementation:**
- Copy and adapt existing route logic rather than reinventing
- Test each endpoint as you create it
- Ensure consistent authentication and validation
- Maintain the same response format as existing endpoints

### **After Completion:**
- Update CHECKLIST.md Task 2 status to ✅ Complete
- Update CURRENT_TASK.md for next task (Task 3)
- Commit changes with reference to Task 2
- Verify tools endpoints work and products endpoints still work

---

**Dependencies:** Task 1 (product filtering) must be complete  
**Next Task:** Task 3 - Implement Tool Return Functionality

**Remember:** Follow WORKFLOW_DISCIPLINE.md - complete this task fully before moving to Task 3!

## 🚨 **SCOPE CREEP ALERTS:**

**If you want to work on something NOT in success criteria:**
1. STOP what you're doing
2. Add new item to CHECKLIST.md
3. Continue with current task ONLY
4. Address new item in proper order later

**If you find missing dependencies:**
1. Document what's missing above
2. Check if it's already in checklist
3. If not, add to checklist
4. Complete dependencies FIRST before returning to this task
