const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function executeSQL(sql, description) {
  console.log(`\n🔄 ${description}...`);
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      // Try alternative approach if exec_sql doesn't exist
      const result = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({ sql })
      });
      
      if (!result.ok) {
        // Final fallback: Try to create a test table to see if connection works
        const { error: testError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .limit(1);
          
        if (testError) {
          throw new Error(`Connection test failed: ${testError.message}`);
        }
        
        console.log('⚠️  Cannot execute DDL via Supabase JS client - manual SQL required');
        console.log('📋 Execute this SQL manually in Supabase SQL Editor:');
        console.log('```sql');
        console.log(sql);
        console.log('```\n');
        return false;
      }
    }
    
    console.log(`✅ ${description} - SUCCESS`);
    return true;
  } catch (err) {
    console.error(`❌ ${description} - FAILED:`, err.message);
    console.log('📋 Execute this SQL manually in Supabase SQL Editor:');
    console.log('```sql');
    console.log(sql);
    console.log('```\n');
    return false;
  }
}

async function applyEnhancedLogging() {
  console.log('🚀 Applying Enhanced AEF Logging Migration');
  console.log('==========================================\n');
  
  const migrations = [
    {
      description: "Creating aef_execution_metadata table",
      sql: `
CREATE TABLE aef_execution_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL UNIQUE,
  workflow_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused', 'cancelled')),
  success BOOLEAN,
  total_nodes INTEGER DEFAULT 0,
  completed_nodes INTEGER DEFAULT 0,
  failed_nodes INTEGER DEFAULT 0,
  total_actions INTEGER DEFAULT 0,
  successful_actions INTEGER DEFAULT 0,
  failed_actions INTEGER DEFAULT 0,
  average_action_duration INTEGER,
  total_tokens_used INTEGER DEFAULT 0,
  artifacts JSONB DEFAULT '{"screenshots": [], "conversation_logs": [], "extracted_data": [], "final_summary": null}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`
    },
    
    {
      description: "Creating aef_node_analytics table",
      sql: `
CREATE TABLE aef_node_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES aef_execution_metadata(execution_id),
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  success BOOLEAN,
  action_count INTEGER DEFAULT 0,
  token_usage INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  result_data JSONB DEFAULT '{}',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(execution_id, node_id)
);`
    },
    
    {
      description: "Creating aef_action_analytics table",
      sql: `
CREATE TABLE aef_action_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES aef_execution_metadata(execution_id),
  node_id TEXT NOT NULL,
  action_id UUID NOT NULL DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'retrying')),
  success BOOLEAN,
  action_details JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);`
    },
    
    {
      description: "Creating essential indexes",
      sql: `
CREATE INDEX idx_aef_execution_metadata_execution_id ON aef_execution_metadata (execution_id);
CREATE INDEX idx_aef_execution_metadata_user_id ON aef_execution_metadata (user_id);
CREATE INDEX idx_aef_execution_metadata_start_time ON aef_execution_metadata (start_time DESC);
CREATE INDEX idx_aef_node_analytics_execution_id ON aef_node_analytics (execution_id);
CREATE INDEX idx_aef_action_analytics_execution_id ON aef_action_analytics (execution_id);`
    },
    
    {
      description: "Enabling Row Level Security",
      sql: `
ALTER TABLE aef_execution_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE aef_node_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE aef_action_analytics ENABLE ROW LEVEL SECURITY;`
    },
    
    {
      description: "Creating RLS policies",
      sql: `
CREATE POLICY "Users can view their own execution metadata" ON aef_execution_metadata
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all execution metadata" ON aef_execution_metadata
  FOR ALL USING (true);`
    }
  ];
  
  // Test connection first
  console.log('🔍 Testing database connection...');
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('count(*)', { count: 'exact', head: true });
      
    if (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
    console.log('✅ Database connection successful\n');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return;
  }
  
  // Check if tables already exist
  console.log('🔍 Checking existing tables...');
  try {
    const { data: existingTable } = await supabase
      .from('aef_execution_metadata')
      .select('count(*)', { count: 'exact', head: true });
      
    if (existingTable) {
      console.log('⚠️  aef_execution_metadata table already exists!');
      console.log('💡 Consider dropping it first or modify the script for updates');
      return;
    }
  } catch (err) {
    console.log('✅ Tables do not exist yet - proceeding with creation\n');
  }
  
  // Apply migrations
  let successCount = 0;
  for (const migration of migrations) {
    const success = await executeSQL(migration.sql, migration.description);
    if (success) successCount++;
  }
  
  console.log(`\n🎉 Migration Summary: ${successCount}/${migrations.length} steps completed`);
  
  if (successCount < migrations.length) {
    console.log('\n⚠️  Some steps failed - you may need to run the SQL manually in Supabase SQL Editor');
    console.log('🔗 Go to: https://supabase.com/dashboard/project/ypnnoivcybufgsrbzqkt/sql');
  } else {
    console.log('\n✅ All migrations applied successfully!');
    
    // Verify tables exist
    console.log('\n🔍 Verifying table creation...');
    const tablesToCheck = ['aef_execution_metadata', 'aef_node_analytics', 'aef_action_analytics'];
    
    for (const tableName of tablesToCheck) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('count(*)', { count: 'exact', head: true });
          
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: Created successfully`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  applyEnhancedLogging().catch(console.error);
}

module.exports = { applyEnhancedLogging }; 