import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Authenticate via API key
    const apiKeyHeader = req.headers.get('x-api-key');
    if (!apiKeyHeader) {
      return new Response(JSON.stringify({
        error: 'Missing x-api-key header. Generate an API key from the ThreatLens dashboard.',
        docs: '/api/v1 — Supported endpoints: POST /scan, GET /scan/:id, GET /scan/:id/findings',
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hash the key and look it up
    const keyHash = await hashApiKey(apiKeyHeader);
    const { data: keyRecord, error: keyErr } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .maybeSingle();

    if (keyErr || !keyRecord) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check expiry
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'API key has expired' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update last_used_at
    await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api-gateway\/?/, '');

    // Route: POST /scan — Start a new scan
    if (req.method === 'POST' && (path === 'scan' || path === '')) {
      if (!keyRecord.permissions.includes('scan:create')) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions: scan:create required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const domain = body.domain;
      if (!domain) {
        return new Response(JSON.stringify({ error: 'domain is required in request body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Call firecrawl-scan internally
      const scanResp = await fetch(`${supabaseUrl}/functions/v1/firecrawl-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ domain }),
      });

      const scanResult = await scanResp.json();

      return new Response(JSON.stringify({
        success: scanResult.success ?? false,
        scanId: scanResult.scanId,
        urlsFound: scanResult.urlsFound,
        findingsCount: scanResult.findingsCount,
        riskScore: scanResult.riskScore,
        error: scanResult.error,
      }), {
        status: scanResp.ok ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Route: GET /scan/:id — Get scan details
    const scanDetailMatch = path.match(/^scan\/([a-f0-9-]+)$/i);
    if (req.method === 'GET' && scanDetailMatch) {
      if (!keyRecord.permissions.includes('scan:read')) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions: scan:read required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const scanId = scanDetailMatch[1];
      const { data: scan, error: scanErr } = await supabase
        .from('scans')
        .select('id, domain, status, risk_score, urls_found, vulnerabilities_found, technologies, enrichment, error_message, created_at, updated_at')
        .eq('id', scanId)
        .single();

      if (scanErr || !scan) {
        return new Response(JSON.stringify({ error: 'Scan not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(scan), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Route: GET /scan/:id/findings — Get findings for a scan
    const findingsMatch = path.match(/^scan\/([a-f0-9-]+)\/findings$/i);
    if (req.method === 'GET' && findingsMatch) {
      if (!keyRecord.permissions.includes('findings:read')) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions: findings:read required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const scanId = findingsMatch[1];
      const { data: findings, error: findErr } = await supabase
        .from('findings')
        .select('id, title, description, severity, category, details, created_at')
        .eq('scan_id', scanId)
        .order('created_at', { ascending: false });

      if (findErr) {
        return new Response(JSON.stringify({ error: 'Failed to fetch findings' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ scanId, findings: findings || [], count: (findings || []).length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Route: GET /scans — List recent scans
    if (req.method === 'GET' && (path === 'scans' || path === '')) {
      if (!keyRecord.permissions.includes('scan:read')) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions: scan:read required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const limit = parseInt(url.searchParams.get('limit') || '20');
      const { data: scans, error: listErr } = await supabase
        .from('scans')
        .select('id, domain, status, risk_score, urls_found, vulnerabilities_found, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 100));

      if (listErr) {
        return new Response(JSON.stringify({ error: 'Failed to list scans' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ scans: scans || [], count: (scans || []).length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Unknown route
    return new Response(JSON.stringify({
      error: 'Unknown endpoint',
      endpoints: {
        'POST /scan': 'Start a new scan. Body: { "domain": "example.com" }',
        'GET /scan/:id': 'Get scan details by ID',
        'GET /scan/:id/findings': 'Get findings for a scan',
        'GET /scans': 'List recent scans (query: ?limit=20)',
      },
    }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API gateway error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}