# Claude Context Notes

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