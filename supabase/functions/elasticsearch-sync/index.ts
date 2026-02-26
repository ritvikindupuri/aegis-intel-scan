import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const esUrl = Deno.env.get('ELASTICSEARCH_URL');
  const esUser = Deno.env.get('ELASTICSEARCH_USERNAME');
  const esPass = Deno.env.get('ELASTICSEARCH_PASSWORD');

  if (!esUrl || !esUser || !esPass) {
    return new Response(JSON.stringify({ error: 'Elasticsearch not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const esAuth = btoa(`${esUser}:${esPass}`);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { scanId } = await req.json();
    if (!scanId) {
      return new Response(JSON.stringify({ error: 'scanId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch scan and findings from DB
    const [{ data: scan, error: scanErr }, { data: findings, error: findErr }] = await Promise.all([
      supabase.from('scans').select('*').eq('id', scanId).single(),
      supabase.from('findings').select('*').eq('scan_id', scanId),
    ]);

    if (scanErr) throw scanErr;
    if (!scan) throw new Error('Scan not found');

    // Ensure indices exist with mappings
    await ensureIndex(esUrl, esAuth, 'threatlens-scans', {
      properties: {
        domain: { type: 'keyword' },
        status: { type: 'keyword' },
        risk_score: { type: 'integer' },
        urls_found: { type: 'integer' },
        vulnerabilities_found: { type: 'integer' },
        technologies: { type: 'keyword' },
        created_at: { type: 'date' },
        updated_at: { type: 'date' },
        user_id: { type: 'keyword' },
        ai_report: { type: 'text', analyzer: 'standard' },
      }
    });

    await ensureIndex(esUrl, esAuth, 'threatlens-findings', {
      properties: {
        scan_id: { type: 'keyword' },
        domain: { type: 'keyword' },
        title: { type: 'text', analyzer: 'standard', fields: { keyword: { type: 'keyword' } } },
        description: { type: 'text', analyzer: 'standard' },
        severity: { type: 'keyword' },
        category: { type: 'keyword' },
        details: { type: 'object', enabled: false },
        created_at: { type: 'date' },
      }
    });

    await ensureIndex(esUrl, esAuth, 'threatlens-audit', {
      properties: {
        event_type: { type: 'keyword' },
        domain: { type: 'keyword' },
        scan_id: { type: 'keyword' },
        user_id: { type: 'keyword' },
        risk_score: { type: 'integer' },
        findings_count: { type: 'integer' },
        technologies: { type: 'keyword' },
        timestamp: { type: 'date' },
      }
    });

    // Index the scan document
    await esRequest(esUrl, esAuth, `threatlens-scans/_doc/${scan.id}`, 'PUT', {
      domain: scan.domain,
      status: scan.status,
      risk_score: scan.risk_score,
      urls_found: scan.urls_found,
      vulnerabilities_found: scan.vulnerabilities_found,
      technologies: scan.technologies || [],
      created_at: scan.created_at,
      updated_at: scan.updated_at,
      user_id: scan.user_id,
      ai_report: scan.ai_report,
    });

    // Bulk index findings
    if (findings && findings.length > 0) {
      const bulkBody = findings.flatMap((f: any) => [
        { index: { _index: 'threatlens-findings', _id: f.id } },
        {
          scan_id: f.scan_id,
          domain: scan.domain,
          title: f.title,
          description: f.description,
          severity: f.severity,
          category: f.category,
          details: f.details,
          created_at: f.created_at,
        },
      ]);

      await esRequest(esUrl, esAuth, '_bulk', 'POST', bulkBody, true);
    }

    // Index audit log entry
    await esRequest(esUrl, esAuth, `threatlens-audit/_doc`, 'POST', {
      event_type: 'scan_completed',
      domain: scan.domain,
      scan_id: scan.id,
      user_id: scan.user_id,
      risk_score: scan.risk_score,
      findings_count: findings?.length || 0,
      technologies: scan.technologies || [],
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      indexed: {
        scan: 1,
        findings: findings?.length || 0,
        audit: 1,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Elasticsearch sync error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Sync failed'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function ensureIndex(esUrl: string, esAuth: string, index: string, mappings: any) {
  const resp = await fetch(`${esUrl}/${index}`, {
    method: 'HEAD',
    headers: { 'Authorization': `Basic ${esAuth}` },
  });
  if (resp.status === 404) {
    await esRequest(esUrl, esAuth, index, 'PUT', { mappings });
  }
  // Consume body if any
  try { await resp.text(); } catch {}
}

async function esRequest(esUrl: string, esAuth: string, path: string, method: string, body?: any, ndjson = false) {
  const headers: Record<string, string> = {
    'Authorization': `Basic ${esAuth}`,
  };

  let bodyStr: string | undefined;
  if (body) {
    if (ndjson) {
      headers['Content-Type'] = 'application/x-ndjson';
      bodyStr = (body as any[]).map(item => JSON.stringify(item)).join('\n') + '\n';
    } else {
      headers['Content-Type'] = 'application/json';
      bodyStr = JSON.stringify(body);
    }
  }

  const resp = await fetch(`${esUrl}/${path}`, { method, headers, body: bodyStr });
  const text = await resp.text();

  if (!resp.ok) {
    console.error(`ES ${method} ${path} failed [${resp.status}]:`, text);
    throw new Error(`Elasticsearch request failed: ${resp.status}`);
  }

  try { return JSON.parse(text); } catch { return text; }
}
