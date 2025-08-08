# Cleanup Strategy for Storage Management

This document describes the automatic cleanup systems in place to control storage costs and maintain a clean environment in the Runops application.

## Raw Video Cleanup

Raw uploaded videos are automatically deleted 24 hours after upload to:
1. Minimize storage costs
2. Enhance privacy by removing original recordings
3. Keep the storage bucket clean

### Implementation Details

The automatic cleanup is primarily implemented using a Supabase PostgreSQL function and `pg_cron` for scheduling. A GitHub Actions workflow provides a secondary method for manual or scheduled triggering.

1.  **Database Function `public.cleanup_raw_videos()`**:
    *   This PL/pgSQL function resides in the Supabase database.
    *   It identifies files in the `storage.objects` table within the `videos` bucket and `raw/` path that are older than 24 hours.
    *   It deletes these files directly from storage, preserving the `.placeholder` file.
    *   The function returns a table detailing which files were processed, deleted, or encountered errors.
    *   It uses `SECURITY DEFINER` to ensure it has the necessary permissions to access `storage.objects` and perform deletions.

2.  **`pg_cron` Scheduling**:
    *   The `pg_cron` PostgreSQL extension is used to schedule the `public.cleanup_raw_videos()` function.
    *   A cron job is configured to run the function daily at midnight UTC.
    *   This is the primary method for automated cleanup and runs entirely within the Supabase environment.

3.  **GitHub Actions Workflow (`.github/workflows/scheduled-cleanup.yml`)**:
    *   This workflow provides an alternative way to trigger the cleanup.
    *   It can be run manually from the GitHub Actions UI or on its own schedule (currently configured for daily at midnight UTC, serving as a backup or for manual intervention).
    *   It calls the `public.cleanup_raw_videos()` database function using the Supabase REST API (via `curl`).
    *   It requires `SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` (service role key) to be set as GitHub secrets.

## Scheduling Configuration

*   **Primary Scheduling (`pg_cron`)**: The `public.cleanup_raw_videos()` function is scheduled to run daily at `0 0 * * *` (midnight UTC) using `pg_cron` within the Supabase database.
    ```sql
    -- pg_cron schedule command (run once during setup)
    SELECT cron.schedule('cleanup-raw-videos', '0 0 * * *', 'SELECT public.cleanup_raw_videos()');
    ```

*   **Secondary/Manual Trigger (GitHub Actions)**: The workflow in `.github/workflows/scheduled-cleanup.yml` also runs daily at midnight UTC and can be manually triggered. It calls the database function via its REST endpoint.

## Manual Invocation

1.  **Via SQL (Directly in Supabase SQL Editor)**:
    ```sql
    SELECT * FROM public.cleanup_raw_videos();
    ```

2.  **Via GitHub Actions**:
    *   Go to the repository's "Actions" tab.
    *   Select the "Scheduled Cleanup" workflow.
    *   Click "Run workflow" and choose the `main` branch.

3.  **Via `curl` (if direct REST API call is needed, similar to GitHub Action)**:
    ```bash
    curl -X POST \
      "https://YOUR_PROJECT_ID.supabase.co/rest/v1/rpc/cleanup_raw_videos" \
      -H "apikey: YOUR_SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json"
    ```
    Replace `YOUR_PROJECT_ID` and `YOUR_SUPABASE_SERVICE_ROLE_KEY`.

## Storage Organization

The application uses the following storage structure in the `videos` bucket:

-   `/raw` - Original uploaded videos (cleaned up after 24 hours by the `cleanup_raw_videos` function).
-   `/slim` - Processed videos (1fps, 720p, CRF 32) - retained longer term.
-   `/sops` - Generated SOP JSON files (backup of database records).
-   `/transcripts` - Detailed video transcripts.

## Future Enhancements

Potential future enhancements to the cleanup strategy:

1.  Implementing lifecycle rules for `/slim`, `/sops`, and `/transcripts` if needed.
2.  Adding a user-controlled retention policy for SOPs and transcripts through the application UI.
3.  Providing a dashboard for storage usage monitoring and cleanup logs within the application.

## Troubleshooting

If files are not being properly cleaned up:

1.  **Check `pg_cron` Job Status**: Connect to your Supabase database and inspect `cron.job` and `cron.job_run_details` tables for errors related to the `cleanup-raw-videos` schedule.
    ```sql
    SELECT * FROM cron.job WHERE jobname = 'cleanup-raw-videos';
    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
    ```
2.  **Manually Run the Database Function**: Execute `SELECT * FROM public.cleanup_raw_videos();` in the Supabase SQL Editor to see if it runs correctly and what output it produces. Check for any SQL errors.
3.  **Check GitHub Actions Logs**: If relying on or testing with the GitHub Action, inspect the workflow run logs for errors in the `Run Database Cleanup Function` step. Ensure `SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` secrets are correctly set in GitHub repository settings.
4.  **Permissions**: Verify that the `postgres` role (or the role used by `pg_cron` and the REST API via service key) has the necessary permissions on `storage.objects`. The `SECURITY DEFINER` on the function should handle this, but it's worth checking if issues persist.
5.  **File Timestamps**: Ensure that files in the `raw/` folder actually have `created_at` timestamps older than the specified interval (24 hours by default). 