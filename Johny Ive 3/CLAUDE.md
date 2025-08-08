# Claude Context Notes

## CRITICAL: Sub-Agent Restrictions

**NEVER allow sub-agents (Task tool) to modify the codebase unless the USER EXPLICITLY ASKS TO.** Sub-agents should ONLY be used for:
- Research and investigation
- Reading files and understanding code
- Searching for patterns or issues
- Gathering information
- Analyzing code and problems

Sub-agents must NOT:
- Edit any files
- Create new files
- Delete files
- Run commands that modify the codebase

This is especially important for research missions where the sub-agent is exploring the codebase. Any code modifications should be done by the main Claude instance after reviewing the sub-agent's findings.

## Supabase Database Configuration

### Operator Project
When working on the operator/test-harness system, we use the **Operator Project** in Supabase:
- **Project ID**: `ghheisbmwwikpvwqjuyn`
- **Project Name**: "Operator"
- **Status**: ACTIVE_HEALTHY
- **Region**: eu-central-1

### Other Projects (for reference)
- `ypnnoivcybufgsrbzqkt` - "runops-v2" (used for other parts of the system)
- `avqrwtmssosouvqkylgg` - "runops-dev" (INACTIVE)

### Important Note
Always apply database migrations, schema changes, and queries to the **Operator Project** when working on the test-harness/operator backend system.