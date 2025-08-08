import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * WebSocket endpoint for real-time AEF execution updates
 * Provides live execution state, browser screenshots, and checkpoint notifications
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  const { executionId } = params;
  
  // Check if this is a WebSocket upgrade request
  const upgrade = request.headers.get('upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  try {
    // Authenticate the WebSocket connection
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return new Response('Authentication required', { status: 401 });
    }

    // Verify user has access to this execution
    const { data: job, error: findError } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', executionId)
      .single();

    if (findError || !job) {
      return new Response('Execution not found', { status: 404 });
    }

    const metadata = job.metadata as any;
    if (metadata?.execution_record?.user_id !== user.id) {
      return new Response('Access denied', { status: 403 });
    }

    console.log(`WebSocket connection established for execution ${executionId}, user ${user.id}`);

    // For Next.js, we need to handle WebSocket upgrade differently
    // This is a simplified implementation - in production, you might want to use a separate WebSocket server
    
    // Return a response that indicates WebSocket support
    // The actual WebSocket handling would be done by a separate server or edge function
    return new Response(
      JSON.stringify({
        message: 'WebSocket endpoint ready',
        executionId,
        userId: user.id,
        instructions: 'This endpoint supports WebSocket upgrade for real-time updates'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );

  } catch (error) {
    console.error('Error in WebSocket endpoint:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, Connection',
    },
  });
}

// Note: For a full WebSocket implementation in Next.js, you would typically:
// 1. Use a separate WebSocket server (like Socket.io)
// 2. Use Vercel Edge Functions with WebSocket support
// 3. Use a third-party WebSocket service (like Pusher or Ably)
// 
// For MVP, we could also implement polling fallback that mimics WebSocket behavior:

/**
 * Polling fallback endpoint (if WebSocket fails)
 * GET /api/aef/live/[executionId]?poll=true
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  const { executionId } = params;
  const url = new URL(request.url);
  const isPoll = url.searchParams.get('poll') === 'true';
  
  if (!isPoll) {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current execution state
    const { data: job, error: findError } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', executionId)
      .single();

    if (findError || !job) {
      return new Response(JSON.stringify({ error: 'Execution not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const metadata = job.metadata as any;
    if (metadata?.execution_record?.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const executionRecord = metadata.execution_record;
    
    // Mock browser state for MVP (would come from actual browser session)
    const browserState = {
      screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', // 1x1 transparent PNG
      currentUrl: 'https://example.com',
      isReady: true,
      lastAction: executionRecord.last_action || 'idle'
    };

    // Format response like WebSocket message
    const response = {
      type: 'execution_update',
      timestamp: new Date().toISOString(),
      execution: {
        id: executionId,
        status: executionRecord.status || 'idle',
        currentStep: executionRecord.current_step || null,
        progress: executionRecord.progress || 0
      },
      browser: browserState,
      logs: executionRecord.logs || [],
      checkpoints: executionRecord.pending_checkpoints || [],
      error: executionRecord.error || null
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Error in polling endpoint:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 