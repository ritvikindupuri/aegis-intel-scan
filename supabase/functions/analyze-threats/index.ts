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

  try {
    const { scanId } = await req.json();
    if (!scanId) {
      return new Response(JSON.stringify({ error: 'scanId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch scan and findings
    const { data: scan } = await supabase.from('scans').select('*').eq('id', scanId).single();
    if (!scan) {
      return new Response(JSON.stringify({ error: 'Scan not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: findings } = await supabase.from('findings').select('*').eq('scan_id', scanId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build AI prompt
    const severityCounts: Record<string, number> = {};
    for (const f of (findings || [])) {
      severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
    }

    const prompt = `You are a senior cybersecurity analyst. Generate a professional threat intelligence report for the domain "${scan.domain}".

Scan Data:
- URLs discovered: ${scan.urls_found}
- Technologies: ${(scan.technologies || []).join(', ') || 'None detected'}
- Risk Score: ${scan.risk_score}/100
- Findings: ${JSON.stringify(severityCounts)}
- Enrichment: ${JSON.stringify(scan.enrichment)}

Findings Detail:
${(findings || []).map((f: any) => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join('\n')}

Security Headers:
${JSON.stringify(scan.parsed_data?.securityHeaders || {}, null, 2)}

Generate a report with these sections using markdown:
## Executive Summary
Brief overview of the security posture.

## Risk Assessment
Overall risk level with justification.

## Key Findings
Top vulnerabilities by severity with impact analysis.

## Attack Surface Analysis
Summary of the exposed surface area.

## Technology Stack Assessment
Security implications of detected technologies.

## Recommendations
Prioritized remediation steps (immediate, short-term, long-term).

## Conclusion
Final assessment and next steps.

Be specific, actionable, and reference the actual findings. Use professional security terminology.`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a cybersecurity expert generating threat intelligence reports. Be thorough, professional, and actionable.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('AI error:', aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResp.json();
    const report = aiData.choices?.[0]?.message?.content || 'Report generation failed.';

    // Save report
    await supabase.from('scans').update({ ai_report: report }).eq('id', scanId);

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analyze error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
