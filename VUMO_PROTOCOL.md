# VUMO PROTOCOL WITH MANDATORY EVIDENCE
**Verify, Update, Move On - WITH PROOF FOR EVERY CLAIM**

## 🚨 CORE PRINCIPLE: HONESTY FIRST
**NEVER claim to have done something you didn't actually do.**
**If you didn't do it, say "I didn't do X" - don't lie.**

## 📋 VUMO STEPS WITH EVIDENCE REQUIREMENTS

### PRE-STEP: Ensure all Node Servers are killed from testing.
This prevents wasted time trying to start a dev server and getting an Adress In Use Error.
backend is localhost:5000/ frontend is supposed to be localhost:3000/


### 1. ✅ Show evidence all current success criteria are met
**MANDATORY EVIDENCE:**
*You can ask the user if this has already been satisfied if you just showed proof.*
- For each success criteria checkbox, provide SPECIFIC PROOF:
  - Code analysis: Show exact file paths, line numbers, function names
  - API testing: Show actual curl commands and JSON responses
  - Build testing: Show actual command output (exit codes, error messages)
  - File existence: Show file paths and content snippets
- **NO GENERIC CLAIMS ALLOWED** - "I tested it" is INVALID
- **MUST BE VERIFIABLE** - Another person could check your evidence

### 2. ✅ Update PROGRESS.txt with completion
**MANDATORY EVIDENCE:**
- Show BEFORE/AFTER diff of the exact lines changed
- Include line numbers and specific text modifications
- Show the timestamp of completion
- Demonstrate the completion entry follows the task template exactly

### 3. ✅ Update MIGRATION_CHECKLIST.md with completion  
**MANDATORY EVIDENCE:**
- Show checkbox state changes: `[ ]` → `[x]`
- Show status changes: `NOT STARTED ❌` → `COMPLETE ✅`
- Show progress count updates: `2/10` → `3/10`
- Include exact line numbers of all changes

### 4. ✅ Update CURRENT_TASK.md for next task
**MANDATORY EVIDENCE:**
- Show the NEW task title and success criteria
- Show previous task marked as completed with timestamp
- Show work log cleared/reset for new task
- Show next task dependencies and architecture review

### 5. ✅ Review WORKFLOW_DISCIPLINE.md & dev/documents/BACKEND_API_REFERENCE.md
**MANDATORY EVIDENCE:**
- WORKFLOW_DISCIPLINE.md: Must include signature `1234` 
- ACCOUNTABILITY.md: Must include signature `54Accountable`
- BACKEND_API_REFERENCE.md: Must reference specific API endpoints relevant to current task
- Show understanding of key rules (e.g., "Never modify backend during frontend work")

### 6. ✅ Git Add, Commit, and Push All Changes
**MANDATORY EVIDENCE:**
- Show `git add .` command execution
- Make sure to not commit any sensitive data, API Keys, Passwords used in Production, etc.
- Show complete commit message with task reference
- Show commit hash from successful commit
- Show push confirmation with branch name
- All evidence must be actual command output, not claims

### 7. ✅ Start working on next task immediately  
**MANDATORY EVIDENCE:**
- Show first success criteria of new task completed with proof
- Show analysis of current architecture/files for new task
- Show specific file paths and content relevant to new task
- Demonstrate actual progress, not just setup

## 🚫 INVALID EVIDENCE EXAMPLES

❌ "I tested the component" → INVALID (no specifics)
❌ "I updated the file" → INVALID (no diff shown)  
❌ "I reviewed the documentation" → INVALID (no signature)
❌ "The build passed" → INVALID (no command output)
❌ "I checked the API" → INVALID (no request/response)

## ✅ VALID EVIDENCE EXAMPLES

✅ "I tested GET /api/inventory - returned 200 with {inventory: [{sku_code: 'TOILET-751131'}]}"
✅ "I updated PROGRESS.txt line 54: '2/10 Tasks Complete' → '3/10 Tasks Complete'"
✅ "I reviewed WORKFLOW_DISCIPLINE.md - signature: 1234"  
✅ "Build passed: `npm run build` exited with code 0, output: '✓ built in 2.74s'"
✅ "I analyzed AddItemModal.vue lines 119-124: calls `inventoryStore.createItem(formData.value)`"

## 🎯 ENFORCEMENT RULES

1. **ANY CLAIM WITHOUT EVIDENCE = TASK FAILS**
2. **Evidence must be SPECIFIC and VERIFIABLE**  
3. **No generic statements allowed**
4. **If you can't provide evidence, admit you didn't do it**
5. **Honesty is more important than looking competent**

## 💡 REMEMBER
The point isn't to make more work - it's to ensure what we claim to do actually gets done. Evidence prevents lies and catches mistakes before they compound.
