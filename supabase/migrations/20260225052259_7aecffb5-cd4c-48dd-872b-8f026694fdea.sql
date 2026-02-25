
-- Domain policies table: stores allowlist/blocklist/review entries
CREATE TABLE public.domain_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  policy_type TEXT NOT NULL DEFAULT 'review' CHECK (policy_type IN ('allow', 'block', 'review')),
  reason TEXT,
  ai_evaluated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint on domain to prevent duplicates
CREATE UNIQUE INDEX idx_domain_policies_domain ON public.domain_policies (domain);

-- Enable RLS
ALTER TABLE public.domain_policies ENABLE ROW LEVEL SECURITY;

-- Public read access (everyone can check if a domain is allowed)
CREATE POLICY "Anyone can read domain policies"
ON public.domain_policies FOR SELECT USING (true);

-- Public insert/update/delete (no auth in this app)
CREATE POLICY "Anyone can manage domain policies"
ON public.domain_policies FOR ALL USING (true) WITH CHECK (true);

-- Scan audit log for tracking all scan attempts
CREATE TABLE public.scan_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'blocked', 'flagged')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audit log"
ON public.scan_audit_log FOR SELECT USING (true);

CREATE POLICY "Anyone can insert audit log"
ON public.scan_audit_log FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_domain_policies_updated_at
BEFORE UPDATE ON public.domain_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
