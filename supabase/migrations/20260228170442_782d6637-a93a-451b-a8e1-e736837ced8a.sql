
-- Ground truth table for benchmarking AI domain policy evaluations
CREATE TABLE public.policy_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  ai_policy TEXT NOT NULL, -- what the AI decided: allow/block/review
  ground_truth TEXT, -- analyst-verified correct decision: allow/block/review (NULL = not yet verified)
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.policy_benchmarks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view benchmarks (shared metrics)
CREATE POLICY "Authenticated users can view benchmarks"
ON public.policy_benchmarks
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert benchmarks
CREATE POLICY "Authenticated users can insert benchmarks"
ON public.policy_benchmarks
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update benchmarks they verified
CREATE POLICY "Users can update their benchmarks"
ON public.policy_benchmarks
FOR UPDATE
USING (auth.uid() = verified_by OR verified_by IS NULL);

-- Users can delete their benchmarks
CREATE POLICY "Users can delete their benchmarks"
ON public.policy_benchmarks
FOR DELETE
USING (auth.uid() = verified_by);

-- Index for metrics queries
CREATE INDEX idx_policy_benchmarks_ground_truth ON public.policy_benchmarks(ground_truth) WHERE ground_truth IS NOT NULL;
