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

  let currentScanId: string | undefined;

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

    // --- Per-user rate limiting ---
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    if (userId) {
      const today = new Date().toISOString().split('T')[0];

      // Get or create quota record
      const { data: quota } = await supabase
        .from('scan_quotas')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!quota) {
        // First scan ever — create quota record
        await supabase.from('scan_quotas').insert({
          user_id: userId,
          scans_today: 1,
          daily_limit: 10,
          last_scan_date: today,
        });
      } else {
        const quotaDate = quota.last_scan_date;
        if (quotaDate !== today) {
          // New day — reset counter
          await supabase.from('scan_quotas').update({
            scans_today: 1,
            last_scan_date: today,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId);
        } else {
          // Same day — check limit
          if (quota.scans_today >= quota.daily_limit) {
            return new Response(JSON.stringify({
              error: `Daily scan limit reached (${quota.daily_limit} scans/day). Your quota resets at midnight UTC.`,
              rateLimited: true,
              scansToday: quota.scans_today,
              dailyLimit: quota.daily_limit,
            }), {
              status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          // Increment counter
          await supabase.from('scan_quotas').update({
            scans_today: quota.scans_today + 1,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId);
        }
      }
    }

    // Create or use existing scan record
    currentScanId = scanId;
    if (!currentScanId) {
      const { data: scan, error: insertErr } = await supabase
        .from('scans')
        .insert({ domain, status: 'crawling', user_id: userId })
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

    // Scrape the main page (with retry for transient provider tunnel/proxy failures)
    const scrapeResult = await scrapeWithRetry(apiKey, targetUrl);
    const scrapeData = scrapeResult.data;

    if (!scrapeResult.ok) {
      console.error('Firecrawl scrape error:', scrapeData);
      await supabase.from('scans').update({
        status: 'failed',
        error_message: scrapeData?.error || 'Firecrawl scrape failed',
      }).eq('id', currentScanId);
      return new Response(JSON.stringify({
        success: false,
        scanId: currentScanId,
        error: scrapeData?.error || 'Firecrawl scrape failed',
      }), {
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
    const links = [...new Set([...(rawData.links || []), ...(mapData.links || [])])].sort();
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

    // Generate real enrichment data (RDAP + IP geolocation)
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const enrichment = await generateRealEnrichment(cleanDomain, technologies, links.length);

    // Update scan with crawl results
    await supabase.from('scans').update({
      status: 'analyzing',
      raw_crawl_data: { scrape: rawData, map: mapData },
      parsed_data: parsedData,
      technologies,
      urls_found: links.length,
      enrichment,
    }).eq('id', currentScanId);

    // Generate findings and deduplicate by title+category
    const rawFindings = generateFindings(parsedData, technologies, domain);

    // CVE lookup for detected technologies
    let cveFindings: typeof rawFindings = [];
    try {
      const cveResp = await fetch(`${supabaseUrl}/functions/v1/cve-lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ technologies }),
      });
      if (cveResp.ok) {
        const cveData = await cveResp.json();
        for (const cve of (cveData.cves || [])) {
          const severity = cve.severity === 'critical' ? 'critical' : cve.severity === 'high' ? 'high' : cve.severity === 'medium' ? 'medium' : 'low';
          cveFindings.push({
            title: `${cve.cveId}: ${cve.technology}`,
            description: cve.description.slice(0, 500),
            severity,
            category: 'Known CVEs',
            details: {
              cveId: cve.cveId,
              technology: cve.technology,
              cvssScore: cve.cvssScore,
              publishedDate: cve.publishedDate,
              references: cve.references,
            },
          });
        }
      }
    } catch (e) {
      console.warn('CVE lookup failed, continuing without CVE findings:', e);
    }

    const allFindings = [...rawFindings, ...cveFindings];
    const seen = new Set<string>();
    const findings = allFindings.filter(f => {
      const key = `${f.title}::${f.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

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

    if (currentScanId) {
      await supabase.from('scans').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Crawl failed',
      }).eq('id', currentScanId);

      return new Response(JSON.stringify({
        success: false,
        scanId: currentScanId,
        error: error instanceof Error ? error.message : 'Crawl failed',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function scrapeWithRetry(apiKey: string, targetUrl: string, maxAttempts = 2) {
  let lastStatus = 500;
  let lastData: any = { error: 'Unknown scrape error' };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let scrapeResp: Response;

    try {
      scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
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
    } catch (fetchError) {
      lastStatus = 503;
      lastData = { error: fetchError instanceof Error ? fetchError.message : 'Network error calling crawl provider' };

      if (attempt === maxAttempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
      continue;
    }

    let scrapeData: any;
    try {
      scrapeData = await scrapeResp.json();
    } catch {
      scrapeData = { error: 'Invalid response from crawl provider' };
    }

    if (scrapeResp.ok) {
      return { ok: true, status: scrapeResp.status, data: scrapeData };
    }

    lastStatus = scrapeResp.status;
    lastData = scrapeData;

    const message = `${scrapeData?.error || ''} ${scrapeData?.code || ''}`.toLowerCase();
    const isRetryable =
      message.includes('err_tunnel_connection_failed') ||
      message.includes('proxy error') ||
      message.includes('timed out') ||
      message.includes('temporarily unavailable');

    if (!isRetryable || attempt === maxAttempts) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return { ok: false, status: lastStatus, data: lastData };
}

// --- Real enrichment using RDAP + ip-api.com ---

async function generateRealEnrichment(domain: string, technologies: string[], urlCount: number) {
  const [whois, hosting] = await Promise.all([
    fetchRdapWhois(domain),
    fetchIpGeolocation(domain),
  ]);

  return {
    whois,
    hosting,
    riskFactors: {
      hasLogin: technologies.some(t => ['WordPress', 'Shopify', 'Drupal'].includes(t)),
      isEcommerce: technologies.some(t => ['Shopify', 'Stripe', 'Wix'].includes(t)),
      usesCDN: technologies.includes('Cloudflare'),
      surfaceSize: urlCount > 100 ? 'large' : urlCount > 30 ? 'medium' : 'small',
    },
  };
}

async function fetchRdapWhois(domain: string): Promise<Record<string, any>> {
  try {
    // Use RDAP (Registration Data Access Protocol) — the modern replacement for WHOIS
    const resp = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { 'Accept': 'application/rdap+json' },
    });

    if (!resp.ok) {
      console.warn('RDAP lookup failed:', resp.status);
      return { domain, error: `RDAP lookup failed (HTTP ${resp.status})`, source: 'rdap' };
    }

    const data = await resp.json();

    // Extract registrar
    const registrarEntity = (data.entities || []).find((e: any) =>
      (e.roles || []).includes('registrar')
    );
    const registrar = registrarEntity?.vcardArray?.[1]?.find(
      (v: any) => v[0] === 'fn'
    )?.[3] || registrarEntity?.handle || 'Unknown';

    // Extract dates from events
    const events = data.events || [];
    const registrationEvent = events.find((e: any) => e.eventAction === 'registration');
    const expirationEvent = events.find((e: any) => e.eventAction === 'expiration');
    const lastChangedEvent = events.find((e: any) => e.eventAction === 'last changed');

    // Extract nameservers
    const nameservers = (data.nameservers || []).map((ns: any) => ns.ldhName || ns.handle).filter(Boolean);

    // Extract status flags
    const status = data.status || [];

    return {
      domain: data.ldhName || domain,
      registrar,
      createdDate: registrationEvent?.eventDate || null,
      expiresDate: expirationEvent?.eventDate || null,
      lastChanged: lastChangedEvent?.eventDate || null,
      nameServers: nameservers,
      status,
      source: 'rdap',
    };
  } catch (e) {
    console.error('RDAP lookup error:', e);
    return { domain, error: 'RDAP lookup failed', source: 'rdap' };
  }
}

async function fetchIpGeolocation(domain: string): Promise<Record<string, any>> {
  try {
    // First resolve domain to IP, then get geolocation
    // ip-api.com accepts domain names directly
    const resp = await fetch(`http://ip-api.com/json/${encodeURIComponent(domain)}?fields=status,message,country,countryCode,region,city,zip,lat,lon,isp,org,as,asname,query`);

    if (!resp.ok) {
      console.warn('IP geolocation lookup failed:', resp.status);
      return { error: `Geolocation lookup failed (HTTP ${resp.status})`, source: 'ip-api' };
    }

    const data = await resp.json();

    if (data.status === 'fail') {
      return { error: data.message || 'Geolocation lookup failed', source: 'ip-api' };
    }

    return {
      ip: data.query,
      provider: data.isp || data.org || 'Unknown',
      organization: data.org || null,
      asn: data.as || null,
      asnName: data.asname || null,
      country: data.country || null,
      countryCode: data.countryCode || null,
      region: data.region || null,
      city: data.city || null,
      source: 'ip-api',
    };
  } catch (e) {
    console.error('IP geolocation error:', e);
    return { error: 'Geolocation lookup failed', source: 'ip-api' };
  }
}

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