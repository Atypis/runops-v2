import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // If supabase is not configured, this will throw (lazy init in config)
    const mod: any = await import('@/lib/director/config/supabase.js');
    const sb = (mod.supabase ?? mod.default ?? mod) as unknown as SupabaseClient;
    const { data, error } = await sb
      .from('workflows')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const workflows = (data || []).map((w: any) => {
      const title = w.title || w.name || w.goal || w.slug || w.id;
      return { id: w.id, title };
    });
    return NextResponse.json({ success: true, workflows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Supabase not configured' }, { status: 500 });
  }
}


