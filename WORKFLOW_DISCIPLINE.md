# Workflow Discipline Guide

**Purpose:** Prevent scope creep, maintain focus, and ensure systematic completion of migration tasks.

## 🚨 **CRITICAL RULES - NEVER BREAK THESE:**

### 1. **ONE TASK AT A TIME RULE**
- ❌ **NEVER** work on multiple checklist items simultaneously
- ✅ **ALWAYS** complete current task before moving to next
- ✅ **ALWAYS** update PROGRESS.txt immediately after completion
- ✅ **ALWAYS** commit changes with reference to specific checklist item

### 2. **BACKEND-FIRST RULE**  
- ❌ **NEVER** touch frontend until ALL backend tasks are complete and tested
- ✅ **ALWAYS** verify backend API endpoints work before frontend migration
- ✅ **ALWAYS** test with actual HTTP requests (curl/Postman) before frontend work

### 2.1 **FRONTEND ADAPTATION RULE** 🚨
- ❌ **NEVER** modify backend models, routes, or API responses during frontend work
- ❌ **NEVER** add backend endpoints to fit frontend preferences
- ❌ **NEVER** change database schema for frontend convenience
- ✅ **ALWAYS** adapt frontend to match EXACT backend structure
- ✅ **ALWAYS** reference BACKEND_API_REFERENCE.md before frontend changes
- ✅ **ALWAYS** use exact field names from API responses
- ✅ **ALWAYS** fix frontend code if it doesn't match backend, not the other way around

### 3. **ARCHITECTURE ALIGNMENT RULE**
- ❌ **NEVER** create new models or fields without checking existing architecture
- ❌ **NEVER** reference models that don't exist or have been deleted
- ✅ **ALWAYS** review current model files before writing any code
- ✅ **ALWAYS** check what API endpoints actually exist before calling them

### 4. **TESTING BEFORE COMPLETION RULE**
- ❌ **NEVER** mark a task complete without testing it works
- ✅ **ALWAYS** test the specific functionality you just built
- ✅ **ALWAYS** verify the server starts successfully after changes
- ✅ **ALWAYS** test API endpoints return expected data structure

## 🎯 **SYSTEMATIC TASK EXECUTION PROCESS:**

### **Before Starting ANY Task:**
1. **Read PROGRESS.txt** - Confirm what's actually complete
2. **Review current architecture** - Check what models/routes exist NOW
3. **Identify dependencies** - What needs to exist for this task to work?
4. **Define success criteria** - How will you know this task is actually done?

### **During Task Execution:**
1. **Stay in scope** - Only work on the specific checklist item
2. **Reference existing code** - Use current architecture as blueprint
3. **Test incrementally** - Test small pieces as you build
4. **Document blockers** - If you find issues, note them but don't rabbit-hole

### **Before Marking Task Complete:**
1. **Test functionality** - Prove it works with real data
2. **Check server startup** - Ensure no breaking changes
3. **Update PROGRESS.txt** - Mark specific task complete
4. **Commit with reference** - Include checklist item in commit message
5. **Verify checklist alignment** - Does completion match checklist description?

## 🛑 **SCOPE CREEP PREVENTION:**

### **When You Want to "Just Fix This One Thing:"**
- ❌ **STOP** - This is how you get off track
- ✅ **ADD TO CHECKLIST** - Create new checklist item if it's important
- ✅ **STAY FOCUSED** - Complete current task first
- ✅ **PRIORITIZE LATER** - Address in proper order

### **When You Find Missing Dependencies:**
- ❌ **DON'T** build the dependency immediately
- ✅ **DOCUMENT** what's missing
- ✅ **CHECK CHECKLIST** - Is the dependency already listed?
- ✅ **UPDATE CHECKLIST** - Add missing dependency as separate task
- ✅ **REORDER TASKS** - Complete dependencies first

### **When You Want to "Improve" Something:**
- ❌ **DON'T** optimize or refactor during migration
- ✅ **FOCUS** on making migration work
- ✅ **NOTE** improvements for later
- ✅ **MIGRATION FIRST** - Improvements after everything works

## 🔍 **TASK-SPECIFIC GUIDELINES:**

### **For "Fix Tag Model" (Next Task):**
1. **FIRST:** Review existing Tag.js - what structure exists NOW?
2. **THEN:** Review Instance.js - how should tags reference instances?
3. **THEN:** Update ONLY the Tag model - don't touch routes yet
4. **THEN:** Test tag creation in isolation - don't test full workflow yet
5. **FINALLY:** Mark complete ONLY when Tag model works with Instance model

### **For Route Updates:**
1. **FIRST:** Review existing route file - what's already there?
2. **THEN:** Check what models/endpoints the route uses
3. **THEN:** Update ONE route at a time
4. **THEN:** Test route with curl/Postman
5. **FINALLY:** Verify server starts and route returns expected data

### **For Frontend Tasks:**
1. **FIRST:** Read BACKEND_API_REFERENCE.md to understand EXACT backend structure
2. **THEN:** Test ALL backend endpoints work with curl/Postman
3. **THEN:** Review current frontend code structure
4. **THEN:** Update ONE component at a time to match backend
5. **THEN:** Test component with REAL backend data
6. **FINALLY:** If component doesn't work, fix FRONTEND code, never backend

## 📋 **ACCOUNTABILITY SYSTEM:**

### **Start of Each Session:**
1. Read PROGRESS.txt aloud
2. Identify the SINGLE next task
3. State success criteria out loud
4. Set time estimate for task

### **During Work:**
- Reference MIGRATION_CHECKLIST.md every 30 minutes
- Ask: "Am I still working on the stated task?"
- If tempted to work on something else: ADD TO CHECKLIST, STAY FOCUSED

### **End of Each Task:**
1. Update PROGRESS.txt with new completion
2. Commit with checklist reference
3. Test that server still starts
4. Read next task before stopping

### **End of Each Session:**
1. Update both PROGRESS.txt and MIGRATION_CHECKLIST.md
2. Push all changes to git
3. Note any blockers discovered
4. Identify exact next task for next session

## 🚫 **FORBIDDEN ACTIONS DURING MIGRATION:**

- ❌ Creating new database models not in checklist
- ❌ Adding new frontend components not in checklist  
- ❌ "Improving" existing working code
- ❌ Working on multiple tasks simultaneously
- ❌ Skipping testing because "it looks right"
- ❌ Frontend work before backend is complete
- ❌ Marking tasks complete without actual verification

## 🚨 **ABSOLUTELY FORBIDDEN DURING FRONTEND WORK:**

- ❌ **NEVER** modify backend models during frontend development
- ❌ **NEVER** change API response structures to fit frontend preferences
- ❌ **NEVER** add backend endpoints during frontend work
- ❌ **NEVER** modify database schema for frontend convenience
- ❌ **NEVER** change working backend code because frontend "expects" different data
- ❌ **NEVER** work on backend files when task is frontend-focused

## ✅ **SUCCESS INDICATORS:**

- ✅ PROGRESS.txt updated after each task
- ✅ Git commits reference specific checklist items
- ✅ Server starts successfully after each task
- ✅ Each task has been actually tested
- ✅ No scope creep or rabbit holes
- ✅ Steady progress through checklist in order

---

## 💡 **REMEMBER:**
**Migration success = Systematic completion of defined tasks**
**NOT = Creative problem solving or feature improvements**

The goal is to get from broken architecture to working architecture by completing each task in order. Innovation and improvements come AFTER migration is complete.


If you read this document sign the next response with a 1234 at the end.