const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixExecutionIdType() {
  try {
    console.log('🔧 Fixing execution_id column type...');
    
    // Test current state
    console.log('🧪 Testing current table...');
    const { data: testData, error: testError } = await supabase
      .from('aef_node_logs')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Table test failed:', testError);
      return false;
    }

    console.log('✅ Table is accessible');
    
    // The fix: Change execution_id from UUID to TEXT
    console.log('📋 SQL to run in Supabase SQL Editor:');
    console.log('=' .repeat(60));
    console.log(`
-- Fix execution_id column type
ALTER TABLE aef_node_logs 
ALTER COLUMN execution_id TYPE TEXT;

-- Recreate the index with the new type
DROP INDEX IF EXISTS idx_aef_node_logs_execution_id;
DROP INDEX IF EXISTS idx_aef_node_logs_execution_node;

CREATE INDEX idx_aef_node_logs_execution_id ON aef_node_logs (execution_id);
CREATE INDEX idx_aef_node_logs_execution_node ON aef_node_logs (execution_id, node_id, timestamp DESC);
    `);
    console.log('=' .repeat(60));
    
    console.log('\n💡 After running the SQL above, test with:');
    console.log('node test-fixed-logging.js');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixExecutionIdType(); 