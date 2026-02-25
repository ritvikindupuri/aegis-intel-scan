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
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return { scanId: data.scanId };
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
