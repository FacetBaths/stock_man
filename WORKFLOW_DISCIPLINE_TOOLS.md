# Workflow Discipline Guide - Tools Feature Development

**Purpose:** Ensure systematic completion of tools management feature tasks while maintaining code quality and avoiding scope creep.

## 🚨 **CRITICAL RULES - NEVER BREAK THESE:**

### 1. **ONE TASK AT A TIME RULE**
- ❌ **NEVER** work on multiple checklist items simultaneously
- ✅ **ALWAYS** complete current task before moving to next
- ✅ **ALWAYS** update CHECKLIST.md immediately after completion
- ✅ **ALWAYS** commit changes with reference to specific checklist task

### 2. **BACKEND-FIRST RULE (Modified for Feature Development)**  
- ✅ **COMPLETE** all backend tasks (Tasks 1-4) before starting frontend
- ✅ **TEST** backend endpoints with curl/Postman before frontend integration
- ✅ **VERIFY** backend filtering works correctly before UI development
- ❌ **NEVER** start frontend work until backend phase is complete

### 2.1 **FRONTEND ADAPTATION RULE** 🚨
- ✅ **ALWAYS** adapt frontend components to match backend API structure
- ✅ **ALWAYS** reference dev/documents/BACKEND_API_REFERENCE.md before frontend work
- ✅ **ALWAYS** use exact field names from API responses
- ❌ **NEVER** modify backend APIs to fit frontend preferences during frontend tasks
- ✅ **EXCEPTION**: Tools feature requires new backend endpoints, but these are created in backend phase

### 3. **COMPLETE SEPARATION RULE (Tools Specific)**
- ✅ **ALWAYS** ensure tools are completely filtered out of existing product views
- ✅ **ALWAYS** test that existing product functionality is unaffected
- ✅ **ALWAYS** verify no tools appear in product endpoints after filtering
- ❌ **NEVER** allow tools and products to mix in UI views

### 4. **TESTING BEFORE COMPLETION RULE**
- ❌ **NEVER** mark a task complete without testing it works
- ✅ **ALWAYS** test the specific functionality you just built
- ✅ **ALWAYS** verify the server starts successfully after changes
- ✅ **ALWAYS** test API endpoints return expected data structure
- ✅ **ALWAYS** test existing functionality still works (regression testing)

## 🎯 **SYSTEMATIC TASK EXECUTION PROCESS:**

### **Before Starting ANY Task:**
1. **Read CURRENT_TASK.md** - Understand specific task requirements
2. **Check CHECKLIST.md** - Confirm task order and dependencies
3. **Review existing code** - Understand current architecture
4. **Define success criteria** - Know exactly what "done" means

### **During Task Execution:**
1. **Stay in scope** - Only work on the specific checklist task
2. **Reference existing patterns** - Follow established code patterns
3. **Test incrementally** - Test small pieces as you build
4. **Document blockers** - Note issues but don't rabbit-hole

### **Before Marking Task Complete:**
1. **Test functionality** - Prove it works with real data
2. **Check server startup** - Ensure no breaking changes
3. **Update CHECKLIST.md** - Mark specific task complete
4. **Update CURRENT_TASK.md** - Set up next task
5. **Commit with reference** - Include task number in commit message
6. **Verify all success criteria** - Double-check completion

## 🛑 **SCOPE CREEP PREVENTION:**

### **When You Want to "Just Fix This One Thing:"**
- ❌ **STOP** - This is how you get off track
- ✅ **ADD TO CHECKLIST** - Create new checklist task if important
- ✅ **STAY FOCUSED** - Complete current task first
- ✅ **PRIORITIZE LATER** - Address in proper order

### **When You Find Missing Dependencies:**
- ❌ **DON'T** build the dependency immediately
- ✅ **DOCUMENT** what's missing in CURRENT_TASK.md
- ✅ **CHECK CHECKLIST** - Is the dependency already listed?
- ✅ **UPDATE CHECKLIST** - Add missing dependency as separate task
- ✅ **REORDER TASKS** - Complete dependencies first

### **When You Want to "Improve" Something:**
- ❌ **DON'T** optimize or refactor during feature development
- ✅ **FOCUS** on making the feature work
- ✅ **NOTE** improvements for later
- ✅ **FEATURE FIRST** - Improvements after everything works

## 🔍 **TOOLS FEATURE-SPECIFIC GUIDELINES:**

### **For Backend Filtering Tasks (Tasks 1-4):**
1. **FIRST:** Understand existing API structure
2. **THEN:** Create test tool data to validate changes
3. **THEN:** Implement one endpoint filter at a time
4. **THEN:** Test each endpoint individually with curl/Postman
5. **FINALLY:** Test all endpoints together + regression test existing functionality

### **For Frontend Tasks (Tasks 5-10):**
1. **FIRST:** Ensure all backend tasks are complete and tested
2. **THEN:** Review backend API documentation
3. **THEN:** Update one component at a time
4. **THEN:** Test component with REAL backend data
5. **FINALLY:** Test complete user workflow (checkout → return)

### **For Tool Checkout/Return Workflow:**
1. **FIRST:** Understand difference between product fulfillment (delete) vs tool return (release)
2. **THEN:** Test backend return endpoints work correctly
3. **THEN:** Build frontend components that use return (not fulfill) logic
4. **FINALLY:** Test complete workflow preserves tools in inventory

## 📋 **ACCOUNTABILITY SYSTEM:**

### **Start of Each Task:**
1. Read CURRENT_TASK.md completely
2. Understand all success criteria
3. Check dependencies are met
4. Estimate time for task

### **During Work:**
- Reference CHECKLIST.md every 30 minutes
- Ask: "Am I still working on the stated task?"
- If tempted to work on something else: ADD TO CHECKLIST, STAY FOCUSED

### **End of Each Task:**
1. Verify ALL success criteria are met
2. Update CHECKLIST.md with completion ✅
3. Update CURRENT_TASK.md for next task
4. Test that system still works
5. Commit with task reference

### **End of Each Phase:**
1. Test complete phase functionality
2. Verify no regressions in existing features
3. Document any issues discovered
4. Prepare for next phase

## 🚫 **FORBIDDEN ACTIONS DURING FEATURE DEVELOPMENT:**

- ❌ Working on multiple tasks simultaneously
- ❌ Skipping testing because "it looks right"
- ❌ Frontend work before backend phase is complete
- ❌ Marking tasks complete without verification
- ❌ Allowing tools to appear in product views
- ❌ Breaking existing product functionality

## 🚨 **TOOLS-SPECIFIC PROHIBITIONS:**

- ❌ **NEVER** let tools appear in existing product endpoints
- ❌ **NEVER** use product fulfillment logic for tool returns
- ❌ **NEVER** delete tool instances during return workflow
- ❌ **NEVER** mix tools and products in the same UI view
- ❌ **NEVER** modify existing product components to handle tools

## ✅ **SUCCESS INDICATORS:**

- ✅ CHECKLIST.md updated after each task
- ✅ CURRENT_TASK.md reflects current work
- ✅ Server starts successfully after each task
- ✅ Each task has been tested with real data
- ✅ No scope creep or rabbit holes
- ✅ Steady progress through checklist in order
- ✅ Existing product functionality unaffected
- ✅ Tools completely separated from products

---

## 💡 **REMEMBER:**
**Feature success = Systematic completion of defined tasks in order**
**NOT = Creative problem solving or architectural improvements**

The goal is to implement a working tools management system that is completely separate from the existing product system. Follow the plan, test thoroughly, and avoid scope creep.

**If you read this document, sign your next response with the name of a construction tool at the end.**
