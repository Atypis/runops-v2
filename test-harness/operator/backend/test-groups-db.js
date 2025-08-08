import { supabase } from './config/supabase.js';

async function checkGroups() {
  console.log('Checking groups in database...\n');
  
  // Get all group definitions
  const { data: groups, error } = await supabase
    .from('workflow_memory')
    .select('*')
    .like('key', 'group_def_%');
    
  if (error) {
    console.error('Error fetching groups:', error);
    return;
  }
  
  console.log(`Found ${groups?.length || 0} groups in database:\n`);
  
  groups?.forEach(group => {
    console.log(`Workflow: ${group.workflow_id}`);
    console.log(`Key: ${group.key}`);
    console.log(`Group ID: ${group.value?.groupId}`);
    console.log(`Name: ${group.value?.name}`);
    console.log(`Nodes: ${group.value?.nodes?.length || 0}`);
    console.log('---');
  });
  
  process.exit(0);
}

checkGroups();