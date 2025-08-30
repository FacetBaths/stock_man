# CURRENT TASK: Filter Tools from Existing Product Endpoints

**Task:** 1 of 13  
**Branch:** `feature/tools-management`  
**Phase:** Backend (Phase 1)  
**Estimated Time:** 2 hours  
**Status:** ❌ Ready to Start  

---

## 🎯 **TASK OVERVIEW**
Filter tools out of existing product API endpoints to ensure complete separation between tools and products in the UI.

## ✅ **SUCCESS CRITERIA**
- [ ] Update `/api/inventory` to exclude `category.type = 'tool'`
- [ ] Update `/api/skus` to exclude `category.type = 'tool'` 
- [ ] Update `/api/tags` to exclude tags containing tool SKUs
- [ ] Test all existing product views show only products (no tools)
- [ ] Verify no breaking changes to existing product functionality

## 🔧 **TECHNICAL REQUIREMENTS**

### **Files to Modify:**
1. `backend/src/routes/inventory.js` - Add category.type != 'tool' filter
2. `backend/src/routes/skus.js` - Add category.type != 'tool' filter  
3. `backend/src/routes/tags.js` - Filter out tags containing tool SKUs

### **Implementation Details:**
- **Inventory API**: Add category population and filter in aggregation pipeline
- **SKUs API**: Add category join and filter in query
- **Tags API**: Add SKU population with category filter to exclude tool-related tags

### **Backend Logic:**
```javascript
// Example filter pattern to add:
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
    'category.type': { $ne: 'tool' }  // Exclude tools
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
# Test inventory endpoint
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/inventory"

# Test SKUs endpoint  
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/skus"

# Test tags endpoint
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/tags"
```

## 📋 **STEP-BY-STEP PLAN**

### **Step 1: Examine Current Code**
- [ ] Read `backend/src/routes/inventory.js` aggregation pipeline
- [ ] Read `backend/src/routes/skus.js` query structure
- [ ] Read `backend/src/routes/tags.js` query structure
- [ ] Understand how category relationships work

### **Step 2: Create Test Data**
- [ ] Create tool category with `type: 'tool'`
- [ ] Create tool SKU in tool category
- [ ] Create tool instances
- [ ] Verify tools appear in current endpoints

### **Step 3: Implement Inventory Filter**
- [ ] Add category lookup if not present
- [ ] Add tool exclusion filter to pipeline
- [ ] Test inventory endpoint excludes tools

### **Step 4: Implement SKUs Filter**
- [ ] Add category population to SKU queries
- [ ] Add tool exclusion filter
- [ ] Test SKUs endpoint excludes tools

### **Step 5: Implement Tags Filter**
- [ ] Add SKU population with category to tag queries
- [ ] Filter out tags containing tool SKUs
- [ ] Test tags endpoint excludes tool-related tags

### **Step 6: Validation Testing**
- [ ] Test all three endpoints exclude tools
- [ ] Test all three endpoints still return products
- [ ] Test existing frontend still works
- [ ] Verify no breaking changes

## ⚠️ **POTENTIAL RISKS**
- **Performance Impact**: Adding category lookups may slow queries
- **Breaking Changes**: Incorrect filters could break existing functionality
- **Data Relationships**: Complex tag-SKU relationships need careful filtering

## 🔍 **VERIFICATION CHECKLIST**
- [ ] Server starts without errors
- [ ] All existing product endpoints work
- [ ] Tools are completely filtered out
- [ ] No console errors or warnings
- [ ] Frontend product views unchanged

---

## 📝 **IMPLEMENTATION NOTES**

### **Before Starting:**
1. Read existing code to understand current architecture
2. Create test tool data to validate filtering
3. Test current behavior to establish baseline

### **During Implementation:**
- Make small incremental changes
- Test each endpoint individually
- Verify products still work after each change

### **After Completion:**
- Update CHECKLIST.md task status to ✅ Complete
- Update CURRENT_TASK.md for next task (Task 2)
- Commit changes with reference to Task 1

---

**Dependencies:** None - this is the foundation task  
**Next Task:** Task 2 - Create Tool-Specific API Endpoints

**Remember:** Follow WORKFLOW_DISCIPLINE.md - complete this task fully before moving to Task 2!

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
