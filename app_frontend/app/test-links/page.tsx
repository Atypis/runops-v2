'use client';

import React from 'react';
import Link from 'next/link';

export default function TestLinksPage() {
  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      lineHeight: 1.5
    }}>
      <h1 style={{ color: '#333' }}>ReactFlow Compound Node Tests</h1>
      <p style={{ color: '#666' }}>Use these links to test the compound node functionality with different test cases:</p>
      
      <div style={{
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        padding: '20px',
        marginTop: '20px'
      }}>
        <Link href="/test-compound" style={{
          display: 'block',
          marginBottom: '10px',
          padding: '10px',
          backgroundColor: '#e0e0ff',
          borderRadius: '4px',
          textDecoration: 'none',
          color: '#333',
          fontWeight: 'bold'
        }}>
          Test Compound Nodes (2 children)
        </Link>
        <Link href="/simple-test" style={{
          display: 'block',
          marginBottom: '10px',
          padding: '10px',
          backgroundColor: '#e0e0ff',
          borderRadius: '4px',
          textDecoration: 'none',
          color: '#333',
          fontWeight: 'bold'
        }}>
          Simple Test (1 parent, 1 child)
        </Link>
        <Link href="/sop/test-compound" style={{
          display: 'block',
          marginBottom: '10px',
          padding: '10px',
          backgroundColor: '#e0e0ff',
          borderRadius: '4px',
          textDecoration: 'none',
          color: '#333',
          fontWeight: 'bold'
        }}>
          Live SOP Viewer - Test Compound
        </Link>
        <Link href="/sop/original-structure" style={{
          display: 'block',
          marginBottom: '10px',
          padding: '10px',
          backgroundColor: '#f0c3f0',
          borderRadius: '4px',
          textDecoration: 'none',
          color: '#333',
          fontWeight: 'bold',
          border: '2px solid #b00db0'
        }}>
          NEW: Original Structure SOP (Closest to Original)
        </Link>
        <Link href="/sop/compound-fixed" style={{
          display: 'block',
          marginBottom: '10px',
          padding: '10px',
          backgroundColor: '#f0c3c3',
          borderRadius: '4px',
          textDecoration: 'none',
          color: '#333',
          fontWeight: 'bold',
          border: '2px solid #d00'
        }}>
          Fixed Compound Node SOP (Multiple Loops)
        </Link>
        <Link href="/sop/reactflow-optimized" style={{
          display: 'block',
          marginBottom: '10px',
          padding: '10px',
          backgroundColor: '#c3f0c3',
          borderRadius: '4px',
          textDecoration: 'none',
          color: '#333',
          fontWeight: 'bold'
        }}>
          ReactFlow-Optimized SOP (Original Solution)
        </Link>
        <Link href="/sop/L1_process_emails" style={{
          display: 'block',
          marginBottom: '10px',
          padding: '10px',
          backgroundColor: '#ffe0e0',
          borderRadius: '4px',
          textDecoration: 'none',
          color: '#333',
          fontWeight: 'bold'
        }}>
          Original SOP (Complex Structure)
        </Link>
      </div>
      
      <p style={{ color: '#666', marginTop: '20px' }}>Check the browser console for debugging information.</p>
      
      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px',
        border: '1px solid #e0e0e0' 
      }}>
        <h2 style={{ color: '#333', marginTop: 0 }}>What changed in the Original Structure version?</h2>
        <ol style={{ color: '#555', paddingLeft: '20px' }}>
          <li>Maintains the original structure with one main loop containing all steps</li>
          <li>Preserves the nested structure with L1_C9_update_existing_record containing the three substeps</li>
          <li>Uses properly configured parent-child relationships to show steps inside their containers</li>
          <li>Closely resembles the original mocksop2.json structure while fixing the compound node issues</li>
          <li>Avoids the edge crossing issues that caused the original rendering problems</li>
        </ol>
      </div>
    </div>
  );
} 