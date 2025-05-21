# Cleanup Strategy for Storage Management

This document describes the automatic cleanup systems in place to control storage costs and maintain a clean environment in the Runops application.

## Raw Video Cleanup

Raw uploaded videos are automatically deleted 24 hours after upload to:
1. Minimize storage costs
2. Enhance privacy by removing original recordings
3. Keep the storage bucket clean

### Implementation Details

The automatic cleanup is implemented using Supabase Edge Functions:

1. The main cleanup function `cleanup-raw-videos`:
   - Identifies files in the `videos/raw/` folder that are older than 24 hours
   - Deletes those files while preserving the slim processed versions
   - Logs deletion activity for auditing purposes

2. The scheduler function `scheduled-cleanup`:
   - Runs on a scheduled basis (configured to run daily)
   - Triggers the `cleanup-raw-videos` function
   - Provides an extra layer of scheduling control
   - Enables manual triggering of scheduled tasks

## Scheduling Configuration

The cleanup process is scheduled to run daily at midnight using an external scheduler (e.g., GitHub Actions, cron.daily.co) that invokes the `scheduled-cleanup` Edge Function:

```bash
# Example scheduled invocation via cron job
0 0 * * * curl -X POST https://ypnnoivcybufgsrbzqkt.supabase.co/functions/v1/scheduled-cleanup \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET" \
  -H "Content-Type: application/json"
```

This approach provides flexibility while allowing the main cleanup logic to be maintained within the Supabase ecosystem.

## Edge Functions

### cleanup-raw-videos

The main function that handles file deletion:

- **Purpose**: Deletes raw videos older than 24 hours
- **Functionality**: 
  - Lists all files in the `videos/raw/` folder
  - Filters files older than 24 hours
  - Deletes eligible files while preserving the `.placeholder` file
  - Reports statistics on files deleted

### scheduled-cleanup

The scheduler function that can trigger cleanup tasks:

- **Purpose**: Provides a scheduling layer for cleanup operations
- **Functionality**:
  - Can be invoked by external scheduling services
  - Calls the main cleanup function with the proper authentication
  - Supports invoking multiple different cleanup functions if needed in the future
  - Logs scheduling events for monitoring

## Manual Invocation

The cleanup functions can be manually triggered using the following commands:

```bash
# Directly invoke the cleanup function
curl -X POST https://ypnnoivcybufgsrbzqkt.supabase.co/functions/v1/cleanup-raw-videos \
  -H "Authorization: Bearer YOUR_CLEANUP_SECRET"

# Invoke via the scheduler
curl -X POST https://ypnnoivcybufgsrbzqkt.supabase.co/functions/v1/scheduled-cleanup \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"function": "cleanup-raw-videos"}'
```

## Storage Organization

The application uses the following storage structure in the `videos` bucket:

- `/raw` - Original uploaded videos (cleaned up after 24 hours)
- `/slim` - Processed videos (1fps, 720p, CRF 32) - retained longer term
- `/sops` - Generated SOP JSON files (backup of database records)
- `/transcripts` - Detailed video transcripts

## Future Enhancements

Potential future enhancements to the cleanup strategy:

1. Implementing lifecycle rules for slim videos that haven't been accessed in 90+ days
2. Adding a user-controlled retention policy for SOPs and transcripts
3. Providing a dashboard for storage usage monitoring
4. Extending the scheduler to handle multiple different cleanup tasks with different schedules

## Troubleshooting

If files are not being properly cleaned up:

1. Check the Edge Function logs in the Supabase dashboard
2. Verify that the functions have the necessary permissions and environment variables
3. Ensure the scheduler is properly configured and running
4. Check that the necessary secrets are set in the Supabase environment:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLEANUP_FUNCTION_SECRET`
   - `SCHEDULER_SECRET`
5. Manually invoke the functions to test their operation 