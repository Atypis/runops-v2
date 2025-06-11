import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ServiceType, CredentialType } from '@/lib/types/aef';
import { encrypt, decrypt } from '@/lib/credentials/encryption';

interface CredentialData {
  id: string;
  user_id: string;
  workflow_id: string | null;
  service_type: string;
  auth_method: string;
  credential_data: any;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const services = searchParams.get('services')?.split(',');

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('user_credentials')
      .select('*')
      .eq('user_id', user.id);

    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }

    if (services) {
      query = query.in('service_type', services);
    }

    const { data: credentials, error } = await query;

    if (error) {
      console.error('Error fetching credentials:', error);
      return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
    }

    // Decrypt credentials before returning
    const decryptedCredentials = (credentials as CredentialData[]).map((cred: CredentialData) => ({
      ...cred,
      credential_data: decrypt(cred.credential_data)
    }));

    return NextResponse.json({ credentials: decryptedCredentials });
  } catch (error) {
    console.error('Credentials API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceType, authMethod, credentials, workflowId } = body;

    if (!serviceType || !authMethod || !credentials) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Encrypt credentials before storing
    const encryptedCredentials = encrypt(credentials);

    // Prepare the upsert data
    const upsertData = {
      user_id: user.id,
      workflow_id: workflowId || null,
      service_type: serviceType,
      auth_method: authMethod,
      credential_data: encryptedCredentials,
      metadata: {
        created_from: 'credential_panel',
        last_validated: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    // Use proper upsert with the exact constraint name from the database
    const { data, error } = await supabase
      .from('user_credentials')
      .upsert(upsertData, {
        onConflict: 'user_id,service_type,workflow_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing credentials:', error);
      return NextResponse.json({ error: 'Failed to store credentials' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      credential: {
        ...data,
        credential_data: credentials // Return unencrypted for client
      }
    });
  } catch (error) {
    console.error('Credentials POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, serviceType, authMethod, credentials, workflowId } = body;

    if (!id || !serviceType || !authMethod || !credentials) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Encrypt credentials before storing
    const encryptedCredentials = encrypt(credentials);

    const { data, error } = await supabase
      .from('user_credentials')
      .update({
        service_type: serviceType,
        auth_method: authMethod,
        credential_data: encryptedCredentials,
        workflow_id: workflowId || null,
        metadata: {
          updated_from: 'credential_panel',
          last_validated: new Date().toISOString()
        }
      })
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only update their own credentials
      .select()
      .single();

    if (error) {
      console.error('Error updating credentials:', error);
      return NextResponse.json({ error: 'Failed to update credentials' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      credential: {
        ...data,
        credential_data: credentials // Return unencrypted for client
      }
    });
  } catch (error) {
    console.error('Credentials PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing credential ID' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('user_credentials')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Ensure user can only delete their own credentials

    if (error) {
      console.error('Error deleting credentials:', error);
      return NextResponse.json({ error: 'Failed to delete credentials' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Credentials DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 