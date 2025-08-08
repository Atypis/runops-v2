import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { WorkflowCredential } from '@/lib/types/aef';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, requiredCredentials } = body;

    if (!workflowId || !requiredCredentials) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all credentials for this workflow
    const { data: credentials, error } = await supabase
      .from('user_credentials')
      .select('*')
      .eq('user_id', user.id)
      .eq('workflow_id', workflowId);

    if (error) {
      console.error('Error fetching credentials for validation:', error);
      return NextResponse.json({ error: 'Failed to validate credentials' }, { status: 500 });
    }

    // Build a map of available credentials
    const availableCredentials = new Map<string, any>();
    credentials.forEach(cred => {
      const credData = cred.credential_data;
      if (typeof credData === 'object') {
        Object.keys(credData).forEach(key => {
          availableCredentials.set(key, credData[key]);
        });
      }
    });

    // Check required credentials
    const requiredIds = (requiredCredentials as WorkflowCredential[])
      .filter(c => c.required)
      .map(c => c.id);

    const missingRequired = requiredIds.filter(id => !availableCredentials.has(id) || !availableCredentials.get(id));
    const setCount = requiredIds.filter(id => availableCredentials.has(id) && availableCredentials.get(id)).length;

    return NextResponse.json({
      success: true,
      isComplete: missingRequired.length === 0,
      missingRequired,
      setCount,
      totalRequired: requiredIds.length
    });
  } catch (error) {
    console.error('Credentials validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 