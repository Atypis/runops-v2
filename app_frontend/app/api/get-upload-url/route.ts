import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createSupabaseServerClient } from '@/lib/supabase';

// GET method not supported
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST() {
  try {
    // Generate a unique jobId using UUID
    const jobId = uuidv4();
    
    // Create a Supabase server client
    const supabase = createSupabaseServerClient();
    
    // Generate a signed URL for uploading to Supabase Storage
    // This URL will be valid for 10 minutes
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUploadUrl(`raw/${jobId}.mp4`);
    
    if (error) {
      console.error('Supabase error generating signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }
    
    // Return the jobId and the signed URL
    return NextResponse.json({
      jobId,
      url: data.signedUrl
    });
  } catch (error) {
    // Log the error for debugging
    console.error('Error in get-upload-url API:', error);
    
    // Return a friendly error message
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
} 