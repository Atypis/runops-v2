# Workflow Memory Table Issue Fix

## Problem
The database upsert is failing because the `workflow_memory` table doesn't exist in your Supabase database.

## Solution

### Option 1: Run the Complete Schema (if setting up fresh)
If you're setting up a new database, run the complete schema:
```bash
# Run the complete schema file
psql [your-database-connection-string] < supabase-schema.sql
```

### Option 2: Add Only the Missing Table (if database already exists)
If your database already has other tables, just add the missing table:
```bash
# Run only the workflow_memory table creation
psql [your-database-connection-string] < add-workflow-memory-table.sql
```

### Option 3: Run SQL Directly in Supabase Dashboard
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run this SQL:

```sql
-- Create the workflow_memory table
CREATE TABLE IF NOT EXISTS workflow_memory (
  id SERIAL PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workflow_id, key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_memory_workflow_id ON workflow_memory(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_memory_key ON workflow_memory(key);

-- Add update trigger for updated_at column
CREATE TRIGGER update_workflow_memory_updated_at BEFORE UPDATE ON workflow_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Improved Error Logging
The code has been updated with better error logging that will:
1. Show the full error object with all properties
2. Detect if the error is due to a missing table
3. Display the SQL needed to create the table right in the console
4. Test the Supabase connection on startup

## What the workflow_memory table does
This table stores key-value pairs of data for each workflow, allowing nodes to:
- Store variables and context between node executions
- Share data across different nodes in the same workflow
- Persist state that can be referenced using `{{variable}}` syntax in node configurations