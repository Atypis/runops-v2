#!/usr/bin/env node

import fetch from 'node-fetch';

async function testRPC() {
  const backendUrl = 'http://localhost:3003';
  const workflowId = '200041f3-a910-480d-8173-ff983b59d01e';
  const userId = 'default-user';

  console.log('Testing RPC connection to backend...\n');

  // Test 1: Initialize
  console.log('1. Testing initialize...');
  try {
    const response = await fetch(`${backendUrl}/api/director/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId, userId })
    });
    const result = await response.json();
    console.log('✓ Initialize:', result);
  } catch (error) {
    console.log('✗ Initialize failed:', error.message);
  }

  // Test 2: Get workflow nodes
  console.log('\n2. Testing getWorkflowNodes...');
  try {
    const response = await fetch(`${backendUrl}/api/director/getWorkflowNodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId, userId })
    });
    const result = await response.json();
    console.log('✓ Got', result.length, 'nodes');
  } catch (error) {
    console.log('✗ GetWorkflowNodes failed:', error.message);
  }

  // Test 3: Get browser state
  console.log('\n3. Testing getBrowserState...');
  try {
    const response = await fetch(`${backendUrl}/api/director/getBrowserState`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId, userId })
    });
    const result = await response.json();
    console.log('✓ Browser state:', result);
  } catch (error) {
    console.log('✗ GetBrowserState failed:', error.message);
  }

  console.log('\nRPC tests complete!');
}

testRPC();