import { supabase } from "@/integrations/supabase/client";

export interface Scan {
  id: string;
  domain: string;
  status: string;
  risk_score: number;
  urls_found: number;
  vulnerabilities_found: number;
  technologies: string[];
  raw_crawl_data: any;
  parsed_data: any;
  enrichment: any;
  ai_report: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Finding {
  id: string;
  scan_id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  details: any;
  created_at: string;
}

export async function evaluateDomain(domain: string): Promise<{ allowed: boolean; policy: string; reason: string }> {
  const { data, error } = await supabase.functions.invoke('evaluate-domain', {
    body: { domain },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function startScan(domain: string): Promise<{ scanId: string }> {
  const { data, error } = await supabase.functions.invoke('firecrawl-scan', {
    body: { domain },
  });

  if (error) {
    // Check for rate limiting
    if (error.message?.includes('Daily scan limit')) {
      throw new Error(error.message);
    }
    const recoveredScanId = error.message.match(/"scanId":"([a-f0-9-]+)"/i)?.[1];
    if (recoveredScanId) return { scanId: recoveredScanId };
    throw new Error(error.message);
  }

  if (data?.rateLimited) {
    throw new Error(data.error || 'Daily scan limit reached');
  }

  // If crawl failed but we have a scanId, return it so user can see the failed state
  if (data?.scanId) return { scanId: data.scanId };
  if (data?.error) throw new Error(data.error);
  return { scanId: data.scanId };
}

export async function getUserQuota(): Promise<{ scansToday: number; dailyLimit: number } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('scan_quotas')
    .select('scans_today, daily_limit, last_scan_date')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return { scansToday: 0, dailyLimit: 10 };

  const today = new Date().toISOString().split('T')[0];
  if (data.last_scan_date !== today) {
    return { scansToday: 0, dailyLimit: data.daily_limit };
  }

  return { scansToday: data.scans_today, dailyLimit: data.daily_limit };
}

export async function generateReport(scanId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('analyze-threats', {
    body: { scanId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.report;
}

export async function analyzeSurface(section: string, data: any, domain: string): Promise<string> {
  const { data: result, error } = await supabase.functions.invoke('analyze-surface', {
    body: { section, data, domain },
  });
  if (error) throw new Error(error.message);
  if (result?.error) throw new Error(result.error);
  return result.analysis;
}

export async function getScans(): Promise<Scan[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as Scan[];
}

export async function getScan(id: string): Promise<Scan> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as Scan;
}

export async function getFindings(scanId: string): Promise<Finding[]> {
  const { data, error } = await supabase
    .from('findings')
    .select('*')
    .eq('scan_id', scanId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as Finding[];
}

export async function deleteScan(id: string): Promise<void> {
  // Delete findings first (foreign key constraint)
  const { error: findingsError } = await supabase
    .from('findings')
    .delete()
    .eq('scan_id', id);
  if (findingsError) throw findingsError;

  const { error } = await supabase
    .from('scans')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
