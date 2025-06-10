import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createDirectSupabaseClient } from '@/lib/supabase-server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/aef/nuclear-kill
 * 💀 NUCLEAR OPTION: DESTROYS EVERYTHING
 * - ALL Docker containers (aef-browser and any others)
 * - ALL browser processes
 * - ALL database records
 * - ALL persistent state
 * - EVERYTHING DIES
 */
export async function POST(request: NextRequest) {
  try {
    console.log('💥💀 [NUCLEAR KILL] INITIATING COMPLETE DESTRUCTION...');
    
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    const destructionLog: string[] = [];
    
    // 💀 STEP 1: KILL ALL DOCKER CONTAINERS
    try {
      console.log('💀 [NUCLEAR KILL] Step 1: Destroying ALL Docker containers...');
      
      // Get all running containers
      const containersOutput = await execAsync('docker ps -q');
      const containerIds = containersOutput.stdout.trim().split('\n').filter((id: string) => id.length > 0);
      
      if (containerIds.length > 0) {
        // Force kill ALL running containers
        await execAsync(`docker kill ${containerIds.join(' ')}`);
        destructionLog.push(`💀 Killed ${containerIds.length} running containers`);
        
        // Remove ALL containers (running and stopped)
        await execAsync('docker container prune -f');
        destructionLog.push(`💀 Pruned all stopped containers`);
      }
      
      // Specifically target aef-browser containers
      try {
        await execAsync('docker stop $(docker ps -q --filter "ancestor=aef-browser") 2>/dev/null || true');
        await execAsync('docker rm $(docker ps -aq --filter "ancestor=aef-browser") 2>/dev/null || true');
        destructionLog.push(`💀 Destroyed all aef-browser containers`);
      } catch (e) {
        console.log('No aef-browser containers found to destroy');
      }
      
    } catch (dockerError) {
      console.warn('⚠️ Docker destruction partial failure:', dockerError);
      destructionLog.push(`⚠️ Docker cleanup: ${dockerError instanceof Error ? dockerError.message : 'Unknown error'}`);
    }
    
    // 💀 STEP 2: KILL ALL BROWSER PROCESSES
    try {
      console.log('💀 [NUCLEAR KILL] Step 2: Killing ALL browser processes...');
      
      // Kill Chrome/Chromium processes
      await execAsync('pkill -f "chromium\\|chrome\\|google-chrome" 2>/dev/null || true');
      await execAsync('pkill -f "stagehand" 2>/dev/null || true');
      await execAsync('pkill -f "browser-server" 2>/dev/null || true');
      
      destructionLog.push(`💀 Killed all browser and stagehand processes`);
      
    } catch (processError) {
      console.warn('⚠️ Process killing partial failure:', processError);
      destructionLog.push(`⚠️ Process cleanup: ${processError instanceof Error ? processError.message : 'Unknown error'}`);
    }
    
    // 💀 STEP 3: WIPE ALL DATABASE RECORDS
    try {
      console.log('💀 [NUCLEAR KILL] Step 3: Wiping ALL database records...');
      
      const directSupabase = createDirectSupabaseClient();
      
      // Destroy session_registry records
      const { error: sessionError, count: sessionCount } = await supabase
        .from('session_registry')
        .delete()
        .neq('id', 'impossible-id'); // Delete all records
      
      if (!sessionError) {
        destructionLog.push(`💀 Wiped ${sessionCount || 'all'} session registry records`);
      }
      
      // Destroy jobs records
      const { error: jobsError, count: jobsCount } = await directSupabase
        .from('jobs')
        .delete()
        .neq('job_id', 'impossible-id'); // Delete all records
      
      if (!jobsError) {
        destructionLog.push(`💀 Wiped ${jobsCount || 'all'} job records`);
      }
      
    } catch (dbError) {
      console.warn('⚠️ Database destruction partial failure:', dbError);
      destructionLog.push(`⚠️ Database cleanup: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
    }
    
    // 💀 STEP 4: CLEAN TEMPORARY FILES
    try {
      console.log('💀 [NUCLEAR KILL] Step 4: Cleaning temporary files...');
      
      // Clean tmp directories that might contain browser state
      await execAsync('find /tmp -name "*stagehand*" -type d -exec rm -rf {} + 2>/dev/null || true');
      await execAsync('find /tmp -name "*aef-browser*" -type d -exec rm -rf {} + 2>/dev/null || true');
      await execAsync('find /tmp -name "*chromium*" -type d -exec rm -rf {} + 2>/dev/null || true');
      
      destructionLog.push(`💀 Cleaned all temporary browser state files`);
      
    } catch (cleanupError) {
      console.warn('⚠️ Temp cleanup partial failure:', cleanupError);
      destructionLog.push(`⚠️ Temp cleanup: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`);
    }
    
    // 💀 STEP 5: DOCKER SYSTEM PRUNE (NUCLEAR CLEANUP)
    try {
      console.log('💀 [NUCLEAR KILL] Step 5: Docker system prune...');
      
      // Remove all unused containers, networks, images, and build cache
      await execAsync('docker system prune -f --volumes');
      destructionLog.push(`💀 Docker system pruned - all unused resources destroyed`);
      
    } catch (pruneError) {
      console.warn('⚠️ Docker prune partial failure:', pruneError);
      destructionLog.push(`⚠️ Docker prune: ${pruneError instanceof Error ? pruneError.message : 'Unknown error'}`);
    }
    
    console.log('💀 [NUCLEAR KILL] DESTRUCTION COMPLETE');
    console.log('📋 Destruction log:', destructionLog);
    
    return NextResponse.json({
      success: true,
      message: '💀 NUCLEAR KILL COMPLETED - EVERYTHING DESTROYED',
      destructionLog,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💀 [NUCLEAR KILL] CRITICAL FAILURE:', error);
    return NextResponse.json(
      { 
        error: '💀 NUCLEAR KILL FAILED', 
        details: error instanceof Error ? error.message : 'Unknown error',
        message: 'Some destruction may have occurred, but the operation failed to complete'
      },
      { status: 500 }
    );
  }
} 