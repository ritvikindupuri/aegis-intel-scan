
-- Table to store per-user Elasticsearch cluster configuration
CREATE TABLE public.user_elasticsearch_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  elasticsearch_url TEXT NOT NULL,
  elasticsearch_username TEXT NOT NULL,
  elasticsearch_password TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_elasticsearch_config ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own config
CREATE POLICY "Users can view their own ES config"
  ON public.user_elasticsearch_config
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ES config"
  ON public.user_elasticsearch_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ES config"
  ON public.user_elasticsearch_config
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ES config"
  ON public.user_elasticsearch_config
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_elasticsearch_config_updated_at
  BEFORE UPDATE ON public.user_elasticsearch_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
