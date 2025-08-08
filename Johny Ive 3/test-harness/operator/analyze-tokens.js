import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function analyzeTokenCounts() {
  console.log('=== Token Count Analysis ===\n');
  
  // 1. Check reasoning context
  console.log('1. Checking reasoning_context table...');
  const { data: contexts, error: contextError } = await supabase
    .from('reasoning_context')
    .select('conversation_turn, token_counts, created_at, encrypted_items')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (contextError) {
    console.error('Error fetching reasoning context:', contextError);
  } else if (contexts && contexts.length > 0) {
    console.log(`Found ${contexts.length} reasoning context entries:\n`);
    
    contexts.forEach((ctx, idx) => {
      console.log(`Entry ${idx + 1}:`);
      console.log(`  Turn: ${ctx.conversation_turn}`);
      console.log(`  Created: ${ctx.created_at}`);
      console.log(`  Token counts:`, ctx.token_counts);
      
      // Check encrypted items size
      if (ctx.encrypted_items) {
        const encryptedSize = JSON.stringify(ctx.encrypted_items).length;
        console.log(`  Encrypted items size: ${encryptedSize} characters`);
        console.log(`  Number of encrypted items: ${ctx.encrypted_items.length}`);
        
        // Sample first encrypted item to see structure
        if (ctx.encrypted_items.length > 0) {
          const firstItem = ctx.encrypted_items[0];
          console.log(`  First encrypted item type: ${firstItem.type}`);
          if (firstItem.encrypted_content) {
            console.log(`  Encrypted content length: ${firstItem.encrypted_content.length} chars`);
          }
        }
      }
      console.log('');
    });
    
    // Calculate cumulative tokens
    let totalInput = 0;
    let totalOutput = 0;
    let totalReasoning = 0;
    
    contexts.forEach(ctx => {
      if (ctx.token_counts) {
        totalInput += ctx.token_counts.input_tokens || 0;
        totalOutput += ctx.token_counts.output_tokens || 0;
        totalReasoning += ctx.token_counts.reasoning_tokens || 0;
      }
    });
    
    console.log('Cumulative token counts across all entries:');
    console.log(`  Total input tokens: ${totalInput}`);
    console.log(`  Total output tokens: ${totalOutput}`);
    console.log(`  Total reasoning tokens: ${totalReasoning}`);
    console.log(`  Grand total: ${totalInput + totalOutput + totalReasoning}`);
  } else {
    console.log('No reasoning context entries found.\n');
  }
  
  // 2. Check how encrypted context accumulates
  console.log('\n2. Analyzing encrypted context accumulation...');
  
  if (contexts && contexts.length > 0) {
    // Simulate loading context like loadReasoningContext does
    const allEncryptedItems = [];
    
    // Take last 5 turns (or however many we have)
    const recentContexts = contexts.slice(0, Math.min(5, contexts.length));
    
    for (const context of recentContexts) {
      if (context.encrypted_items && Array.isArray(context.encrypted_items)) {
        allEncryptedItems.push(...context.encrypted_items);
      }
    }
    
    console.log(`Total encrypted items that would be loaded: ${allEncryptedItems.length}`);
    console.log(`Total size of encrypted context: ${JSON.stringify(allEncryptedItems).length} characters`);
    
    // Estimate tokens (rough approximation: 4 chars per token)
    const estimatedTokens = Math.ceil(JSON.stringify(allEncryptedItems).length / 4);
    console.log(`Estimated tokens from encrypted context: ${estimatedTokens}`);
  }
  
  // 3. Check if table exists
  console.log('\n3. Checking if reasoning_context table exists...');
  const { data: tables, error: tableError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'reasoning_context');
  
  if (tableError) {
    console.log('Could not check table existence:', tableError.message);
  } else if (tables && tables.length > 0) {
    console.log('✓ reasoning_context table exists');
  } else {
    console.log('✗ reasoning_context table does NOT exist');
    console.log('\nYou may need to create it with:');
    console.log(`
CREATE TABLE reasoning_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  conversation_turn INTEGER NOT NULL,
  encrypted_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reasoning_context_workflow ON reasoning_context(workflow_id);
CREATE INDEX idx_reasoning_context_turn ON reasoning_context(workflow_id, conversation_turn DESC);
`);
  }
}

// Run the analysis
analyzeTokenCounts().catch(console.error);