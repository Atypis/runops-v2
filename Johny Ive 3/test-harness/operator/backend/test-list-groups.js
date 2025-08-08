import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listGroups(workflowId) {
  console.log(`\n=== Listing Groups for Workflow: ${workflowId} ===\n`);
  
  // Get all group definitions from workflow memory
  const { data: groups, error } = await supabase
    .from('workflow_memory')
    .select('key, value')
    .eq('workflow_id', workflowId)
    .like('key', 'group_def_%');
  
  if (error) {
    console.error('Database error:', error);
    return;
  }
  
  if (!groups || groups.length === 0) {
    console.log('No groups found for this workflow.');
    return;
  }
  
  console.log(`Found ${groups.length} group(s):\n`);
  
  for (const group of groups) {
    const def = group.value;
    console.log(`Group ID: ${def.groupId}`);
    console.log(`Description: ${def.description || 'No description'}`);
    console.log(`Parameters: ${def.params ? def.params.join(', ') : 'None'}`);
    console.log(`Number of nodes: ${def.nodes?.length || 0}`);
    
    if (def.nodes && def.nodes.length > 0) {
      console.log('Node types:');
      def.nodes.forEach((node, index) => {
        console.log(`  ${index + 1}. ${node.type}${node.description ? ` - ${node.description}` : ''}`);
      });
    }
    
    console.log('---');
  }
}

// Run the test
const workflowId = 'a433cadd-2a38-4561-b092-49c751d17457';
listGroups(workflowId).catch(console.error);