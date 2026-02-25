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
    const { domain } = await req.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Domain is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    // 1. Check existing policy
    const { data: existingPolicy } = await supabase
      .from('domain_policies')
      .select('*')
      .eq('domain', cleanDomain)
      .maybeSingle();

    if (existingPolicy) {
      // Log the action
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

async function evaluateWithAI(domain: string): Promise<{ policy: string; reason: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const prompt = `You are a security policy AI agent for a threat intelligence platform called ThreatLens. Your job is to evaluate whether a domain should be allowed for security scanning.

RULES:
- ALLOW: Public websites, businesses, open-source projects, personal sites, SaaS products, news sites, educational institutions. These are legitimate targets for security assessment.
- BLOCK: Government military/intelligence domains (.mil, intelligence agencies), critical infrastructure (power grids, water systems), healthcare patient portals, financial institution core banking, domains that appear to be honeypots or law enforcement traps.
- REVIEW: Domains that are ambiguous — could be legitimate but also could be sensitive. Examples: small government agencies, private internal-looking domains, domains with suspicious TLDs.

Evaluate this domain: "${domain}"

Respond with ONLY valid JSON (no markdown):
{"policy": "allow" | "block" | "review", "reason": "one sentence explanation"}`;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('AI proxy error:', await response.text());
      // Default to review if AI fails
      return { policy: 'review', reason: 'AI evaluation unavailable — flagged for manual review.' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse AI response
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (['allow', 'block', 'review'].includes(parsed.policy)) {
        return { policy: parsed.policy, reason: parsed.reason || 'AI evaluated' };
      }
    }

    return { policy: 'review', reason: 'AI response unclear — flagged for manual review.' };
  } catch (e) {
    console.error('AI evaluation failed:', e);
    return { policy: 'review', reason: 'AI evaluation error — flagged for manual review.' };
  }
}
