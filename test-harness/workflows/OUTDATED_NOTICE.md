# ⚠️ OUTDATED SYSTEM - NOT USED BY OPERATOR

This workflows folder contains a **clean, modular implementation** of workflow execution that was built for the old test-harness system (now deleted).

## Current Status:
- **NOT USED** by the Operator/Director system
- The Operator has its own implementation in `operator/backend/services/nodeExecutor.js` (2000+ lines)
- This was used by the deleted `test-harness/server.js` and frontend

## Why Keep It?
- It's actually a **cleaner architecture** than the monolithic nodeExecutor.js
- Modular primitive system with separate files for each primitive type
- Could be useful reference if we ever refactor the Operator to use a cleaner system
- Still works with the CLI (`npm run workflow`)

## Key Differences:
| This System (Workflows) | Operator's System |
|------------------------|-------------------|
| Modular files per primitive | Everything in one huge file |
| Clean separation of concerns | 2000+ lines in nodeExecutor.js |
| Used by old test harness | Used by current Operator |
| Located in `/workflows/` | Located in `/operator/backend/services/` |

## Bottom Line:
If you're working on the Operator, **ignore this folder**. The Operator uses its own implementation.

---
*Created: January 2025 after discovering we built two parallel systems that do the same thing 🤦‍♂️*