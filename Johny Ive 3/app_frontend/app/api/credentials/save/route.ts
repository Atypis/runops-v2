import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, serviceType, authMethod, credentialData, metadata } = body;

    // Validate required fields
    if (!serviceType || !authMethod || !credentialData) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceType, authMethod, credentialData' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Simple encryption for credential data (in production, use proper encryption)
    const encryptedData = Buffer.from(JSON.stringify(credentialData)).toString('base64');

    // Prepare data for insertion
    const credentialRecord = {
      user_id: user.id,
      workflow_id: workflowId || null,
      service_type: serviceType,
      auth_method: authMethod,
      credential_data: encryptedData,
      metadata: {
        ...metadata,
        last_validated: new Date().toISOString(),
        encrypted: true,
        encryption_method: 'base64' // Note: Use proper encryption in production
      }
    };

    // Check if credential already exists (upsert logic)
    const { data: existing, error: checkError } = await supabase
      .from('user_credentials')
      .select('id')
      .eq('user_id', user.id)
      .eq('service_type', serviceType)
      .eq('workflow_id', workflowId || null)
      .single();

    let result;
    if (existing) {
      // Update existing credential
      const { data, error } = await supabase
        .from('user_credentials')
        .update({
          auth_method: authMethod,
          credential_data: encryptedData,
          metadata: credentialRecord.metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      result = { data, error };
    } else {
      // Insert new credential
      const { data, error } = await supabase
        .from('user_credentials')
        .insert(credentialRecord)
        .select()
        .single();
      
      result = { data, error };
    }

    if (result.error) {
      console.error('Database error:', result.error);
      return NextResponse.json(
        { error: 'Failed to save credentials', details: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Credentials saved successfully',
      credentialId: result.data.id
    });

  } catch (error) {
    console.error('Error saving credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 