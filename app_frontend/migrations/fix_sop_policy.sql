-- Update the select policy to also allow access to SOPs with NULL user_id
DROP POLICY IF EXISTS select_own_sops ON public.sops;
CREATE POLICY select_own_sops ON public.sops
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

-- Force a refresh of policies
ALTER TABLE public.sops DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY; 