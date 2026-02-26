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

// --- Scan Schedules ---

export interface ScanSchedule {
  id: string;
  domain: string;
  frequency: string;
  enabled: boolean;
  last_scan_id: string | null;
  last_run_at: string | null;
  next_run_at: string;
  created_at: string;
}

export async function getScanSchedules(): Promise<ScanSchedule[]> {
  const { data, error } = await supabase
    .from('scan_schedules')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as ScanSchedule[];
}

export async function createScanSchedule(domain: string, frequency: string): Promise<ScanSchedule> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const nextRun = calculateNextRun(frequency);

  const { data, error } = await supabase
    .from('scan_schedules')
    .insert({
      user_id: user.id,
      domain,
      frequency,
      next_run_at: nextRun.toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ScanSchedule;
}

export async function toggleSchedule(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('scan_schedules')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('scan_schedules')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly': return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'monthly': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

// --- API Keys ---

export interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  permissions: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export async function getApiKeys(): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, key_prefix, name, permissions, last_used_at, expires_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as ApiKey[];
}

export async function createApiKey(name: string): Promise<{ key: string; apiKey: ApiKey }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const rawKey = `tl_${generateRandomKey(32)}`;
  const keyPrefix = rawKey.slice(0, 7) + '...';
  const keyHash = await hashString(rawKey);

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
    })
    .select('id, key_prefix, name, permissions, last_used_at, expires_at, created_at')
    .single();
  if (error) throw error;

  return { key: rawKey, apiKey: data as unknown as ApiKey };
}

export async function deleteApiKey(id: string): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

function generateRandomKey(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (const v of values) {
    result += chars[v % chars.length];
  }
  return result;
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Elasticsearch Search ---

export interface ElasticSearchResult {
  id: string;
  index: string;
  score: number;
  source: Record<string, any>;
  highlight?: Record<string, string[]>;
}

export interface ElasticSearchResponse {
  total: number;
  hits: ElasticSearchResult[];
  aggregations?: Record<string, any>;
}

export async function searchElastic(
  query: string,
  options?: {
    index?: string;
    filters?: { severity?: string; category?: string; domain?: string; dateFrom?: string; dateTo?: string };
    size?: number;
    from?: number;
    aggs?: string[];
  }
): Promise<ElasticSearchResponse> {
  const { data, error } = await supabase.functions.invoke('elasticsearch-search', {
    body: { query, ...options },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function syncToElastic(scanId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('elasticsearch-sync', {
    body: { scanId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}