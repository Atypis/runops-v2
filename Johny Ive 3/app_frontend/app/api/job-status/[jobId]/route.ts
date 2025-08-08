import { NextResponse } from 'next/server';
import { createDirectSupabaseClient } from '@/lib/supabase-server';

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
    
    // Use our improved direct client
    const supabase = createDirectSupabaseClient();
    
    // Query the jobs table for this job's status
    console.log(`Querying status for job ID: ${jobId}`);
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();
    
    if (jobError) {
      console.error('Error querying job status:', jobError);
      return NextResponse.json(
        { error: 'Error retrieving job status' },
        { 
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        }
      );
    }
    
    if (!job) {
      console.log(`Job ${jobId} not found in database`);
      return NextResponse.json(
        { 
          jobId,
          status: 'unknown',
          error: 'Job not found' 
        },
        { 
          status: 404,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        }
      );
    }
    
    console.log(`Job ${jobId} status from database: ${job.status}`);
    
    return NextResponse.json({
      jobId: job.job_id,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
      error: job.error,
      progressStage: job.progress_stage,
      progressPercent: job.progress_percent
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (e: any) {
    console.error('Error in job status endpoint:', e);
    return NextResponse.json(
      { error: e.message || 'An unexpected error occurred' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  }
} 