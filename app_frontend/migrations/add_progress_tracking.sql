-- Add progress tracking columns to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS progress_stage VARCHAR(50),
ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0;

-- Create index on progress fields for faster queries
CREATE INDEX IF NOT EXISTS jobs_progress_stage_idx ON public.jobs(progress_stage);
CREATE INDEX IF NOT EXISTS jobs_progress_percent_idx ON public.jobs(progress_percent);

-- Update existing completed jobs to have 100% progress
UPDATE public.jobs 
SET progress_stage = 'completed', progress_percent = 100 
WHERE status = 'completed' AND progress_stage IS NULL;

-- Update existing queued jobs to have 0% progress
UPDATE public.jobs 
SET progress_stage = 'queued', progress_percent = 0 
WHERE status = 'queued' AND progress_stage IS NULL;

-- Update existing processing jobs to have initial progress
UPDATE public.jobs 
SET progress_stage = 'processing', progress_percent = 25 
WHERE status = 'processing' AND progress_stage IS NULL;

-- Update existing error jobs to keep their stage as null
-- (no update needed, they'll remain null) 