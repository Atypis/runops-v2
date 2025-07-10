-- Add stable references to nodes table for insert/reorder functionality

-- Add UUID column for immutable node identity
ALTER TABLE nodes ADD COLUMN uuid UUID DEFAULT gen_random_uuid() NOT NULL;

-- Add alias column for human-readable references
ALTER TABLE nodes ADD COLUMN alias TEXT;

-- Create unique constraint on alias within a workflow
ALTER TABLE nodes ADD CONSTRAINT unique_alias_per_workflow UNIQUE (workflow_id, alias);

-- Create index for UUID lookups
CREATE INDEX idx_nodes_uuid ON nodes(uuid);

-- Create index for alias lookups
CREATE INDEX idx_nodes_alias ON nodes(workflow_id, alias);

-- Function to generate default alias from description
CREATE OR REPLACE FUNCTION generate_node_alias(description TEXT)
RETURNS TEXT AS $$
DECLARE
    base_alias TEXT;
    clean_alias TEXT;
BEGIN
    -- Convert description to snake_case alias
    base_alias := LOWER(description);
    -- Replace non-alphanumeric with underscore
    clean_alias := REGEXP_REPLACE(base_alias, '[^a-z0-9]+', '_', 'g');
    -- Remove leading/trailing underscores
    clean_alias := TRIM(BOTH '_' FROM clean_alias);
    -- Limit length
    clean_alias := LEFT(clean_alias, 50);
    
    RETURN clean_alias;
END;
$$ LANGUAGE plpgsql;

-- Update existing nodes to have UUIDs (already handled by DEFAULT)
-- and generate aliases from descriptions
UPDATE nodes 
SET alias = generate_node_alias(COALESCE(description, type || '_' || position))
WHERE alias IS NULL;

-- Handle any duplicate aliases by appending position
WITH duplicates AS (
    SELECT id, workflow_id, alias, position,
           ROW_NUMBER() OVER (PARTITION BY workflow_id, alias ORDER BY position) as rnum
    FROM nodes
    WHERE alias IS NOT NULL
)
UPDATE nodes n
SET alias = d.alias || '_' || d.position
FROM duplicates d
WHERE n.id = d.id AND d.rnum > 1;

-- Make alias NOT NULL after populating
ALTER TABLE nodes ALTER COLUMN alias SET NOT NULL;

-- Add comment explaining the new columns
COMMENT ON COLUMN nodes.uuid IS 'Immutable identifier for stable references across position changes';
COMMENT ON COLUMN nodes.alias IS 'Human-readable identifier for node references in templates';