import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // Get jobId from request body
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }
    
    // Create a Supabase server client
    const supabase = createSupabaseServerClient();
    
    // Check if the file exists in storage
    const { data: fileExists, error: fileCheckError } = await supabase.storage
      .from('videos')
      .list(`raw`, {
        search: `${jobId}.mp4`
      });
    
    if (fileCheckError || !fileExists || fileExists.length === 0) {
      console.error('File not found in storage:', fileCheckError || 'No matching files');
      return NextResponse.json(
        { error: 'Video file not found. Please upload again.' },
        { status: 404 }
      );
    }
    
    // For MVP, we're simulating job queueing
    // In a production app, this would create a record in a jobs table
    // or send a message to a queue service
    
    // Example: Insert job record into database
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([
        { 
          job_id: jobId,
          status: 'queued',
          created_at: new Date().toISOString()
        }
      ])
      .select();
      
    if (jobError) {
      // For MVP development, we'll continue even if DB insertion fails
      // This allows testing without requiring the full jobs table setup
      console.warn('Could not insert job record:', jobError);
    }
    
    // Return success with jobId
    return NextResponse.json({
      jobId,
      status: 'queued',
      message: 'Video processing job has been queued'
    });
  } catch (error) {
    console.error('Error in queue-job API:', error);
    
    return NextResponse.json(
      { error: 'Failed to queue processing job' },
      { status: 500 }
    );
  }
} 