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
    const { domain, verifyOwnership } = await req.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Domain is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    // DNS TXT ownership verification
    if (verifyOwnership) {
      const verified = await verifyDnsTxt(cleanDomain);
      if (verified) {
        // Store/update as verified-owner allow policy
        await supabase.from('domain_policies').upsert({
          domain: cleanDomain,
          policy_type: 'allow',
          reason: 'Domain ownership verified via DNS TXT record (threatlens-verify found).',
          ai_evaluated: false,
        }, { onConflict: 'domain' });

        await supabase.from('scan_audit_log').insert({
          domain: cleanDomain,
          action: 'approved',
          reason: 'DNS TXT ownership verification passed',
        });

        return new Response(JSON.stringify({
          allowed: true,
          policy: 'allow',
          reason: 'Domain ownership verified via DNS TXT record.',
          verified_owner: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({
          allowed: false,
          policy: 'review',
          reason: 'DNS TXT verification failed. Add a TXT record with value "threatlens-verify" to prove ownership.',
          verified_owner: false,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 1. Check existing policy
    const { data: existingPolicy } = await supabase
      .from('domain_policies')
      .select('*')
      .eq('domain', cleanDomain)
      .maybeSingle();

    if (existingPolicy) {
      await supabase.from('scan_audit_log').insert({
        domain: cleanDomain,
        action: existingPolicy.policy_type === 'allow' ? 'approved' : existingPolicy.policy_type === 'block' ? 'blocked' : 'flagged',
        reason: `Existing policy: ${existingPolicy.reason || existingPolicy.policy_type}`,
      });

      return new Response(JSON.stringify({
        allowed: existingPolicy.policy_type === 'allow',
        policy: existingPolicy.policy_type,
        reason: existingPolicy.reason || `Domain is on the ${existingPolicy.policy_type}list`,
        ai_evaluated: existingPolicy.ai_evaluated,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. AI evaluation for unknown domains
    const aiDecision = await evaluateWithAI(cleanDomain);

    // 3. Store the policy
    await supabase.from('domain_policies').insert({
      domain: cleanDomain,
      policy_type: aiDecision.policy,
      reason: aiDecision.reason,
      ai_evaluated: true,
    });

    // 4. Log the action
    await supabase.from('scan_audit_log').insert({
      domain: cleanDomain,
      action: aiDecision.policy === 'allow' ? 'approved' : aiDecision.policy === 'block' ? 'blocked' : 'flagged',
      reason: `AI evaluation: ${aiDecision.reason}`,
    });

    return new Response(JSON.stringify({
      allowed: aiDecision.policy === 'allow',
      policy: aiDecision.policy,
      reason: aiDecision.reason,
      ai_evaluated: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Domain evaluation error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Evaluation failed'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function verifyDnsTxt(domain: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`);
    if (!resp.ok) return false;
    const data = await resp.json();
    const answers = data.Answer || [];
    return answers.some((a: any) =>
      typeof a.data === 'string' && a.data.toLowerCase().includes('threatlens-verify')
    );
  } catch (e) {
    console.error('DNS TXT lookup failed:', e);
    return false;
  }
}

async function evaluateWithAI(domain: string): Promise<{ policy: string; reason: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return { policy: 'review', reason: 'AI evaluation is not configured (missing API key). This domain has been flagged for manual review — you can approve it on the Policies page to proceed with scanning.' };
  }

  const prompt = `You are a security policy AI agent for a threat intelligence platform called ThreatLens. Your job is to evaluate whether a domain should be allowed for security scanning.

RULES:
- ALLOW: Domains that are well-known test/demo targets (e.g. example.com, httpbin.org, testhtml5.vulnweb.com), open-source project sites, and educational/documentation sites.
- REVIEW: Commercial websites, SaaS products, businesses, news sites, personal sites, and any third-party domain the user likely does not own. These require explicit user confirmation that they have authorization. Also flag ambiguous domains — small government agencies, private internal-looking domains, domains with suspicious TLDs.
- BLOCK: Government military/intelligence domains (.mil, intelligence agencies), critical infrastructure (power grids, water systems), healthcare patient portals, financial institution core banking, domains that appear to be honeypots or law enforcement traps.

IMPORTANT: Most commercial/third-party websites should be "review", NOT "allow". Only well-known intentional test targets should be auto-allowed.

Evaluate this domain: "${domain}"

Respond with ONLY valid JSON (no markdown):
{"policy": "allow" | "block" | "review", "reason": "one sentence explanation"}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      const statusHint = response.status === 429 
        ? 'The AI evaluation service is temporarily rate-limited.' 
        : response.status === 402 
        ? 'AI evaluation credits have been exhausted.' 
        : `The AI evaluation service returned an error (HTTP ${response.status}).`;
      return { policy: 'review', reason: `${statusHint} This domain has been flagged for manual review — you can approve it on the Policies page to proceed with scanning.` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (['allow', 'block', 'review'].includes(parsed.policy)) {
        return { policy: parsed.policy, reason: parsed.reason || 'AI evaluated' };
      }
    }

    return { policy: 'review', reason: 'The AI returned an unparseable response for this domain. It has been flagged for manual review — you can approve it on the Policies page to proceed with scanning.' };
  } catch (e) {
    console.error('AI evaluation failed:', e);
    return { policy: 'review', reason: `AI evaluation encountered a network error. This domain has been flagged for manual review — you can approve it on the Policies page to proceed with scanning.` };
  }
}