-- Create scan_quotas table for per-user rate limiting
CREATE TABLE public.scan_quotas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scans_today INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL DEFAULT 10,
  last_scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.scan_quotas ENABLE ROW LEVEL SECURITY;

-- Users can read their own quota
CREATE POLICY "Users can read their own quota"
ON public.scan_quotas
FOR SELECT
USING (auth.uid() = user_id);

-- Edge functions (service role) handle inserts/updates, but users can see their own
CREATE POLICY "Service role manages quotas"
ON public.scan_quotas
FOR ALL
USING (true)
WITH CHECK (true);