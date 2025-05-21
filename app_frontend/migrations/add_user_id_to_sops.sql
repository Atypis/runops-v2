-- Add user_id column to sops table
ALTER TABLE public.sops ADD COLUMN IF NOT EXISTS user_id UUID;

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS sops_user_id_idx ON public.sops(user_id);

-- Create or update RLS policies to enforce user-based access
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;

-- Policy for selecting SOPs - users can only see their own
DROP POLICY IF EXISTS select_own_sops ON public.sops;
CREATE POLICY select_own_sops ON public.sops
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy for inserting SOPs - users can only insert with their own user_id
DROP POLICY IF EXISTS insert_own_sops ON public.sops;
CREATE POLICY insert_own_sops ON public.sops
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Policy for updating SOPs - users can only update their own
DROP POLICY IF EXISTS update_own_sops ON public.sops;
CREATE POLICY update_own_sops ON public.sops
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Policy for deleting SOPs - users can only delete their own
DROP POLICY IF EXISTS delete_own_sops ON public.sops;
CREATE POLICY delete_own_sops ON public.sops
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Allow service role to access all SOPs (for worker)
DROP POLICY IF EXISTS service_all_sops ON public.sops;
CREATE POLICY service_all_sops ON public.sops
    FOR ALL
    TO service_role
    USING (true); 