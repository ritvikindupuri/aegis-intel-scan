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

    // Build comprehensive data for the prompt
    const severityCounts: Record<string, number> = {};
    for (const f of (findings || [])) {
      severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
    }

    const categoryCounts: Record<string, number> = {};
    for (const f of (findings || [])) {
      categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
    }

    const parsedData = scan.parsed_data || {};
    const enrichment = scan.enrichment || {};
    const scanDate = new Date(scan.created_at).toISOString().split('T')[0];

    const prompt = `You are a Principal Cybersecurity Analyst at a Fortune 500 security consulting firm. Generate a comprehensive, enterprise-grade Threat Intelligence & Vulnerability Assessment Report for the domain "${scan.domain}".

This report will be delivered to C-suite executives and security teams. It must be thorough, professional, and actionable.

=== SCAN METADATA ===
- Target Domain: ${scan.domain}
- Scan Date: ${scanDate}
- Report ID: TL-${scanId.substring(0, 8).toUpperCase()}
- URLs Discovered: ${scan.urls_found}
- Total Findings: ${(findings || []).length}
- Risk Score: ${scan.risk_score}/100
- Severity Breakdown: ${JSON.stringify(severityCounts)}
- Category Breakdown: ${JSON.stringify(categoryCounts)}

=== TECHNOLOGY STACK ===
${(scan.technologies || []).join(', ') || 'No technologies detected'}

=== DOMAIN ENRICHMENT DATA ===
- Registrar: ${enrichment.whois?.registrar || 'Unknown'}
- Registration Date: ${enrichment.whois?.createdDate || 'Unknown'}
- Expiry Date: ${enrichment.whois?.expiresDate || 'Unknown'}
- Hosting Provider: ${enrichment.hosting?.provider || 'Unknown'}
- ASN: ${enrichment.hosting?.asn || 'Unknown'}
- Country: ${enrichment.hosting?.country || 'Unknown'}
- Attack Surface Size: ${enrichment.riskFactors?.surfaceSize || 'Unknown'}
- Has Login Functionality: ${enrichment.riskFactors?.hasLogin || false}
- Is E-commerce: ${enrichment.riskFactors?.isEcommerce || false}
- Uses CDN: ${enrichment.riskFactors?.usesCDN || false}

=== SECURITY HEADERS ANALYSIS ===
${JSON.stringify(parsedData.securityHeaders || {}, null, 2)}

=== DETAILED FINDINGS ===
${(findings || []).map((f: any, i: number) => `
Finding #${i + 1}:
  Severity: ${f.severity.toUpperCase()}
  Category: ${f.category}
  Title: ${f.title}
  Description: ${f.description}
  Technical Details: ${JSON.stringify(f.details || {})}
`).join('\n')}

=== ATTACK SURFACE DATA ===
- Total Endpoints: ${(parsedData.endpoints || []).length}
- External Dependencies: ${(parsedData.externalDependencies || []).length}
- JavaScript Files: ${(parsedData.jsFiles || []).length}
- Forms Detected: ${(parsedData.forms || []).length}
- Sample Endpoints: ${(parsedData.endpoints || []).slice(0, 10).join(', ')}
- Sample External Deps: ${(parsedData.externalDependencies || []).slice(0, 10).join(', ')}

=== REPORT FORMAT ===
Generate the report using markdown with the following structure. Be extremely detailed and specific to the actual findings. Reference CVE numbers where applicable. Include CVSS scores where relevant.

## 1. Executive Summary
Write a 3-4 paragraph executive summary suitable for C-suite stakeholders. Include the overall security posture rating (Critical/High/Medium/Low), key risk metrics, and business impact assessment. Mention the report ID and scan date.

## 2. Scope & Methodology
Describe what was scanned, the methodology used (automated reconnaissance, passive enumeration, technology fingerprinting, security header analysis), and any limitations.

## 3. Risk Assessment Overview
### 3.1 Overall Risk Rating
Provide the risk score (${scan.risk_score}/100) with a detailed justification. Map to a qualitative scale.

### 3.2 Risk Matrix
Create a text-based risk matrix showing findings by severity and category.

### 3.3 Threat Landscape Context
Contextualize the findings against current threat landscape and industry benchmarks.

## 4. Critical & High-Severity Findings
For each critical/high finding, provide:
- **Finding ID** (e.g., TL-001)
- **Severity & CVSS Score** (estimate)
- **Affected Component**
- **Description** (detailed technical explanation)
- **Evidence** (specific data from the scan)
- **Business Impact** (what could go wrong)
- **Remediation** (specific, actionable steps with priority)
- **References** (OWASP, CWE, NIST references)

## 5. Medium & Low-Severity Findings
Summarize medium and low findings in a structured table format with finding ID, title, severity, category, and recommended action.

## 6. Attack Surface Analysis
### 6.1 Endpoint Inventory
Analyze the discovered endpoints, highlighting sensitive or high-risk paths.

### 6.2 Technology Stack Assessment
Evaluate each detected technology for known vulnerabilities, end-of-life status, and security implications. Reference specific CVEs where applicable.

### 6.3 Third-Party Dependencies
Assess supply chain risk from external dependencies.

### 6.4 Form & Input Analysis
Evaluate discovered forms for injection risks (XSS, SQLi, CSRF).

## 7. Security Headers Assessment
Provide a detailed analysis of each security header (present and missing), with specific configuration recommendations and their security impact.

## 8. Infrastructure & Hosting Analysis
Analyze the hosting environment, CDN usage, DNS configuration, and certificate details for security implications.

## 9. Remediation Roadmap
### 9.1 Immediate Actions (0-48 hours)
Critical fixes that should be implemented immediately.

### 9.2 Short-Term Actions (1-2 weeks)
High-priority improvements.

### 9.3 Medium-Term Actions (1-3 months)
Strategic security enhancements.

### 9.4 Long-Term Strategy (3-12 months)
Ongoing security program recommendations.

## 10. Compliance Considerations
Brief assessment of potential compliance implications (GDPR, PCI-DSS, SOC 2, OWASP Top 10) based on the findings.

## 11. Conclusion
Final assessment with overall risk rating, key takeaways, and recommended next steps for the security team.

---
*Report generated by ThreatLens Automated Threat Intelligence Platform*
*Classification: CONFIDENTIAL — For authorized personnel only*
*Report ID: TL-${scanId.substring(0, 8).toUpperCase()} | Date: ${scanDate}*

Be extremely thorough. This should read like a real penetration test report from a professional cybersecurity firm. Use proper security terminology, reference real frameworks (OWASP, NIST, CWE), and provide specific, actionable guidance.`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        temperature: 0,
        messages: [
          { role: 'system', content: 'You are a Principal Cybersecurity Analyst at a Fortune 500 security consulting firm. You produce enterprise-grade threat intelligence reports that meet the standards of firms like CrowdStrike, Mandiant, and Recorded Future. Your reports are thorough, technically precise, and actionable. Always reference real security frameworks (OWASP, NIST, CWE, MITRE ATT&CK) and provide specific CVE references where applicable.' },
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
