import { NextRequest, NextResponse } from 'next/server';
import { createDirectSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

/**
 * GET /api/sop/[sopId]
 * Retrieves a SOP document from the database
 * 
 * Note: Authentication will be added in Ticket 1.8
 * Currently, this endpoint does not verify user ownership of the SOP
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sopId: string } }
) {
  try {
    const supabase = createDirectSupabaseClient();
    
    // TODO: Add authentication check in Ticket 1.8
    // This should verify the user is authenticated and has access to this SOP
    
    // Get the job_id (which is the sopId in our case)
    const { sopId } = params;
    
    if (!sopId) {
      return NextResponse.json(
        { error: 'SOP ID is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching SOP data for job ID: ${sopId}`);

    // Query the sops table to get the SOP data with the given job_id
    const { data: sop, error } = await supabase
      .from('sops')
      .select('*')
      .eq('job_id', sopId)
      .single();

    if (error) {
      console.error('Error fetching SOP:', error);
      
      // Additional debug query to check if the SOP exists
      const { data: allSops } = await supabase
        .from('sops')
        .select('id, job_id')
        .eq('job_id', sopId);
        
      console.log('Debug - SOP query result:', allSops);
      
      return NextResponse.json(
        { error: 'Failed to fetch SOP data' },
        { status: 500 }
      );
    }

    if (!sop) {
      console.log(`No SOP found for job ID: ${sopId}`);
      return NextResponse.json(
        { error: 'SOP not found' },
        { status: 404 }
      );
    }

    console.log(`Successfully retrieved SOP for job ID: ${sopId}`);
    
    // Return the SOP data
    return NextResponse.json(sop, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sop/[sopId]
 * Updates a SOP document (step titles or deletions)
 * 
 * Note: Authentication will be added in Ticket 1.8
 * Currently, this endpoint does not verify user ownership of the SOP
 * 
 * Request body example:
 * {
 *   type: 'update',
 *   nodeId: 'node123',
 *   updates: { label: 'New Step Title' }
 * }
 * 
 * OR
 * 
 * {
 *   type: 'delete',
 *   nodeId: 'node123'
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { sopId: string } }
) {
  try {
    const supabase = createDirectSupabaseClient();
    
    // TODO: Add authentication check in Ticket 1.8
    // This should verify the user is authenticated and has access to this SOP
    
    const { sopId } = params;
    
    if (!sopId) {
      return NextResponse.json(
        { error: 'SOP ID is required' },
        { status: 400 }
      );
    }

    // Parse the request body
    const body = await request.json();
    
    if (!body || !body.type || !body.nodeId) {
      return NextResponse.json(
        { error: 'Invalid request body. Required fields: type, nodeId' },
        { status: 400 }
      );
    }

    console.log(`PATCH operation on SOP ${sopId}, type: ${body.type}, nodeId: ${body.nodeId}`);

    // Fetch the current SOP data
    const { data: sop, error: fetchError } = await supabase
      .from('sops')
      .select('*')
      .eq('job_id', sopId)
      .single();

    if (fetchError || !sop) {
      console.error('Error fetching SOP:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch SOP data' },
        { status: 500 }
      );
    }

    // Make a deep copy of the SOP data to modify
    const sopData = JSON.parse(JSON.stringify(sop.data));
    const { nodeId } = body;

    // Apply the requested changes based on the operation type
    if (body.type === 'update' && body.updates) {
      // Find the node in the nodes array and update its properties
      const nodeIndex = sopData.public.nodes.findIndex((node: any) => node.id === nodeId);
      
      if (nodeIndex === -1) {
        return NextResponse.json(
          { error: `Node with ID ${nodeId} not found` },
          { status: 404 }
        );
      }
      
      console.log(`Updating node ${nodeId}, previous:`, sopData.public.nodes[nodeIndex]);
      
      // Apply updates to the node
      sopData.public.nodes[nodeIndex] = {
        ...sopData.public.nodes[nodeIndex],
        ...body.updates
      };
      
      console.log(`Node updated, new state:`, sopData.public.nodes[nodeIndex]);
    } 
    else if (body.type === 'delete') {
      // Find the node to delete
      const nodeIndex = sopData.public.nodes.findIndex((node: any) => node.id === nodeId);
      
      if (nodeIndex === -1) {
        return NextResponse.json(
          { error: `Node with ID ${nodeId} not found` },
          { status: 404 }
        );
      }
      
      console.log(`Deleting node ${nodeId}`);
      
      // Remove the node from the nodes array
      sopData.public.nodes.splice(nodeIndex, 1);
      
      // Also remove any edges connected to this node
      const edgesBefore = sopData.public.edges.length;
      sopData.public.edges = sopData.public.edges.filter(
        (edge: any) => edge.source !== nodeId && edge.target !== nodeId
      );
      console.log(`Removed ${edgesBefore - sopData.public.edges.length} edges connected to node ${nodeId}`);
      
      // If the node has children, we should handle those too
      // This could involve deleting them or updating their parent references
      // For now, we'll just keep them orphaned as specified in the requirements
    }
    else {
      return NextResponse.json(
        { error: 'Invalid operation type. Supported types: update, delete' },
        { status: 400 }
      );
    }

    // Update the SOP in the database
    const { data: updatedSop, error: updateError } = await supabase
      .from('sops')
      .update({ 
        data: sopData,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', sopId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating SOP:', updateError);
      return NextResponse.json(
        { error: 'Failed to update SOP data' },
        { status: 500 }
      );
    }

    console.log(`Successfully updated SOP ${sopId}`);

    // Return the updated SOP data
    return NextResponse.json(updatedSop, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 