# ThreatLens — Technical Documentation

### Comprehensive Technical Reference

**By: Ritvik Induopuri**
**Date: February 25, 2026**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Deep Dive](#2-system-architecture-deep-dive)
   - 2.1 [High-Level Data Flow](#21-high-level-data-flow)
   - 2.2 [Component Architecture](#22-component-architecture)
   - 2.3 [Routing & Protected Routes](#23-routing--protected-routes)
3. [Database Schema](#3-database-schema)
   - 3.1 [scans Table](#31-scans-table)
   - 3.2 [findings Table](#32-findings-table)
   - 3.3 [profiles Table](#33-profiles-table)
   - 3.4 [domain_policies Table](#34-domain_policies-table)
   - 3.5 [scan_audit_log Table](#35-scan_audit_log-table)
4. [Edge Functions (Backend)](#4-edge-functions-backend)
   - 4.1 [Firecrawl Scan Pipeline](#41-firecrawl-scan-pipeline)
   - 4.2 [AI Threat Report Generator](#42-ai-threat-report-generator)
   - 4.3 [AI Surface Analyst (Chatbot & Insights)](#43-ai-surface-analyst-chatbot--insights)
   - 4.4 [AI Domain Policy Agent](#44-ai-domain-policy-agent)
5. [Firecrawl Web Scraping Process](#5-firecrawl-web-scraping-process)
   - 5.1 [Scraping Flow Diagram](#51-scraping-flow-diagram)
   - 5.2 [Data Extraction Details](#52-data-extraction-details)
6. [AI Integration](#6-ai-integration)
   - 6.1 [Models Used](#61-models-used)
   - 6.2 [AI Gateway Integration](#62-ai-gateway-integration)
   - 6.3 [AI Proxy Integration (Domain Policy)](#63-ai-proxy-integration-domain-policy)
7. [Frontend Components](#7-frontend-components)
   - 7.1 [Pages](#71-pages)
   - 7.2 [Core Components](#72-core-components)
   - 7.3 [UI Component Library](#73-ui-component-library)
8. [Authentication System](#8-authentication-system)
   - 8.1 [Auth Flow Diagram](#81-auth-flow-diagram)
   - 8.2 [Session Management](#82-session-management)
9. [Risk Scoring Algorithm](#9-risk-scoring-algorithm)
10. [PDF Export Engine](#10-pdf-export-engine)
11. [Design System & Styling](#11-design-system--styling)
    - 11.1 [CSS Token Architecture](#111-css-token-architecture)
    - 11.2 [Custom Utilities](#112-custom-utilities)
    - 11.3 [Typography](#113-typography)
12. [Security Architecture](#12-security-architecture)
13. [API Layer](#13-api-layer)
14. [Conclusion](#14-conclusion)

---

## 1. Executive Summary

ThreatLens is a full-stack cybersecurity platform that automates the process of domain reconnaissance, vulnerability detection, and threat intelligence reporting. The system ingests a target domain, crawls it using the Firecrawl API, parses the results for security-relevant data (endpoints, scripts, forms, headers, technologies), generates findings with severity ratings, calculates a composite risk score, and provides AI-powered analysis through both automated reports and an interactive chatbot.

The platform is designed with three core principles:
1. **Automation** — Minimize manual effort in security assessment
2. **Intelligence** — Leverage AI models for context-aware analysis
3. **Responsibility** — Prevent misuse via an AI domain policy gatekeeper

---

## 2. System Architecture Deep Dive

### 2.1 High-Level Data Flow

```
User enters domain
        |
        v
[evaluate-domain] -- AI Policy Check (Gemini Flash Lite)
        |
   allowed? ----NO----> Block/Review (show reason to user)
        |
       YES
        |
        v
[firecrawl-scan] -- Orchestration Edge Function
        |
        +---> Firecrawl API /v1/scrape (HTML + links + metadata)
        +---> Firecrawl API /v1/map (site map, up to 200 URLs)
        |
        v
    Parse Results
        |
        +---> Extract endpoints, JS files, forms, external deps
        +---> Detect technologies (regex pattern matching)
        +---> Analyze security headers from metadata
        +---> Generate enrichment data (WHOIS, hosting, risk factors)
        |
        v
    Generate Findings
        |
        +---> Security header gaps
        +---> Sensitive path detection
        +---> Suspicious query parameters
        +---> XSS input point identification
        +---> Technology risk assessment
        +---> Supply chain analysis
        |
        v
    Calculate Risk Score (0-100)
        |
        v
    Store in PostgreSQL (scans + findings tables)
        |
        v
    Display in Scan Detail UI (auto-polls every 3s until complete)
        |
        +---> [analyze-threats] -- Generate AI Report (Gemini Pro)
        +---> [analyze-surface] -- Interactive AI Chat (Gemini Flash)
        +---> PDF Export (jsPDF)
```

### 2.2 Component Architecture

```
src/
├── pages/
│   ├── Auth.tsx          # Sign in / Sign up with Google OAuth
│   ├── Index.tsx         # Dashboard with stats, recent scans, scan form
│   ├── ScanDetail.tsx    # Full scan results (4 tabs: Findings, Surface, Report, Raw Data)
│   ├── History.tsx       # All scans list with delete capability
│   ├── Compare.tsx       # Side-by-side scan comparison
│   ├── Policies.tsx      # Domain policy management + audit log
│   └── NotFound.tsx      # 404 error page
├── components/
│   ├── AppLayout.tsx     # Header nav, logo, user avatar popover, sign out
│   ├── AuthProvider.tsx  # Session context provider (onAuthStateChange + getSession)
│   ├── ScanForm.tsx      # Domain input with two-phase submit (evaluate → scan)
│   ├── AiChatPanel.tsx   # Interactive AI analyst chatbot with markdown rendering
│   ├── AiSurfaceInsight.tsx  # One-click AI analysis button for surface sections
│   ├── RiskScoreBreakdown.tsx # Detailed risk visualization with bar chart
│   ├── SeverityBadge.tsx # SeverityBadge, StatusBadge, RiskScoreGauge exports
│   ├── PageTransition.tsx # Framer Motion page transitions + stagger/fadeInUp/scaleIn
│   └── NavLink.tsx       # React Router NavLink wrapper with active state classes
├── lib/
│   ├── api.ts            # API layer (scan, evaluate, report, CRUD operations)
│   ├── pdf-export.ts     # PDF report generation engine (jsPDF)
│   └── utils.ts          # Utility functions (cn helper)
└── integrations/
    ├── supabase/
    │   ├── client.ts     # Auto-generated Supabase client
    │   └── types.ts      # Auto-generated database types
    └── lovable/
        └── index.ts      # Google OAuth integration (lovable.auth)

supabase/functions/
├── firecrawl-scan/       # Main scan orchestration
├── analyze-threats/      # AI threat report generation (Gemini Pro)
├── analyze-surface/      # AI interactive analysis (Gemini Flash) — 7 section handlers
└── evaluate-domain/      # AI domain policy evaluation (Gemini Flash Lite)
```

### 2.3 Routing & Protected Routes

The application uses React Router v6 with a `ProtectedRoute` wrapper component defined in `App.tsx`:

```
/auth         → Auth.tsx (public — redirects to / if already authenticated)
/             → Index.tsx (protected)
/scan/:id     → ScanDetail.tsx (protected)
/history      → History.tsx (protected)
/compare      → Compare.tsx (protected)
/policies     → Policies.tsx (protected)
*             → NotFound.tsx (public)
```

Each protected route is wrapped with `AppLayout` (header + navigation) and `PageTransition` (Framer Motion animations). The `ProtectedRoute` component checks `useAuth()` session state — unauthenticated users are redirected to `/auth`.

---

## 3. Database Schema

### 3.1 `scans` Table
The primary table storing all scan results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated scan identifier |
| `domain` | TEXT | Target domain that was scanned |
| `status` | TEXT | `crawling`, `analyzing`, `completed`, `failed` |
| `risk_score` | INTEGER | Composite risk score (0–100) |
| `urls_found` | INTEGER | Total number of URLs discovered |
| `vulnerabilities_found` | INTEGER | Total number of findings generated |
| `technologies` | JSONB | Array of detected technology names |
| `raw_crawl_data` | JSONB | Full Firecrawl response (`{ scrape, map }`) |
| `parsed_data` | JSONB | Structured data: `{ urls, jsFiles, forms, endpoints, externalDependencies, metadata, securityHeaders }` |
| `enrichment` | JSONB | `{ whois, hosting, riskFactors }` |
| `ai_report` | TEXT | AI-generated threat intelligence report (markdown) |
| `error_message` | TEXT | Error details if scan failed |
| `created_at` | TIMESTAMPTZ | Scan creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### 3.2 `findings` Table
Individual vulnerability findings linked to scans.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Finding identifier |
| `scan_id` | UUID (FK → scans) | Parent scan reference |
| `title` | TEXT | Finding title |
| `description` | TEXT | Detailed description |
| `severity` | TEXT | `critical`, `high`, `medium`, `low`, `info` |
| `category` | TEXT | `Security Headers`, `Exposed Paths`, `Injection Points`, `XSS`, `Outdated Libraries`, `CMS Risk`, `Supply Chain` |
| `details` | JSONB | Additional structured details (header name, URL, recommendation, etc.) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### 3.3 `profiles` Table
User registration records for access control.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Profile identifier |
| `user_id` | UUID (UNIQUE) | Auth user ID reference |
| `email` | TEXT | User's email address |
| `display_name` | TEXT | User's display name (from Google) |
| `avatar_url` | TEXT | Google avatar URL |
| `created_at` | TIMESTAMPTZ | Registration timestamp |

### 3.4 `domain_policies` Table
AI-evaluated and manually managed domain policies.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Policy identifier |
| `domain` | TEXT (UNIQUE) | Target domain (cleaned, lowercase) |
| `policy_type` | TEXT | `allow`, `block`, or `review` |
| `reason` | TEXT | Explanation for the policy decision |
| `ai_evaluated` | BOOLEAN | Whether AI made this decision (vs manual) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### 3.5 `scan_audit_log` Table
Immutable log of all domain evaluation attempts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Log entry identifier |
| `domain` | TEXT | Domain that was evaluated |
| `action` | TEXT | `approved`, `blocked`, or `flagged` |
| `reason` | TEXT | Evaluation reason (prefixed with "Existing policy:" or "AI evaluation:") |
| `created_at` | TIMESTAMPTZ | Timestamp |

---

## 4. Edge Functions (Backend)

### 4.1 Firecrawl Scan Pipeline

**File**: `supabase/functions/firecrawl-scan/index.ts`

This is the core orchestration function that manages the entire scan lifecycle. It requires the `FIRECRAWL_API_KEY` secret.

#### Process Flow

```
INPUT: { domain: string, scanId?: string }
         |
         v
1. Create scan record (status: "crawling") or use existing scanId
         |
         v
2. Format target URL (add https:// if missing)
         |
         v
3. Firecrawl /v1/scrape
   - Formats: markdown, html, links
   - onlyMainContent: false (full page)
   - On failure: mark scan as failed, return error
         |
         v
4. Firecrawl /v1/map
   - Limit: 200 URLs
   - Non-blocking: continues if map fails
         |
         v
5. Parse Results
   |-- Merge and deduplicate URLs from scrape.links + map.links
   |-- detectTechnologies() — 20 regex patterns against HTML
   |-- Extract JS files (*.js, *.mjs, *.jsx, *.ts, *.tsx)
   |-- extractForms() — parse <form> tags for action, method, inputs (max 20)
   |-- Filter external dependencies (different hostname from target)
   |-- Filter endpoints (URLs with ? or API-like path patterns)
   |-- analyzeSecurityFromMeta() — check 7 security headers from metadata
         |
         v
6. Generate Enrichment
   |-- Simulated WHOIS data (registrar, dates, nameservers)
   |-- Hosting provider detection (Cloudflare check from tech stack)
   |-- Risk factor assessment (hasLogin, isEcommerce, usesCDN, surfaceSize)
         |
         v
7. Update scan (status: "analyzing", store parsed_data, technologies, enrichment)
         |
         v
8. generateFindings()
   |-- Security header checks (CSP, HSTS, X-Frame-Options)
   |-- Sensitive path patterns (admin, config, .env, .git, phpmyadmin)
   |-- Suspicious query parameters (redirect, url, file, cmd, exec, etc.)
   |-- Form XSS input detection (search, query, q, keyword, comment, message)
   |-- Technology risk assessment (jQuery → low, WordPress → medium)
   |-- Supply chain dependency count (>10 external deps → low)
         |
         v
9. Insert findings into database
         |
         v
10. calculateRiskScore()
    |-- critical: +25, high: +15, medium: +8, low: +3, info: +1
    |-- Capped at 100
         |
         v
11. Update scan (status: "completed", risk_score, vulnerabilities_found)
         |
         v
OUTPUT: { success, scanId, urlsFound, findingsCount, riskScore }
```

#### Technology Detection

The `detectTechnologies()` function uses regex pattern matching against the raw HTML to identify **20 technologies**:

| Technology | Detection Pattern |
|-----------|------------------|
| React | `react.production`, `reactDOM`, `__NEXT_DATA__` |
| Next.js | `__NEXT_DATA__`, `_next/` |
| Vue.js | `vue.js`, `__vue__` |
| Angular | `ng-version`, `angular.js` |
| jQuery | `jquery.js`, `jquery.min.js` |
| WordPress | `wp-content`, `wp-includes` |
| Bootstrap | `bootstrap.css`, `bootstrap.js` |
| Tailwind CSS | `tailwindcss`, `tailwind.css` |
| Google Analytics | `google-analytics`, `googletagmanager`, `gtag` |
| Google Tag Manager | `googletagmanager.com/gtm` |
| Cloudflare | `cloudflare`, `cf-ray`, `__cf_bm` |
| Nginx | `nginx` |
| PHP | `.php` |
| ASP.NET | `asp.net`, `__VIEWSTATE`, `__EVENTVALIDATION` |
| Shopify | `shopify.com`, `cdn.shopify` |
| Wix | `wix.com`, `parastorage.com` |
| Squarespace | `squarespace.com`, `sqsp.net` |
| Drupal | `drupal.js`, `drupal.settings` |
| HubSpot | `hubspot.com`, `hs-scripts` |
| Stripe | `stripe.com`, `stripe.js` |

#### Finding Generation Categories

| Category | Checks | Severity |
|----------|--------|----------|
| Security Headers | Missing CSP | High |
| Security Headers | Missing HSTS | Medium |
| Security Headers | Missing X-Frame-Options | Medium |
| Exposed Paths | Admin panels (`/admin`, `/wp-admin`, `/panel`, `/dashboard`) | High |
| Exposed Paths | Sensitive files (`/config`, `/.env`, `/.git`, `/backup`, `/dump`, `/sql`) | Critical |
| Exposed Paths | Database tools (`/phpmyadmin`, `/adminer`, `/phpinfo`) | Critical |
| Injection Points | Suspicious query params (`redirect`, `url`, `file`, `cmd`, `exec`, etc.) | High / Medium |
| XSS | Form inputs with text fields (`search`, `query`, `q`, `comment`, `message`) | Medium |
| Outdated Libraries | jQuery presence | Low |
| CMS Risk | WordPress detection | Medium |
| Supply Chain | >10 external dependencies | Low |

### 4.2 AI Threat Report Generator

**File**: `supabase/functions/analyze-threats/index.ts`

Generates comprehensive enterprise-grade AI threat intelligence reports.

**Input**: `{ scanId }` → Fetches scan + findings from database using service role key

**AI Model**: `google/gemini-2.5-pro` via Lovable AI Gateway (`https://ai.gateway.lovable.dev`)

**AI Prompt Structure**:
- System role: Principal Cybersecurity Analyst at a Fortune 500 firm
- Data provided: Full scan metadata, severity counts, category breakdown, technologies, enrichment (WHOIS, hosting, risk factors), security headers, all findings with details, attack surface metrics
- Output format: 11-section structured markdown report:
  1. Executive Summary
  2. Scope & Methodology
  3. Risk Assessment Overview (with risk matrix)
  4. Critical & High-Severity Findings (with CVSS estimates, CWE/OWASP refs)
  5. Medium & Low-Severity Findings (table format)
  6. Attack Surface Analysis (endpoints, tech stack, dependencies, forms)
  7. Security Headers Assessment
  8. Infrastructure & Hosting Analysis
  9. Remediation Roadmap (immediate → long-term)
  10. Compliance Considerations (GDPR, PCI-DSS, SOC 2)
  11. Conclusion

**Post-generation**: Report is stored in the `scans.ai_report` column.

**Error handling**: Returns specific error codes for rate limiting (429) and credit exhaustion (402).

### 4.3 AI Surface Analyst (Chatbot & Insights)

**File**: `supabase/functions/analyze-surface/index.ts`

Powers both the interactive AI chatbot (`AiChatPanel`) and the one-click AI analysis buttons (`AiSurfaceInsight`). Handles **7 different section types** with tailored prompts:

| Section | Source Component | Context Data | Analysis Focus |
|---------|-----------------|-------------|----------------|
| `security_headers` | `AiSurfaceInsight` | Header config object | Per-header risk assessment, exact remediation values |
| `endpoints` | `AiSurfaceInsight` | Discovered URLs (max 40) | Endpoint classification, high-risk paths, recon insights |
| `dependencies` | `AiSurfaceInsight` | External deps (max 30) | Supply chain risk, privacy concerns, Magecart scenarios |
| `raw_data` | `AiSurfaceInsight` | Raw crawl JSON (truncated 12KB) | Infrastructure overview, app fingerprint, data exposure |
| `surface_chat` | `AiChatPanel` (surface tab) | Full surface data + question | Free-form attack surface Q&A |
| `findings_chat` | `AiChatPanel` (findings tab) | All findings + question | Severity prioritization, remediation guidance |
| `raw_data_chat` | `AiChatPanel` (raw data tab) | Raw crawl data + question | Data interpretation and contextualization |

**AI Model**: `google/gemini-2.5-flash` via Lovable AI Gateway

**System prompt**: Principal Cybersecurity Analyst specializing in web app security, pen testing, and threat intelligence. References OWASP, CWE, MITRE ATT&CK.

### 4.4 AI Domain Policy Agent

**File**: `supabase/functions/evaluate-domain/index.ts`

The gatekeeper function that evaluates every scan request before execution.

**Decision Flow**:

```
INPUT: { domain }
        |
        v
1. Clean domain (lowercase, strip protocol/path)
        |
        v
2. Check domain_policies table for existing policy
        |
   EXISTS? ----YES----> Return stored policy + log to audit_log
        |
        NO
        |
        v
3. AI Evaluation (Gemini 2.5 Flash Lite via Supabase ai-proxy)
   |
   Prompt classification rules:
   |-- ALLOW: Public sites, businesses, SaaS, news, education, open-source
   |-- BLOCK: Military (.mil), intelligence agencies, critical infrastructure,
   |          healthcare patient portals, core banking, honeypots
   |-- REVIEW: Ambiguous, small government, suspicious TLDs, private-looking domains
        |
        v
4. Parse AI JSON response: { policy, reason }
   |-- Fallback to "review" if AI fails, errors, or response unclear
        |
        v
5. Store policy in domain_policies table (ai_evaluated: true)
        |
        v
6. Log to scan_audit_log (action: approved/blocked/flagged)
        |
        v
OUTPUT: { allowed: boolean, policy, reason, ai_evaluated }
```

---

## 5. Firecrawl Web Scraping Process

### 5.1 Scraping Flow Diagram

```
TARGET: https://example.com
              |
              v
+------- FIRECRAWL /v1/scrape --------+
|                                      |
|  Request:                            |
|    url: "https://example.com"        |
|    formats: [markdown, html, links]  |
|    onlyMainContent: false            |
|                                      |
|  Response:                           |
|    data.html     → Raw HTML          |
|    data.links    → Discovered URLs   |
|    data.metadata → HTTP headers      |
|    data.markdown → Page content      |
+------------------+-------------------+
                   |
                   v
+------- FIRECRAWL /v1/map ------------+
|                                      |
|  Request:                            |
|    url: "https://example.com"        |
|    limit: 200                        |
|                                      |
|  Response:                           |
|    links → Full site map URLs        |
|                                      |
|  (Non-blocking: continues if fails)  |
+------------------+-------------------+
                   |
                   v
+------- DATA MERGING & PARSING -------+
|                                      |
|  1. Deduplicate URLs from            |
|     scrape.links + map.links         |
|  2. Cap at 500 URLs                  |
|                                      |
|  From merged URLs:                   |
|   - JS files (*.js, *.mjs, *.jsx,   |
|     *.ts, *.tsx)                     |
|   - External deps (diff hostname)    |
|   - Endpoints (API patterns +        |
|     query params)                    |
|                                      |
|  From raw HTML:                      |
|   - Forms (action, method, input     |
|     names) — max 20 forms            |
|   - Technologies (20 regex patterns  |
|     against full HTML)               |
|                                      |
|  From metadata:                      |
|   - 7 security headers:             |
|     CSP, HSTS, X-Frame-Options,     |
|     X-Content-Type-Options, X-XSS,  |
|     Referrer-Policy,                 |
|     Permissions-Policy               |
+--------------------------------------+
```

### 5.2 Data Extraction Details

**Endpoint Filtering**: URLs containing `?` (query params) or matching API patterns:
```regex
/(api|graphql|rest|v\d|admin|login|dashboard|wp-|config)/i
```

**Form Extraction**: Regex-based HTML parsing:
```regex
/<form[^>]*action=["']?([^"'\s>]*)["']?[^>]*method=["']?([^"'\s>]*)["']?[^>]*>([\s\S]*?)<\/form>/gi
```
Extracts: action URL, HTTP method, input field names (capped at 20 forms).

**External Dependency Detection**: Compares each URL's hostname against the target domain — different host = external dependency (capped at 100).

**Security Header Analysis**: Reads from Firecrawl metadata object. Each of 7 headers is checked — present values stored, missing values marked as `"Not Set"`.

---

## 6. AI Integration

ThreatLens uses **two different AI integration patterns** depending on the function. No user API keys are required — all AI access is managed by Lovable Cloud.

### 6.1 Models Used

| Function | Model | Integration | Reasoning |
|----------|-------|-------------|-----------|
| Domain Policy Evaluation | `google/gemini-2.5-flash-lite` | Supabase AI Proxy | Fast, cheap; simple JSON classification task |
| Threat Report Generation | `google/gemini-2.5-pro` | Lovable AI Gateway | Highest quality; complex long-form report with CVE/OWASP refs |
| Interactive Chat & Surface Analysis | `google/gemini-2.5-flash` | Lovable AI Gateway | Balanced speed/quality for multi-turn context-aware analysis |

### 6.2 AI Gateway Integration

Used by `analyze-threats` and `analyze-surface`. These functions use the Lovable AI Gateway directly:

```
Edge Function
  → POST https://ai.gateway.lovable.dev/v1/chat/completions
  → Headers: Authorization: Bearer ${LOVABLE_API_KEY}
  → Body: {
      model: "google/gemini-2.5-pro" | "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "..." },
        { role: "user", content: "..." }
      ]
    }
  → Response: { choices: [{ message: { content: string } }] }
```

**Authentication**: Uses `LOVABLE_API_KEY` environment variable (auto-provided by Lovable Cloud).

### 6.3 AI Proxy Integration (Domain Policy)

Used by `evaluate-domain`. Routes through the Supabase AI Proxy:

```
Edge Function
  → POST ${SUPABASE_URL}/functions/v1/ai-proxy
  → Headers: Authorization: Bearer ${SUPABASE_ANON_KEY}
  → Body: {
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: "..." }]
    }
  → Response: { choices: [{ message: { content: string } }] }
```

**Authentication**: Uses `SUPABASE_ANON_KEY` (auto-provided).

**Why different patterns?** The evaluate-domain function was implemented using the Supabase ai-proxy pattern, while the analysis functions use the Lovable AI Gateway directly. Both achieve the same result — AI inference without requiring user API keys.

---

## 7. Frontend Components

### 7.1 Pages

#### `Auth.tsx` — Authentication
- Tab-based Sign In / Sign Up UI with custom tab switcher (not shadcn tabs)
- Google OAuth via `lovable.auth.signInWithOAuth("google")`
- `auth_intent` stored in localStorage to distinguish signup vs signin after OAuth redirect
- Profile-based registration gate:
  - **Sign Up**: Creates a `profiles` row with `user_id`, email, display_name, avatar_url from Google metadata
  - **Sign In**: Checks for existing profile → rejects with "No account found" if missing
- Unauthorized users signed out with error toast
- Animated background with radial gradient

#### `Index.tsx` — Dashboard
- Animated hero section with 3 concentric pulsing radar rings (Framer Motion)
- ThreatLens logo with pulse ring animation
- `ScanForm` component for domain input
- Stats grid (4 cards): Total Scans, Unique Domains, Vulnerabilities, Avg Risk
  - Avg Risk calculated only from **completed** scans (excludes failed/in-progress)
- Recent scans list (last 5) with staggered entry animations
- Risk distribution sidebar — scans bucketed by risk score ranges (≥75 critical, ≥50 high, ≥25 medium, >0 low, 0 info)
- Technology fingerprint cloud — top 8 technologies across all scans with occurrence counts

#### `ScanDetail.tsx` — Scan Results (655 lines)
The most complex page. **Four tabs**:

**Header area** (always visible):
- Domain name, status badge, scan timestamp
- Refresh, Export PDF, Generate AI Report buttons
- Progress card for in-progress scans (crawling/analyzing) with 3-second auto-poll interval
- Error card for failed scans with error message

**Stats row** (completed scans):
- 5 stat cards with tooltips: Risk Score (with scoring formula tooltip), URLs Found, Vulnerabilities, Technologies, JS Files
- Severity determination guide (Critical/High/Medium/Low definitions)
- Domain enrichment panel (WHOIS registrar, hosting provider, ASN, surface size)

**Tab 1: Findings**
- AI Chat Panel (findings context)
- Finding cards with severity badge, category label, title, description
- Staggered entry animations
- Shield icon when no findings detected

**Tab 2: Attack Surface**
- Attack Surface Summary table (5 rows: Security Headers, Endpoints, External Deps, JS Files, Input Vectors) with count, status, and risk implication
- AI Chat Panel (surface context)
- 4 clickable stat cards that scroll to detail sections (with tooltips explaining security implications)
- Technology Stack display (chips with primary styling)
- Security Headers table (green dot = set, red dot = missing, truncated values)
- Discovered Endpoints scrollable list
- JS Files and Forms side-by-side grid
- External Dependencies scrollable list

**Tab 3: AI Report**
- Generate button (if no report exists)
- Rendered markdown report with `renderMarkdown()` parser
- Copy Report and Download PDF buttons

**Tab 4: Raw Data**
- AI Chat Panel (raw_data context)
- Full raw crawl data displayed as formatted JSON in a scrollable `<pre>` block

#### `History.tsx` — Scan History
- Chronological list of all scans
- Each scan shows: domain, timestamp, URL count, findings count, status badge, risk score
- Delete button with AlertDialog confirmation
- Cascading delete: findings first, then scan record
- Staggered entry animations

#### `Compare.tsx` — Scan Comparison
- Dual Select dropdowns (only completed scans)
- Mutual exclusion (can't compare a scan with itself)
- Parallel data loading with `Promise.all`
- **Risk Score Change**: Side-by-side with delta indicator (green for improvement, red for regression)
- **Vulnerability changes**: 3-column grid — New Vulnerabilities, Resolved, Persistent (diff by finding title)
- **Technology Changes**: Added (green +), Removed (red −), Unchanged chips
- **Endpoint Changes**: New Endpoints, Removed Endpoints (capped at 30 shown, with "+N more" overflow)

#### `Policies.tsx` — Domain Policy Management
- Stats row (4 cards): Allowed, Blocked, Under Review, AI Evaluated counts
- Manual policy addition form: domain input, policy type selector, optional reason, Add button
- Domain cleaning on add: lowercase, strip protocol/path
- Duplicate detection with user-friendly error message
- Policy list with hover-reveal controls:
  - Policy type badge (color-coded: green/red/amber)
  - Inline type changer (Select dropdown, opacity-0 until hover)
  - Delete button (opacity-0 until hover)
  - AI-evaluated bot icon indicator
- Audit log (last 50 entries): color-coded action dots, domain, reason, action badge, timestamp

#### `NotFound.tsx` — 404 Page
- Centered layout with "404" heading, "Page not found" message, and link back to home
- Logs 404 errors to console with the attempted pathname

### 7.2 Core Components

#### `AiChatPanel.tsx`
- Collapsible chat interface — starts as a button, expands to full card panel
- Three context modes: `surface`, `findings`, `raw_data` with distinct labels
- Suggested question chips (4 per context) for quick one-click analysis
- Message history with user (right-aligned) / assistant (left-aligned) styling
- **Markdown renderer** (`renderMarkdown()` — exported function) supporting:
  - Bold text (`**text**`) via inline parser
  - Headers (`##`, `###`, `####`) with styled borders
  - Bullet lists (`-`, `*`) with primary-colored dots
  - Nested bullet lists (indented `-`, `*`) with secondary dots
  - Numbered lists
  - **Tables** — full parser that detects header + separator + data rows, renders styled `<table>` with hover rows
  - Code blocks (``` delimited) with monospace styling
  - Blockquotes (`>`) with left border accent
  - Horizontal rules (`---`)
- Copy-to-clipboard button on every AI response
- Send button + Enter key submission
- Loading state with "Analyzing..." spinner

#### `AiSurfaceInsight.tsx`
- One-click AI analysis button for specific surface sections
- Supports 4 section types: `security_headers`, `endpoints`, `dependencies`, `raw_data`
- Renders analysis results inline with basic markdown parsing (headers, bold, bullets, numbered lists)
- Calls `onAnalysis` callback to pass results up to ScanDetail for PDF inclusion

#### `ScanForm.tsx`
- Domain input with Globe icon prefix
- Two-phase submit flow:
  1. `evaluateDomain()` — checks AI policy agent
  2. `startScan()` — only if domain is allowed
- Policy status badge (green = allow, red = block, amber = review) with AI reasoning text
- Blocks scan if domain is blocked or under review (shows destructive toast)
- Navigates to `/scan/{scanId}` on success

#### `AuthProvider.tsx`
- React context providing `session`, `loading`, and `signOut`
- Sets up `onAuthStateChange` listener **before** calling `getSession()` (proper Supabase pattern to avoid race conditions)
- Provides context to entire app via `useAuth()` hook

#### `RiskScoreBreakdown.tsx`
- Large score display with color-coded text (Critical/High/Medium/Low)
- Progress bar visualization with animated width
- **Bar chart**: Severity contributions as proportional vertical bars with raw point labels
- Contribution breakdown: Each active severity level showing count × weight = points
- "Raw total capped at 100" note when score exceeds cap
- Severity definitions grid (4 categories with descriptions)
- Collapsible scoring formula details (`<details>` element)

#### `SeverityBadge.tsx` — Three exports:
1. **SeverityBadge**: Icon + label badge (ShieldAlert/AlertTriangle/Shield/ShieldCheck/Info) with severity-specific colors and border
2. **RiskScoreGauge**: Large score number + risk label + animated progress bar
3. **StatusBadge**: Scan status label (pending/crawling/analyzing/completed/failed) with `animate-pulse-glow` for active states

#### `PageTransition.tsx`
- `PageTransition` component: AnimatePresence wrapper with fade + slide animations (0.25s, custom easing)
- Exported animation variants:
  - `staggerContainer`: Staggers children by 0.06s
  - `fadeInUp`: Opacity 0→1, y 16→0 (0.35s)
  - `scaleIn`: Opacity 0→1, scale 0.95→1 (0.3s)

#### `NavLink.tsx`
- Wrapper around React Router's `NavLink` with `className`/`activeClassName`/`pendingClassName` support via the `cn()` utility
- Forwarded ref support

### 7.3 UI Component Library

Built on **shadcn/ui** with Radix primitives. Key components actively used:
- `Card`, `CardContent`, `CardHeader`, `CardTitle` — primary layout containers
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — ScanDetail tab navigation
- `Badge` — policy type labels in Policies page
- `Button` — actions throughout (multiple variants: default, outline, ghost)
- `Input` — domain entry, policy forms
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` — scan comparison selectors, policy type pickers
- `AlertDialog` — scan delete confirmation with destructive action styling
- `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent` — stat card explanations, metric tooltips
- `Popover`, `PopoverContent`, `PopoverTrigger` — user avatar menu in header
- `Avatar`, `AvatarImage`, `AvatarFallback` — user profile display with initial fallback
- `Progress` — risk score bars (used in RiskScoreBreakdown)

---

## 8. Authentication System

### 8.1 Auth Flow Diagram

```
User visits app
      |
      v
AuthProvider: onAuthStateChange + getSession
      |
  session? ----YES----> Render protected routes
      |
      NO
      |
      v
ProtectedRoute: <Navigate to="/auth" />
      |
      v
User sees Sign In / Sign Up tabs
      |
      v
User clicks Google button
      |
      v
localStorage.setItem("auth_intent", "signin" | "signup")
      |
      v
lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })
      |
      v
Google OAuth consent → redirect back to app
      |
      v
onAuthStateChange fires with new session
      |
      v
handlePostAuth():
      |
      v
Check profiles table for user_id (.maybeSingle())
      |
  profile EXISTS?
      |          |
     YES         NO
      |          |
  Navigate     Check localStorage "auth_intent"
  to "/"            |
                intent === "signup"?
                    |          |
                   YES         NO
                    |          |
                 Insert       signOut() +
                 profile      toast "No account found"
                    |
              localStorage.removeItem("auth_intent")
                    |
                 Navigate to "/"
```

### 8.2 Session Management

- **AuthProvider** creates a React context with `session`, `loading`, `signOut`
- `onAuthStateChange` is registered before `getSession()` per Supabase best practices
- `signOut()` calls `supabase.auth.signOut()` and clears session state to `null`
- Session is checked on every protected route via `ProtectedRoute` wrapper
- User avatar + email shown in header Popover (from `session.user.user_metadata`)
- Loading spinner shown while auth state is being determined

---

## 9. Risk Scoring Algorithm

### Scoring Formula

```
risk_score = min(100, Σ finding_scores)

where finding_score =
  critical: 25 points
  high:     15 points
  medium:    8 points
  low:       3 points
  info:      1 point
```

### Score Interpretation

| Range | Label | Color Token |
|-------|-------|-------------|
| 75–100 | Critical Risk | `--severity-critical` (red) |
| 50–74 | High Risk | `--severity-high` (orange) |
| 25–49 | Medium Risk | `--severity-medium` (yellow) |
| 1–24 | Low Risk | `--severity-low` (teal) |
| 0 | No Risk | `--severity-low` (teal) |

### Dashboard Average

Average risk is calculated only from **completed** scans with non-null `risk_score`, excluding failed or in-progress scans that would skew the metric downward.

---

## 10. PDF Export Engine

**File**: `src/lib/pdf-export.ts`

Generates professional PDF reports using jsPDF with the following structure:

1. **Cover Page** — Dark background (`rgb(15,17,23)`), "THREAT INTELLIGENCE ASSESSMENT REPORT" title, purple accent line, domain, date, report ID (`TL-{scanId.slice(0,8)}`), risk score, finding count, URL count, "CLASSIFICATION: CONFIDENTIAL" label
2. **Findings Summary** — Severity table (count × weight = points per severity), total risk score, detailed finding cards with colored severity badges (`roundedRect`), category labels, descriptions with text wrapping
3. **AI Threat Report** (if generated) — Full markdown-to-PDF rendering with headers (##, ###), bullets, bold text, separators, code blocks
4. **AI Surface Insights** (if generated) — Section-specific analysis with purple accent headers (Security Headers Analysis, Endpoints Analysis, Dependencies Analysis, Raw Data Intelligence)

**Technical features**:
- `checkPageBreak(needed)` — Automatic page breaks when content would exceed available space
- `doc.splitTextToSize(text, width)` — Text wrapping within content margins
- Color-coded severity badges rendered as filled rounded rectangles with white text
- Two-pass footer rendering: Content pages get footer with "Page X of Y" and report ID
- Page numbering excludes cover page (Page 1 of N starts on findings page)
- Dynamic file naming: `ThreatLens_Report_{sanitized_domain}_{date}.pdf`

---

## 11. Design System & Styling

### 11.1 CSS Token Architecture

All colors use HSL values defined in `src/index.css`. The app is **dark-mode only** (no light mode toggle).

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | `230 15% 6%` | Page background |
| `--foreground` | `220 15% 93%` | Primary text |
| `--card` | `230 14% 9%` | Card backgrounds |
| `--primary` | `252 87% 65%` | Purple accent (buttons, links, highlights) |
| `--secondary` | `230 12% 14%` | Secondary backgrounds, input fields |
| `--muted-foreground` | `225 10% 48%` | Subdued text, labels |
| `--accent` | `172 66% 50%` | Teal accent (complementary) |
| `--destructive` | `0 72% 55%` | Error/delete states |
| `--border` | `230 12% 15%` | Border color |
| `--severity-critical` | `0 72% 55%` | Red severity |
| `--severity-high` | `25 95% 55%` | Orange severity |
| `--severity-medium` | `45 100% 60%` | Yellow severity |
| `--severity-low` | `172 66% 50%` | Teal severity |
| `--severity-info` | `225 10% 48%` | Gray severity |
| `--success` | `152 60% 45%` | Green (resolved, allowed) |

### 11.2 Custom Utilities

| Utility Class | Effect |
|--------------|--------|
| `.glass` | Glassmorphism: `background: hsl(card / 0.7)` + `backdrop-filter: blur(20px)` — used on sticky header |
| `.glow-primary` | Purple box-shadow glow (`0 0 30px hsl(primary / 0.2)`) |
| `.glow-accent` | Teal box-shadow glow |
| `.text-gradient-primary` | Purple-to-violet gradient text (135deg) |
| `.text-gradient-accent` | Teal-to-cyan gradient text (135deg) |
| `.border-glow` | Primary border with inset glow + outer glow — used on in-progress scan cards |
| `.card-hover` | Hover state: primary border tint + subtle shadow elevation |
| `.scan-line` | Animated scanning line effect (3s vertical sweep, `ease-in-out`, infinite) |

### 11.3 Typography

- **Display font**: Space Grotesk (300–700 weights) — headings, UI text, body
- **Monospace font**: IBM Plex Mono (400–600 weights) — domains, scores, code, technical data, finding categories
- Font feature settings: `ss01`, `ss02` enabled for enhanced character shapes
- Custom scrollbar: 5px width, `--border`-colored thumb, transparent track, rounded corners

---

## 12. Security Architecture

### Row Level Security (RLS)

| Table | Policy | Rule |
|-------|--------|------|
| `profiles` | SELECT | `auth.uid() = user_id` |
| `profiles` | INSERT | `auth.uid() = user_id` |
| `profiles` | UPDATE | `auth.uid() = user_id` |
| `scans` | ALL | Open (shared scan data) |
| `findings` | ALL | Open (linked to scans) |
| `domain_policies` | ALL | Open (policy management) |
| `scan_audit_log` | SELECT | Open (transparency) |
| `scan_audit_log` | INSERT | Open (logging from edge functions) |

### Domain Policy Agent Security

The AI policy agent enforces responsible use:
- **Blocked categories**: Military (.mil), intelligence agencies, critical infrastructure, healthcare patient portals, core banking systems, law enforcement honeypots
- **Auto-allowed**: Public websites, businesses, SaaS products, educational institutions, open-source projects, news sites, personal sites
- **Flagged for review**: Ambiguous or potentially sensitive targets, small government agencies, suspicious TLDs, private-looking internal domains
- All decisions logged immutably in `scan_audit_log` with timestamped action and reason
- Manual override available via Policies page (inline type changer or delete + re-add)

### Edge Function Security

- `firecrawl-scan`, `analyze-threats`, `analyze-surface`: JWT verification disabled (`verify_jwt = false` in `config.toml`) — accessible without auth token
- `evaluate-domain`: Not listed in config.toml — uses default settings
- All functions use CORS headers allowing all origins
- `firecrawl-scan` and `evaluate-domain` use `SUPABASE_SERVICE_ROLE_KEY` for database writes
- `analyze-threats` and `analyze-surface` use `LOVABLE_API_KEY` for AI gateway access

---

## 13. API Layer

**File**: `src/lib/api.ts`

Client-side API abstraction layer. All functions use the Supabase JS client.

| Function | Purpose | Backend |
|----------|---------|---------|
| `evaluateDomain(domain)` | Check domain policy before scanning | `evaluate-domain` edge function |
| `startScan(domain)` | Initiate a new scan | `firecrawl-scan` edge function |
| `generateReport(scanId)` | Generate AI threat report | `analyze-threats` edge function |
| `analyzeSurface(section, data, domain)` | AI analysis for surface/chat | `analyze-surface` edge function |
| `getScans()` | Fetch all scans (newest first) | Direct DB query |
| `getScan(id)` | Fetch single scan by ID | Direct DB query |
| `getFindings(scanId)` | Fetch findings for a scan (newest first) | Direct DB query |
| `deleteScan(id)` | Delete scan + cascading findings | Direct DB (2 deletes: findings then scan) |

**TypeScript interfaces**: `Scan` and `Finding` types defined locally in `api.ts` (not using auto-generated Supabase types) to allow flexible typing of JSONB fields (`raw_crawl_data`, `parsed_data`, `enrichment`, `details` typed as `any`).

---

## 14. Conclusion

ThreatLens represents a modern approach to automated threat intelligence that bridges the gap between manual penetration testing and fully automated security scanning. The architecture separates concerns cleanly — Firecrawl handles data acquisition, PostgreSQL provides persistence, and AI models deliver contextual analysis — while the React frontend presents everything through an intuitive, professional interface.

The AI domain policy agent is a differentiating feature that addresses the ethical dimension of security scanning tools. By evaluating targets before scanning, ThreatLens ensures its capabilities are used responsibly while maintaining the speed and convenience that security professionals need.

Key architectural decisions:
- **Serverless edge functions** for zero-infrastructure backend scaling
- **Multi-model AI strategy**: Flash Lite for classification, Flash for interactive analysis, Pro for comprehensive reports
- **Two AI integration patterns**: Supabase AI Proxy for lightweight calls, Lovable AI Gateway for heavy inference
- **Profile-based access control** ensuring only registered users can operate the platform
- **Immutable audit logging** for accountability and compliance
- **Dark-mode cybersecurity aesthetic** with custom CSS design tokens, glass morphism, gradient text, and Framer Motion animations
- **Four-tab scan detail view** separating Findings, Attack Surface, AI Report, and Raw Data for focused analysis

The platform is designed to be extended with additional scanning modules, AI models, and integration points as the threat landscape evolves.

---

*ThreatLens Technical Documentation — Confidential*
*Built with [Lovable](https://lovable.dev)*
