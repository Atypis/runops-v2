import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3002/api/director';

async function debugGroups() {
  try {
    // Get latest workflow
    const workflowsRes = await fetch(`${API_BASE}/workflows`);
    const workflows = await workflowsRes.json();
    
    if (workflows.length === 0) {
      console.log('No workflows found');
      return;
    }
    
    const latestWorkflow = workflows[0];
    console.log(`Latest workflow: ${latestWorkflow.id}`);
    
    // Get workflow details
    const workflowRes = await fetch(`${API_BASE}/workflows/${latestWorkflow.id}`);
    const workflow = await workflowRes.json();
    
    // Find group nodes
    const allGroups = workflow.nodes.filter(n => n.type === 'group');
    const topLevelGroups = workflow.nodes.filter(n => n.type === 'group' && !n.params?._parent_position);
    
    console.log(`\nTotal nodes: ${workflow.nodes.length}`);
    console.log(`All group nodes: ${allGroups.length}`);
    console.log(`Top-level group nodes: ${topLevelGroups.length}`);
    
    console.log('\nGroup nodes details:');
    allGroups.forEach(node => {
      console.log(`- Position ${node.position}: ${node.params.name || 'Unnamed'}`);
      console.log(`  Range: ${Array.isArray(node.params.nodeRange) ? node.params.nodeRange.join('-') : node.params.nodeRange}`);
      console.log(`  Has parent: ${node.params._parent_position ? 'Yes' : 'No'}`);
    });
    
    // Check node rendering order
    const topLevelNodes = workflow.nodes.filter(n => !n.params?._parent_position);
    console.log(`\nTop-level nodes: ${topLevelNodes.length}`);
    console.log('Last 5 top-level nodes:');
    topLevelNodes.slice(-5).forEach(n => {
      console.log(`- Position ${n.position}: ${n.type} - ${n.description}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugGroups();