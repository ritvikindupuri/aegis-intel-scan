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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { scanId, action } = await req.json();
    if (!scanId) {
      return new Response(JSON.stringify({ error: 'scanId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the scan to find user_id
    const { data: scan, error: scanErr } = await supabase
      .from('scans').select('*').eq('id', scanId).single();

    if (scanErr || !scan) {
      // For delete action, scan may already be gone from DB — just proceed with ES cleanup
      if (action === 'delete') {
        // Try to get user ES config from auth header
        const esConfig = await getUserEsConfigFromAuth(req, supabaseUrl, supabase);
        if (esConfig) {
          await deleteFromEs(esConfig, scanId);
          return new Response(JSON.stringify({ success: true, action: 'deleted' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ error: 'Scan not found and no ES config' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw scanErr || new Error('Scan not found');
    }

    // Look up user's Elasticsearch config
    const esConfig = await getUserEsConfig(supabase, scan.user_id);
    if (!esConfig) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No Elasticsearch configured for user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { esUrl, esAuth } = esConfig;

    // Handle delete action
    if (action === 'delete') {
      await deleteFromEs(esConfig, scanId);
      return new Response(JSON.stringify({ success: true, action: 'deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch findings
    const { data: findings } = await supabase
      .from('findings').select('*').eq('scan_id', scanId);

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

// Get ES config for a user from DB
async function getUserEsConfig(supabase: any, userId: string | null): Promise<{ esUrl: string; esAuth: string } | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_elasticsearch_config')
    .select('elasticsearch_url, elasticsearch_username, elasticsearch_password, enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data || !data.enabled) return null;

  return {
    esUrl: data.elasticsearch_url,
    esAuth: btoa(`${data.elasticsearch_username}:${data.elasticsearch_password}`),
  };
}

// Get ES config from auth header (for delete when scan is already gone)
async function getUserEsConfigFromAuth(req: Request, supabaseUrl: string, supabase: any): Promise<{ esUrl: string; esAuth: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;

  return getUserEsConfig(supabase, user.id);
}

// Delete scan data from Elasticsearch
async function deleteFromEs(esConfig: { esUrl: string; esAuth: string }, scanId: string) {
  const { esUrl, esAuth } = esConfig;

  // Delete the scan document
  try {
    await esRequest(esUrl, esAuth, `threatlens-scans/_doc/${scanId}`, 'DELETE');
  } catch (e) {
    console.warn('Failed to delete scan from ES (may not exist):', e);
  }

  // Delete all findings for this scan using delete_by_query
  try {
    await esRequest(esUrl, esAuth, `threatlens-findings/_delete_by_query`, 'POST', {
      query: { term: { scan_id: scanId } }
    });
  } catch (e) {
    console.warn('Failed to delete findings from ES:', e);
  }

  // Log deletion in audit
  try {
    await esRequest(esUrl, esAuth, `threatlens-audit/_doc`, 'POST', {
      event_type: 'scan_deleted',
      scan_id: scanId,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Failed to log deletion audit:', e);
  }
}

async function ensureIndex(esUrl: string, esAuth: string, index: string, mappings: any) {
  const resp = await fetch(`${esUrl}/${index}`, {
    method: 'HEAD',
    headers: { 'Authorization': `Basic ${esAuth}` },
  });
  if (resp.status === 404) {
    await esRequest(esUrl, esAuth, index, 'PUT', { mappings });
  }
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

  if (!resp.ok && resp.status !== 404) {
    console.error(`ES ${method} ${path} failed [${resp.status}]:`, text);
    throw new Error(`Elasticsearch request failed: ${resp.status}`);
  }

  try { return JSON.parse(text); } catch { return text; }
}