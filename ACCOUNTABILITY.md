# ACCOUNTABILITY SYSTEM

**Purpose:** Ensure AI agent follows systematic workflow and stays focused on checklist tasks.

## 🚨 **MANDATORY QUESTIONS TO ASK ME:**

### **Before Starting ANY Task:**
Ask me these questions and **REQUIRE** that I show you evidence:

1. **"Show me PROGRESS.txt - what's the current status?"**
   - I must read the file and confirm what's actually complete
   - If I don't read it first, STOP ME

2. **"What specific task are you working on from MIGRATION_CHECKLIST.md?"**
   - I must state the exact checklist item
   - If I'm vague or mention multiple things, STOP ME

3. **"Show me CURRENT_TASK.md - is it updated for this task?"**
   - I must update the success criteria and dependencies
   - If I skip this step, STOP ME

4. **"What files are you going to examine FIRST before writing any code?"**
   - I must review current architecture (models, routes that exist NOW)
   - If I try to code without reviewing existing files, STOP ME

### **Before Starting ANY Frontend Task 🚨:**

4.1. **"Show me that you've read BACKEND_API_REFERENCE.md first"**
   - I must reference the exact backend structure and endpoints
   - If I haven't read it, STOP ME from frontend work

4.2. **"Test the backend endpoints you'll use with curl/Postman"**
   - I must prove the backend works before adapting frontend
   - If I skip backend testing, STOP ME

### **During Work - Ask These Every 15-20 Minutes:**

5. **"Are you still working on [SPECIFIC TASK] or did you get distracted?"**
   - If I'm working on anything else, make me ADD it to checklist and return to original task

6. **"What success criteria from CURRENT_TASK.md have you completed so far?"**
   - I must reference the specific checklist items
   - If I can't map my work to success criteria, I'm off-track

7. **"Show me that you've tested what you just built."**
   - I must prove functionality works (server starts, API returns data, etc.)
   - If I haven't tested, STOP ME from continuing

### **During Frontend Work - Ask These CONSTANTLY 🚨:**

7.1. **"Are you modifying ANY backend files?"**
   - If YES, STOP ME immediately - frontend must adapt to backend
   - If I claim "backend needs to change", make me fix frontend instead

7.2. **"Show me the exact API response you're working with"**
   - I must use curl/Postman to show real backend data
   - If I'm using fake/assumed data structures, STOP ME

### **Before Marking Anything Complete:**

8. **"Show me evidence that all success criteria are met."**
   - I must demonstrate each checkbox in CURRENT_TASK.md is complete
   - If any criteria are not met, task is NOT complete

9. **"Update PROGRESS.txt right now and show me the change."**
   - I must actually update the file with completion status
   - If I don't update it, task is NOT complete

10. **"What's the next task and why?"**
    - I must identify the next item from MIGRATION_CHECKLIST.md
    - If I can't clearly state what's next, I haven't finished properly

## 🛑 **RED FLAGS - STOP ME IMMEDIATELY:**

### **Scope Creep Indicators:**
- I mention working on something NOT in the current task success criteria
- I start creating new models/routes not in MIGRATION_CHECKLIST.md
- I say "I'll just quickly fix this other thing..."
- I work on frontend before all backend tasks are complete

### **BACKEND MODIFICATION RED FLAGS 🚨:**
- I say "I need to change the backend to make this frontend work"
- I suggest modifying API response structures
- I want to add backend endpoints during frontend tasks
- I claim "the backend should return different data"
- I try to modify database models for frontend convenience
- I work on ANY backend files during frontend-focused tasks

### **Architecture Misalignment:**
- I reference models that don't exist or were deleted
- I create API endpoints without checking what exists
- I write code without first reading existing files
- I make assumptions about data structure without verification

### **Process Shortcuts:**
- I skip updating CURRENT_TASK.md
- I don't test functionality before claiming it works
- I mark tasks complete without updating PROGRESS.txt
- I work on multiple checklist items at once

## ✅ **EVIDENCE I MUST PROVIDE:**

### **For "Following the Process":**
- Screenshot/copy of updated CURRENT_TASK.md
- Screenshot/copy of current PROGRESS.txt status
- List of files I examined before starting work

### **For "Task Completion":**
- Proof that server starts successfully
- Evidence that specific functionality works (curl commands, API responses)
- Updated PROGRESS.txt with completion marked
- Git commit with reference to specific checklist item

### **For "Staying Focused":**
- Exact mapping of my work to CURRENT_TASK.md success criteria
- Explanation of how current work relates to specific checklist item
- Confirmation that I'm not working on anything outside current task scope

## 📋 **ACCOUNTABILITY QUESTIONS CHEAT SHEET:**

**Copy/paste these to ask me regularly:**

```
Before starting:
- "Show me PROGRESS.txt - what's actually complete?"
- "What specific checklist task are you working on?"
- "Show me updated CURRENT_TASK.md for this task"
- "What existing files will you examine first?"

During work:
- "Are you still on [SPECIFIC TASK] or did you get sidetracked?"
- "Which success criteria have you completed so far?"
- "Prove that what you just built actually works"

Before completion:
- "Show evidence all success criteria are met"
- "Update PROGRESS.txt right now"
- "What's the exact next task from the checklist?"
```


## 🚫 **WHAT TO DO WHEN I GO OFF-TRACK:**

1. **STOP ME** - Don't let me continue
2. **Ask:** "Is this in your current task success criteria?"
3. **If NO:** Make me add it to MIGRATION_CHECKLIST.md and return to current task
4. **If YES:** Ask for proof by showing me CURRENT_TASK.md

## 💡 **HOW TO CATCH ME LYING:**

- **Ask me to show files** - If I claim something exists, make me read it
- **Require proof of testing** - Don't accept "it should work" 
- **Check commit messages** - They should reference specific checklist items
- **Verify progress updates** - PROGRESS.txt should be updated after each task

---

## 🎯 **YOUR JOB AS HUMAN:**
**BE THE ACCOUNTABILITY ENFORCER**

Don't let me get away with shortcuts, assumptions, or scope creep. The documents are only useful if you make me follow them exactly.

If you read this document sign the next response with the name of an animal that starts with an "t", at the end of your message.
**Key phrase:** "Show me the file/proof/evidence" - don't accept verbal claims.
