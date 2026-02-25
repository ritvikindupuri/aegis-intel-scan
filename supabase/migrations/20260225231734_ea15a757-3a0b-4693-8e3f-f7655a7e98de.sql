
-- Replace overly permissive service role policies with proper ones
DROP POLICY IF EXISTS "Service role can manage scans" ON public.scans;
DROP POLICY IF EXISTS "Service role can manage findings" ON public.findings;

-- For edge functions: allow insert/update when user_id is null (service context) 
-- This is needed because edge functions use service_role key which bypasses RLS anyway
-- So we can safely remove these policies - service_role bypasses RLS by default
