import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testMCPServer() {
  console.log('Testing Director MCP Server...\n');
  
  try {
    // Spawn the server process
    const serverProcess = spawn('node', ['server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    // Create client transport
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['server.js']
    });
    
    // Create client
    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    });
    
    // Connect
    await client.connect(transport);
    console.log('✓ Connected to server\n');
    
    // List tools
    console.log('Listing available tools...');
    const toolsResponse = await client.listTools();
    console.log(`✓ Found ${toolsResponse.tools.length} tools\n`);
    
    // Show first few tools
    console.log('Sample tools:');
    toolsResponse.tools.slice(0, 5).forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description.substring(0, 60)}...`);
    });
    
    // Test MCP-specific tools
    console.log('\n\nMCP-specific tools:');
    const mcpTools = toolsResponse.tools.filter(t => t.name.startsWith('mcp_'));
    mcpTools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    
    // Test a simple call
    console.log('\n\nTesting mcp_get_current_context...');
    const contextResponse = await client.callTool({
      name: 'mcp_get_current_context',
      arguments: {}
    });
    console.log('Response:', contextResponse.content[0].text);
    
    console.log('\n✓ All tests passed!');
    
    // Cleanup
    await client.close();
    serverProcess.kill();
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run test
testMCPServer().catch(console.error);