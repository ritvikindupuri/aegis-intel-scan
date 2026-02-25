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
    const { domain, scanId } = await req.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Domain is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create or use existing scan record
    let currentScanId = scanId;
    if (!currentScanId) {
      const { data: scan, error: insertErr } = await supabase
        .from('scans')
        .insert({ domain, status: 'crawling' })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      currentScanId = scan.id;
    } else {
      await supabase.from('scans').update({ status: 'crawling' }).eq('id', currentScanId);
    }

    // Format URL
    let targetUrl = domain.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    console.log('Starting Firecrawl scrape for:', targetUrl);

    // Scrape the main page
    const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false,
      }),
    });

    const scrapeData = await scrapeResp.json();

    if (!scrapeResp.ok) {
      console.error('Firecrawl scrape error:', scrapeData);
      await supabase.from('scans').update({
        status: 'failed',
        error_message: scrapeData.error || 'Firecrawl scrape failed',
      }).eq('id', currentScanId);
      return new Response(JSON.stringify({ success: false, scanId: currentScanId, error: scrapeData.error || 'Firecrawl scrape failed' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Map URLs from the site
    let mapData: any = { links: [] };
    try {
      const mapResp = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl, limit: 200 }),
      });
      if (mapResp.ok) {
        mapData = await mapResp.json();
      }
    } catch (e) {
      console.warn('Map failed, continuing with scrape data:', e);
    }

    // Parse the results
    const rawData = scrapeData.data || scrapeData;
    const html = rawData.html || '';
    const links = [...new Set([...(rawData.links || []), ...(mapData.links || [])])];
    const metadata = rawData.metadata || {};

    // Extract technologies from HTML
    const technologies = detectTechnologies(html);

    // Extract JS files
    const jsFiles = links.filter((l: string) => l.match(/\.(js|mjs|jsx|ts|tsx)(\?|$)/i));

    // Extract forms/inputs
    const forms = extractForms(html);

    // Extract external dependencies
    const externalDeps = links.filter((l: string) => {
      try {
        const u = new URL(l);
        const domainHost = new URL(targetUrl).hostname;
        return u.hostname !== domainHost;
      } catch { return false; }
    });

    // Extract endpoints (paths with query params or API-like patterns)
    const endpoints = links.filter((l: string) =>
      l.includes('?') || l.match(/\/(api|graphql|rest|v\d|admin|login|dashboard|wp-|config)/i)
    );

    // Security headers analysis
    const securityHeaders = analyzeSecurityFromMeta(metadata);

    const parsedData = {
      urls: links.slice(0, 500),
      jsFiles,
      externalDependencies: externalDeps.slice(0, 100),
      forms,
      endpoints: endpoints.slice(0, 100),
      metadata,
      securityHeaders,
    };

    // Generate enrichment data (simulated for WHOIS, ASN, etc.)
    const enrichment = generateEnrichment(domain, technologies, links.length);

    // Update scan with crawl results
    await supabase.from('scans').update({
      status: 'analyzing',
      raw_crawl_data: { scrape: rawData, map: mapData },
      parsed_data: parsedData,
      technologies,
      urls_found: links.length,
      enrichment,
    }).eq('id', currentScanId);

    // Generate findings
    const findings = generateFindings(parsedData, technologies, domain);

    if (findings.length > 0) {
      const findingsToInsert = findings.map(f => ({ ...f, scan_id: currentScanId }));
      await supabase.from('findings').insert(findingsToInsert);
    }

    // Calculate risk score
    const riskScore = calculateRiskScore(findings);

    await supabase.from('scans').update({
      status: 'completed',
      vulnerabilities_found: findings.length,
      risk_score: riskScore,
    }).eq('id', currentScanId);

    return new Response(JSON.stringify({
      success: true,
      scanId: currentScanId,
      urlsFound: links.length,
      findingsCount: findings.length,
      riskScore,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Scan error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function detectTechnologies(html: string): string[] {
  const techs: string[] = [];
  const patterns: Record<string, RegExp> = {
    'React': /react\.production|reactDOM|__NEXT_DATA__|_next\//i,
    'Next.js': /__NEXT_DATA__|_next\//i,
    'Vue.js': /vue\.js|vue\.min\.js|__vue__/i,
    'Angular': /ng-version|angular\.js|angular\.min\.js/i,
    'jQuery': /jquery\.js|jquery\.min\.js|jquery\//i,
    'WordPress': /wp-content|wp-includes|wordpress/i,
    'Bootstrap': /bootstrap\.css|bootstrap\.min\.css|bootstrap\.js/i,
    'Tailwind CSS': /tailwindcss|tailwind\.css/i,
    'Google Analytics': /google-analytics|googletagmanager|gtag/i,
    'Google Tag Manager': /googletagmanager\.com\/gtm/i,
    'Cloudflare': /cloudflare|cf-ray|__cf_bm/i,
    'Nginx': /nginx/i,
    'PHP': /\.php/i,
    'ASP.NET': /asp\.net|__VIEWSTATE|__EVENTVALIDATION/i,
    'Shopify': /shopify\.com|cdn\.shopify/i,
    'Wix': /wix\.com|parastorage\.com/i,
    'Squarespace': /squarespace\.com|sqsp\.net/i,
    'Drupal': /drupal\.js|drupal\.settings/i,
    'HubSpot': /hubspot\.com|hs-scripts/i,
    'Stripe': /stripe\.com|stripe\.js/i,
  };
  for (const [name, pattern] of Object.entries(patterns)) {
    if (pattern.test(html)) techs.push(name);
  }
  return techs;
}

function extractForms(html: string): Array<{ action: string; method: string; inputs: string[] }> {
  const forms: Array<{ action: string; method: string; inputs: string[] }> = [];
  const formRegex = /<form[^>]*action=["']?([^"'\s>]*)["']?[^>]*method=["']?([^"'\s>]*)["']?[^>]*>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = formRegex.exec(html)) !== null) {
    const inputRegex = /<input[^>]*name=["']?([^"'\s>]*)["']?/gi;
    const inputs: string[] = [];
    let inputMatch;
    while ((inputMatch = inputRegex.exec(match[3])) !== null) {
      inputs.push(inputMatch[1]);
    }
    forms.push({ action: match[1] || '', method: (match[2] || 'GET').toUpperCase(), inputs });
  }
  return forms.slice(0, 20);
}

function analyzeSecurityFromMeta(metadata: any): Record<string, string> {
  return {
    'Content-Security-Policy': metadata['content-security-policy'] || 'Not Set',
    'Strict-Transport-Security': metadata['strict-transport-security'] || 'Not Set',
    'X-Frame-Options': metadata['x-frame-options'] || 'Not Set',
    'X-Content-Type-Options': metadata['x-content-type-options'] || 'Not Set',
    'X-XSS-Protection': metadata['x-xss-protection'] || 'Not Set',
    'Referrer-Policy': metadata['referrer-policy'] || 'Not Set',
    'Permissions-Policy': metadata['permissions-policy'] || 'Not Set',
  };
}

function generateEnrichment(domain: string, technologies: string[], urlCount: number) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return {
    whois: {
      domain: cleanDomain,
      registrar: 'Simulated Registrar Inc.',
      createdDate: '2020-01-15',
      expiresDate: '2026-01-15',
      nameServers: [`ns1.${cleanDomain}`, `ns2.${cleanDomain}`],
    },
    hosting: {
      provider: technologies.includes('Cloudflare') ? 'Cloudflare' : 'AWS',
      asn: 'AS13335',
      country: 'US',
    },
    riskFactors: {
      hasLogin: technologies.some(t => ['WordPress', 'Shopify', 'Drupal'].includes(t)),
      isEcommerce: technologies.some(t => ['Shopify', 'Stripe', 'Wix'].includes(t)),
      usesCDN: technologies.includes('Cloudflare'),
      surfaceSize: urlCount > 100 ? 'large' : urlCount > 30 ? 'medium' : 'small',
    },
  };
}

function generateFindings(parsedData: any, technologies: string[], domain: string) {
  const findings: Array<{ title: string; description: string; severity: string; category: string; details: any }> = [];

  // Check security headers
  const headers = parsedData.securityHeaders || {};
  if (headers['Content-Security-Policy'] === 'Not Set') {
    findings.push({
      title: 'Missing Content-Security-Policy Header',
      description: 'The website does not implement a Content-Security-Policy header, making it vulnerable to XSS and data injection attacks.',
      severity: 'high',
      category: 'Security Headers',
      details: { header: 'Content-Security-Policy', recommendation: 'Implement a strict CSP policy' },
    });
  }
  if (headers['Strict-Transport-Security'] === 'Not Set') {
    findings.push({
      title: 'Missing HSTS Header',
      description: 'HTTP Strict Transport Security is not enabled, allowing potential downgrade attacks.',
      severity: 'medium',
      category: 'Security Headers',
      details: { header: 'Strict-Transport-Security', recommendation: 'Add HSTS with a minimum max-age of 31536000' },
    });
  }
  if (headers['X-Frame-Options'] === 'Not Set') {
    findings.push({
      title: 'Missing X-Frame-Options Header',
      description: 'The site can be embedded in iframes, potentially enabling clickjacking attacks.',
      severity: 'medium',
      category: 'Security Headers',
      details: { header: 'X-Frame-Options', recommendation: 'Set to DENY or SAMEORIGIN' },
    });
  }

  // Check for suspicious endpoints
  const sensitivePatterns = [
    { pattern: /\/(admin|wp-admin|administrator|panel|dashboard|cpanel)/i, title: 'Exposed Admin Panel', severity: 'high' },
    { pattern: /\/(config|\.env|\.git|backup|dump|sql)/i, title: 'Sensitive Path Exposed', severity: 'critical' },
    { pattern: /\/(phpmyadmin|adminer|phpinfo)/i, title: 'Database Admin Tool Exposed', severity: 'critical' },
  ];

  for (const url of (parsedData.urls || [])) {
    for (const sp of sensitivePatterns) {
      if (sp.pattern.test(url)) {
        findings.push({
          title: sp.title,
          description: `Potentially sensitive path detected: ${url}`,
          severity: sp.severity,
          category: 'Exposed Paths',
          details: { url, pattern: sp.pattern.source },
        });
        break;
      }
    }
  }

  // Check for suspicious query parameters
  const suspiciousParams = ['id', 'redirect', 'url', 'file', 'path', 'page', 'cmd', 'exec', 'query', 'search', 'callback'];
  for (const url of (parsedData.endpoints || [])) {
    try {
      const u = new URL(url);
      for (const param of suspiciousParams) {
        if (u.searchParams.has(param)) {
          findings.push({
            title: `Suspicious Parameter: ${param}`,
            description: `Query parameter "${param}" found at ${url} — may be susceptible to injection or open redirect.`,
            severity: param === 'redirect' || param === 'url' ? 'high' : 'medium',
            category: 'Injection Points',
            details: { url, parameter: param },
          });
        }
      }
    } catch {}
  }

  // Check forms for potential XSS
  for (const form of (parsedData.forms || [])) {
    if (form.inputs.some((i: string) => ['search', 'query', 'q', 'keyword', 'comment', 'message'].includes(i.toLowerCase()))) {
      findings.push({
        title: 'Potential XSS Input Point',
        description: `Form with text input fields detected (${form.inputs.join(', ')}). These may be vulnerable to XSS if not properly sanitized.`,
        severity: 'medium',
        category: 'XSS',
        details: { action: form.action, method: form.method, inputs: form.inputs },
      });
    }
  }

  // Check technologies for known risks
  if (technologies.includes('jQuery')) {
    findings.push({
      title: 'jQuery Detected',
      description: 'jQuery is present on the site. Older versions have known XSS vulnerabilities.',
      severity: 'low',
      category: 'Outdated Libraries',
      details: { technology: 'jQuery', recommendation: 'Verify jQuery version is up to date' },
    });
  }
  if (technologies.includes('WordPress')) {
    findings.push({
      title: 'WordPress CMS Detected',
      description: 'WordPress installations require regular updates and plugin maintenance to prevent known exploits.',
      severity: 'medium',
      category: 'CMS Risk',
      details: { technology: 'WordPress', recommendation: 'Ensure WordPress core, themes, and plugins are up to date' },
    });
  }

  // External dependency count
  const extDeps = parsedData.externalDependencies || [];
  if (extDeps.length > 10) {
    findings.push({
      title: 'High Number of External Dependencies',
      description: `${extDeps.length} external dependencies detected. Each introduces potential supply-chain risk.`,
      severity: 'low',
      category: 'Supply Chain',
      details: { count: extDeps.length, sample: extDeps.slice(0, 5) },
    });
  }

  return findings;
}

function calculateRiskScore(findings: any[]): number {
  let score = 0;
  for (const f of findings) {
    switch (f.severity) {
      case 'critical': score += 25; break;
      case 'high': score += 15; break;
      case 'medium': score += 8; break;
      case 'low': score += 3; break;
      case 'info': score += 1; break;
    }
  }
  return Math.min(100, score);
}
