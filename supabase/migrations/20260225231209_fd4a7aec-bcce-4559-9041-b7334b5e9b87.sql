
-- Add user_id to scans
ALTER TABLE public.scans ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to domain_policies
ALTER TABLE public.domain_policies ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to scan_audit_log
ALTER TABLE public.scan_audit_log ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old permissive policies on scans
DROP POLICY IF EXISTS "Anyone can create scans" ON public.scans;
DROP POLICY IF EXISTS "Anyone can update scans" ON public.scans;
DROP POLICY IF EXISTS "Anyone can view scans" ON public.scans;

-- New scans policies scoped to user
CREATE POLICY "Users can view their own scans" ON public.scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own scans" ON public.scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own scans" ON public.scans FOR UPDATE USING (auth.uid() = user_id);

-- Drop old permissive policies on findings
DROP POLICY IF EXISTS "Anyone can create findings" ON public.findings;
DROP POLICY IF EXISTS "Anyone can view findings" ON public.findings;

-- Findings scoped via scan ownership
CREATE POLICY "Users can view their own findings" ON public.findings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.scans WHERE scans.id = findings.scan_id AND scans.user_id = auth.uid())
);
CREATE POLICY "Users can create findings for their scans" ON public.findings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.scans WHERE scans.id = findings.scan_id AND scans.user_id = auth.uid())
);

-- Drop old permissive policies on domain_policies
DROP POLICY IF EXISTS "Anyone can manage domain policies" ON public.domain_policies;
DROP POLICY IF EXISTS "Anyone can read domain policies" ON public.domain_policies;

-- New domain_policies scoped to user
CREATE POLICY "Users can view their own domain policies" ON public.domain_policies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own domain policies" ON public.domain_policies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Drop old permissive policies on scan_audit_log
DROP POLICY IF EXISTS "Anyone can insert audit log" ON public.scan_audit_log;
DROP POLICY IF EXISTS "Anyone can read audit log" ON public.scan_audit_log;

-- New audit log scoped to user
CREATE POLICY "Users can view their own audit log" ON public.scan_audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own audit log" ON public.scan_audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Also need service role access for edge functions that create scans/findings
CREATE POLICY "Service role can manage scans" ON public.scans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage findings" ON public.findings FOR ALL USING (true) WITH CHECK (true);
