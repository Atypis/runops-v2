import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function debugTokenIssue() {
  console.log('=== DEBUG: Token Count Multiplication Issue ===\n');
  
  // Get a specific workflow's context
  const workflowId = 'e56b00b2-9c73-4ce9-b901-0b63bc5c04ba'; // Replace with actual workflow ID if needed
  
  // 1. Simulate what happens in loadReasoningContext
  console.log('1. Loading reasoning context (last 5 turns)...\n');
  
  let { data: contexts, error } = await supabase
    .from('reasoning_context')
    .select('encrypted_items, conversation_turn, token_counts')
    .eq('workflow_id', workflowId)
    .order('conversation_turn', { ascending: false })
    .limit(5);
  
  if (error || !contexts || contexts.length === 0) {
    console.log('No reasoning context found for this workflow. Checking all workflows...');
    
    // Get any workflow with reasoning context
    const { data: anyContext } = await supabase
      .from('reasoning_context')
      .select('workflow_id, encrypted_items, conversation_turn, token_counts')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (anyContext && anyContext.length > 0) {
      console.log(`Found reasoning context for workflow: ${anyContext[0].workflow_id}`);
      contexts = anyContext;
    } else {
      console.log('No reasoning context found in database.');
      return;
    }
  }
  
  // Flatten all encrypted items (this is what loadReasoningContext does)
  const allEncryptedItems = [];
  let conversationHistory = [];
  
  for (const context of contexts || []) {
    if (context.encrypted_items && Array.isArray(context.encrypted_items)) {
      allEncryptedItems.push(...context.encrypted_items);
    }
    
    // Show token counts for each turn
    console.log(`Turn ${context.conversation_turn}:`);
    console.log(`  Input tokens: ${context.token_counts?.input_tokens || 0}`);
    console.log(`  Encrypted items: ${context.encrypted_items?.length || 0}`);
    console.log(`  Encrypted size: ${JSON.stringify(context.encrypted_items || []).length} chars\n`);
  }
  
  console.log('\n2. Cumulative encrypted context analysis:');
  console.log(`Total encrypted items being loaded: ${allEncryptedItems.length}`);
  console.log(`Total size of encrypted context: ${JSON.stringify(allEncryptedItems).length} characters`);
  console.log(`Estimated tokens from encrypted context: ~${Math.ceil(JSON.stringify(allEncryptedItems).length / 4)}\n`);
  
  // 3. Show what gets sent to OpenAI
  console.log('3. What gets sent to OpenAI (processWithResponsesAPI):');
  console.log('   - System message');
  console.log('   - Cleaned conversation history (without debug_input, toolCalls, etc.)');
  console.log(`   - ${allEncryptedItems.length} encrypted reasoning items from previous turns`);
  console.log('   - Current user message\n');
  
  // 4. Explain the token multiplication
  console.log('4. TOKEN MULTIPLICATION EXPLAINED:');
  console.log('   When using reasoning models (o4-mini), the system:');
  console.log('   a) Loads encrypted reasoning context from last 5 turns');
  console.log('   b) Each turn contains ~6-12KB of encrypted content');
  console.log('   c) This accumulates to ~30KB+ of encrypted data');
  console.log('   d) This encrypted data is sent with EVERY new message\n');
  
  console.log('5. EXAMPLE CALCULATION:');
  console.log('   User message: 1KB (250 tokens)');
  console.log('   System prompt: 10KB (2,500 tokens)');
  console.log('   Conversation history: 25KB (6,250 tokens)');
  console.log('   Encrypted reasoning context: 30KB (7,500 tokens)');
  console.log('   TOTAL: 66KB → 16,500 tokens!\n');
  
  console.log('6. The issue:');
  console.log('   - Character count increases by 1KB (user\'s new message)');
  console.log('   - But token count jumps by 11K because:');
  console.log('     • The entire encrypted reasoning history is re-sent');
  console.log('     • Each turn adds more encrypted content');
  console.log('     • This grows exponentially with each conversation turn\n');
  
  console.log('7. SOLUTION OPTIONS:');
  console.log('   a) Limit encrypted context to last 1-2 turns instead of 5');
  console.log('   b) Compress or summarize older reasoning context');
  console.log('   c) Only include encrypted context when necessary');
  console.log('   d) Clear reasoning context periodically');
  console.log('   e) Use a different model that doesn\'t require encrypted context');
}

// Run the debug
debugTokenIssue().catch(console.error);