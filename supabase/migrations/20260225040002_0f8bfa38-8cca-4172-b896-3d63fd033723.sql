
-- Scans table
CREATE TABLE public.scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'crawling', 'analyzing', 'completed', 'failed')),
  risk_score INTEGER DEFAULT 0,
  urls_found INTEGER DEFAULT 0,
  vulnerabilities_found INTEGER DEFAULT 0,
  technologies JSONB DEFAULT '[]'::jsonb,
  raw_crawl_data JSONB DEFAULT '{}'::jsonb,
  parsed_data JSONB DEFAULT '{}'::jsonb,
  enrichment JSONB DEFAULT '{}'::jsonb,
  ai_report TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Findings table
CREATE TABLE public.findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  category TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth for this tool)
CREATE POLICY "Anyone can view scans" ON public.scans FOR SELECT USING (true);
CREATE POLICY "Anyone can create scans" ON public.scans FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update scans" ON public.scans FOR UPDATE USING (true);

CREATE POLICY "Anyone can view findings" ON public.findings FOR SELECT USING (true);
CREATE POLICY "Anyone can create findings" ON public.findings FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX idx_scans_domain ON public.scans(domain);
CREATE INDEX idx_scans_status ON public.scans(status);
CREATE INDEX idx_scans_created ON public.scans(created_at DESC);
CREATE INDEX idx_findings_scan ON public.findings(scan_id);
CREATE INDEX idx_findings_severity ON public.findings(severity);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_scans_updated_at
BEFORE UPDATE ON public.scans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
