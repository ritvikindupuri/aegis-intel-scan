import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { section, data, domain } = await req.json();

    if (!section || !data) {
      return new Response(JSON.stringify({ error: 'section and data are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let prompt = '';

    if (section === 'security_headers') {
      prompt = `You are a senior penetration tester analyzing security headers for "${domain}". Given the following HTTP security headers configuration, provide a concise threat intelligence assessment.

Headers:
${JSON.stringify(data, null, 2)}

For EACH header (both present and missing), provide:
1. **Header Name** — What it does in 1 sentence
2. **Status** — Present/Missing and current value if set
3. **Risk** — What attack vectors this enables if missing (be specific: mention attack names like clickjacking, MIME confusion, XSS, protocol downgrade)
4. **Remediation** — The exact header value to add, ready to copy-paste into server config

After individual headers, provide a brief "Overall Assessment" (2-3 sentences) rating the header security posture.

Keep it technical and actionable. Use markdown formatting. No fluff.`;
    } else if (section === 'endpoints') {
      const urls = (data as string[]).slice(0, 40);
      prompt = `You are a senior penetration tester analyzing discovered endpoints for "${domain}". Given the following discovered URLs/paths, provide a threat intelligence assessment of the attack surface.

Discovered Endpoints (${data.length} total, showing ${urls.length}):
${urls.join('\n')}

Provide:
1. **Endpoint Classification** — Group the endpoints by type (API routes, admin panels, auth endpoints, static assets, user-facing pages, etc.) with counts
2. **High-Risk Paths** — Identify any endpoints that suggest sensitive functionality (admin panels, debug endpoints, file upload paths, API endpoints without apparent auth, backup files, config files)
3. **Attack Surface Assessment** — Rate the overall endpoint exposure (Low/Medium/High) with reasoning
4. **Reconnaissance Insights** — What can an attacker infer about the application architecture, frameworks, and internal structure from these URLs?
5. **Recommended Actions** — Top 3-5 actionable steps to reduce endpoint exposure

Keep it technical and concise. Use markdown formatting.`;
    } else if (section === 'dependencies') {
      const deps = (data as string[]).slice(0, 30);
      prompt = `You are a senior penetration tester analyzing external dependencies for "${domain}". Given the following third-party resources loaded by the application, provide a supply chain risk assessment.

External Dependencies (${data.length} total, showing ${deps.length}):
${deps.join('\n')}

Provide:
1. **Dependency Classification** — Group by type (CDN libraries, analytics/tracking, advertising, fonts, social widgets, payment processors, etc.) with counts
2. **Supply Chain Risks** — Identify high-risk dependencies (e.g., resources loaded from unknown CDNs, outdated library versions, dependencies without SRI hashes)
3. **Privacy Concerns** — Which dependencies may be collecting user data or enabling cross-site tracking?
4. **Trust Assessment** — Rate each dependency source's trustworthiness (well-known CDN vs unknown third-party)
5. **Attack Scenarios** — How could a compromised dependency be leveraged? (e.g., Magecart-style attacks, cryptojacking injection, credential harvesting)
6. **Hardening Recommendations** — Top 3-5 steps to reduce supply chain risk (SRI, CSP, self-hosting critical libs, etc.)

Keep it technical and concise. Use markdown formatting.`;
    } else if (section === 'raw_data') {
      const rawStr = JSON.stringify(data, null, 2).slice(0, 12000);
      prompt = `You are a Principal Threat Intelligence Analyst reviewing raw crawl data for "${domain}". The raw data below was collected by an automated web crawler. Your job is to translate this into a clear, analyst-friendly briefing.

Raw Crawl Data (truncated):
${rawStr}

Produce a structured intelligence briefing with the following sections:

## Executive Summary
2-3 sentences summarizing what was found and the overall risk posture.

## Infrastructure Overview
- Hosting details, IP ranges, server software, CDN usage
- DNS configuration observations
- TLS/SSL configuration details if present

## Application Fingerprint
- Detected frameworks, CMS, languages, and libraries with versions
- Server-side vs client-side technology stack
- Authentication mechanisms observed

## Content & Data Exposure
- Types of content discovered (pages, APIs, documents, media)
- Any sensitive data patterns (emails, internal paths, API keys, tokens, debug info)
- Error pages or stack traces that reveal internal details

## Notable Observations
- Anything unusual, misconfigured, or high-risk spotted in the raw data
- Patterns that suggest development/staging environments
- Evidence of security controls (WAF, rate limiting, bot detection)

## Key Takeaways for the Analyst
- Top 3-5 most important findings from this data
- What to investigate further
- Priority actions

Keep it clear, professional, and actionable. Use markdown formatting. Avoid repeating raw data verbatim — interpret and contextualize it.`;
    } else if (section === 'surface_chat') {
      const question = data.question;
      const contextStr = JSON.stringify(data.data, null, 2).slice(0, 10000);
      prompt = `You are a Principal Cybersecurity Analyst. The analyst is reviewing the attack surface of "${domain}" and asks:

"${question}"

Here is the attack surface data (security headers, endpoints, technologies, JS files, forms, external dependencies):
${contextStr}

Answer the analyst's question directly using the data provided. Be specific, technical, and actionable. Reference OWASP/CWE/MITRE ATT&CK where relevant. Use markdown.`;
    } else if (section === 'findings_chat') {
      const question = data.question;
      const contextStr = JSON.stringify(data.data, null, 2).slice(0, 10000);
      prompt = `You are a Principal Cybersecurity Analyst. The analyst is reviewing security findings for "${domain}" and asks:

"${question}"

Here are the security findings:
${contextStr}

Answer the analyst's question directly. Prioritize by severity. Suggest remediation steps. Reference OWASP/CWE/MITRE ATT&CK where relevant. Use markdown.`;
    } else if (section === 'raw_data_chat') {
      const question = data.question;
      const contextStr = JSON.stringify(data.data, null, 2).slice(0, 12000);
      prompt = `You are a Principal Threat Intelligence Analyst. The analyst is reviewing raw crawl data for "${domain}" and asks:

"${question}"

Here is the raw crawl data (truncated):
${contextStr}

Answer the analyst's question directly using the raw data. Interpret and contextualize — don't repeat data verbatim. Be technical and actionable. Use markdown.`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid section' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a Principal Cybersecurity Analyst specializing in web application security, penetration testing, and threat intelligence. Provide precise, actionable analysis. Reference OWASP, CWE, and MITRE ATT&CK where relevant. Be concise but thorough.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResp.json();
    const analysis = aiData.choices?.[0]?.message?.content || 'Analysis failed.';

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Surface analysis error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
