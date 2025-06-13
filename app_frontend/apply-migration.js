const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function applyMigration() {
  console.log('🚀 Applying enhanced AEF logging migration...');
  
  // Create Supabase client with service role key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250115_002_create_aef_execution_metadata.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Reading migration file...');
    console.log(`📝 Migration file size: ${migrationSQL.length} characters`);
    
    // Split SQL statements (simple approach - split by semicolon followed by newline)
    const statements = migrationSQL
      .split(';\n')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'))
      .map(stmt => stmt + (stmt.endsWith(';') ? '' : ';'));
    
    console.log(`💾 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 1) continue; // Skip lone semicolons
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec', {
          sql: statement
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.log('🔍 Statement was:', statement.substring(0, 100) + '...');
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
      }
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    const tablesToCheck = [
      'aef_execution_metadata',
      'aef_node_analytics', 
      'aef_action_analytics',
      'aef_error_analytics',
      'aef_performance_analytics'
    ];
    
    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('count(*)', { count: 'exact', head: true });
        
        if (error) {
          console.log(`❌ Table ${tableName}: NOT CREATED (${error.message})`);
        } else {
          console.log(`✅ Table ${tableName}: CREATED SUCCESSFULLY`);
        }
      } catch (err) {
        console.log(`❌ Table ${tableName}: ERROR CHECKING (${err.message})`);
      }
    }
    
    console.log('\n🎉 Migration application completed!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

// Execute if run directly
if (require.main === module) {
  applyMigration().catch(console.error);
}

module.exports = { applyMigration }; 