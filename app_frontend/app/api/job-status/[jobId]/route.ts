import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }
    
    // Create a Supabase server client
    const supabase = createSupabaseServerClient();
    
    // Query the jobs table for this job's status
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();
      
    if (jobError) {
      // If we can't find the job, check if the file exists in storage
      // This handles cases where the job wasn't properly created in the database
      const { data: fileExists } = await supabase.storage
        .from('videos')
        .list('raw', {
          search: `${jobId}.mp4`
        });
      
      if (fileExists && fileExists.length > 0) {
        // File exists but job record doesn't
        return NextResponse.json({
          jobId,
          status: 'uploaded',
          message: 'File uploaded but processing not started'
        });
      }
      
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Return the job status
    return NextResponse.json({
      jobId,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
      error: job.error
    });
  } catch (error) {
    console.error('Error in job-status API:', error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve job status' },
      { status: 500 }
    );
  }
} 