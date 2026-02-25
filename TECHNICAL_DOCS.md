# ThreatLens — Technical Documentation

### Comprehensive Technical Reference

**By: Ritvik Induopuri**
**Date: February 25, 2026**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Deep Dive](#2-system-architecture-deep-dive)
3. [Database Schema](#3-database-schema)
4. [Edge Functions (Backend)](#4-edge-functions-backend)
   - 4.1 [Firecrawl Scan Pipeline](#41-firecrawl-scan-pipeline)
   - 4.2 [AI Threat Report Generator](#42-ai-threat-report-generator)
   - 4.3 [AI Surface Analyst](#43-ai-surface-analyst)
   - 4.4 [AI Domain Policy Agent](#44-ai-domain-policy-agent)
5. [Frontend Components](#5-frontend-components)
   - 5.1 [Pages](#51-pages)
   - 5.2 [Core Components](#52-core-components)
   - 5.3 [UI Component Library](#53-ui-component-library)
6. [AI Integration](#6-ai-integration)
7. [Authentication System](#7-authentication-system)
8. [Security Architecture](#8-security-architecture)
9. [Firecrawl Web Scraping Process](#9-firecrawl-web-scraping-process)
10. [Risk Scoring Algorithm](#10-risk-scoring-algorithm)
11. [PDF Export Engine](#11-pdf-export-engine)
12. [Conclusion](#12-conclusion)

---

## 1. Executive Summary

ThreatLens is a full-stack cybersecurity platform that automates the process of domain reconnaissance, vulnerability detection, and threat intelligence reporting. The system ingests a target domain, crawls it using the Firecrawl API, parses the results for security-relevant data (endpoints, scripts, forms, headers, technologies), generates findings with severity ratings, calculates a composite risk score, and provides AI-powered analysis through both automated reports and an interactive chatbot.

The platform is designed with three core principles:
1. **Automation** — Minimize manual effort in security assessment
2. **Intelligence** — Leverage AI models for context-aware analysis
3. **Responsibility** — Prevent misuse via an AI domain policy gatekeeper

---

## 2. System Architecture Deep Dive

### High-Level Data Flow

```
User enters domain
        |
        v
[evaluate-domain] -- AI Policy Check
        |
   allowed? ----NO----> Block/Review (show reason)
        |
       YES
        |
        v
[firecrawl-scan] -- Orchestration
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
    Display in Scan Detail UI
        |
        +---> [analyze-threats] -- Generate AI Report
        +---> [analyze-surface] -- Interactive AI Chat
```

### Component Architecture

```
src/
├── pages/
│   ├── Auth.tsx          # Sign in / Sign up with Google OAuth
│   ├── Index.tsx         # Dashboard with stats, recent scans, scan form
│   ├── ScanDetail.tsx    # Full scan results (tabs: Surface, Findings, Report)
│   ├── History.tsx       # All scans list with delete capability
│   ├── Compare.tsx       # Side-by-side scan comparison
│   ├── Policies.tsx      # Domain policy management + audit log
│   └── NotFound.tsx      # 404 page
├── components/
│   ├── AppLayout.tsx     # Header nav, user avatar, sign out
│   ├── AuthProvider.tsx  # Session context provider
│   ├── ScanForm.tsx      # Domain input with policy evaluation
│   ├── AiChatPanel.tsx   # Interactive AI analyst chatbot
│   ├── AiSurfaceInsight.tsx  # AI insight display cards
│   ├── RiskScoreBreakdown.tsx # Detailed risk visualization
│   ├── SeverityBadge.tsx # Status/severity badge components
│   ├── PageTransition.tsx # Framer Motion animations
│   └── NavLink.tsx       # Navigation link component
├── lib/
│   ├── api.ts            # API layer (scan, evaluate, report, CRUD)
│   ├── pdf-export.ts     # PDF report generation engine
│   └── utils.ts          # Utility functions (cn, etc.)
└── integrations/
    ├── supabase/
    │   ├── client.ts     # Auto-generated Supabase client
    │   └── types.ts      # Auto-generated database types
    └── lovable/
        └── index.ts      # Google OAuth integration

supabase/functions/
├── firecrawl-scan/       # Main scan orchestration
├── analyze-threats/      # AI threat report generation
├── analyze-surface/      # AI interactive analysis
└── evaluate-domain/      # AI domain policy evaluation
```

---

## 3. Database Schema

### `scans` Table
The primary table storing all scan results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated scan identifier |
| `domain` | TEXT | Target domain that was scanned |
| `status` | TEXT | Scan status: `crawling`, `analyzing`, `completed`, `failed` |
| `risk_score` | INTEGER | Composite risk score (0-100) |
| `urls_found` | INTEGER | Total number of URLs discovered |
| `vulnerabilities_found` | INTEGER | Total number of findings generated |
| `technologies` | JSONB | Array of detected technologies |
| `raw_crawl_data` | JSONB | Full Firecrawl response (scrape + map) |
| `parsed_data` | JSONB | Structured parsed data (endpoints, jsFiles, forms, etc.) |
| `enrichment` | JSONB | WHOIS, hosting, and risk factor data |
| `ai_report` | TEXT | AI-generated threat intelligence report |
| `error_message` | TEXT | Error details if scan failed |
| `created_at` | TIMESTAMPTZ | Scan creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### `findings` Table
Individual vulnerability findings linked to scans.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Finding identifier |
| `scan_id` | UUID (FK → scans) | Parent scan reference |
| `title` | TEXT | Finding title |
| `description` | TEXT | Detailed description |
| `severity` | TEXT | `critical`, `high`, `medium`, `low`, `info` |
| `category` | TEXT | Finding category (Security Headers, Exposed Paths, etc.) |
| `details` | JSONB | Additional structured details |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `profiles` Table
User registration records for access control.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Profile identifier |
| `user_id` | UUID (UNIQUE) | Auth user ID reference |
| `email` | TEXT | User's email address |
| `display_name` | TEXT | User's display name |
| `avatar_url` | TEXT | Google avatar URL |
| `created_at` | TIMESTAMPTZ | Registration timestamp |

### `domain_policies` Table
AI-evaluated and manually managed domain policies.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Policy identifier |
| `domain` | TEXT (UNIQUE) | Target domain |
| `policy_type` | TEXT | `allow`, `block`, or `review` |
| `reason` | TEXT | Explanation for the policy decision |
| `ai_evaluated` | BOOLEAN | Whether AI made this decision |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### `scan_audit_log` Table
Immutable log of all scan evaluation attempts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Log entry identifier |
| `domain` | TEXT | Domain that was evaluated |
| `action` | TEXT | `approved`, `blocked`, or `flagged` |
| `reason` | TEXT | Evaluation reason |
| `created_at` | TIMESTAMPTZ | Timestamp |

---

## 4. Edge Functions (Backend)

### 4.1 Firecrawl Scan Pipeline

**File**: `supabase/functions/firecrawl-scan/index.ts`

This is the core orchestration function that manages the entire scan lifecycle.

#### Process Flow

```
INPUT: { domain: string }
         |
         v
1. Create scan record (status: "crawling")
         |
         v
2. Format target URL (add https:// if needed)
         |
         v
3. Firecrawl /v1/scrape
   - Formats: markdown, html, links
   - onlyMainContent: false (full page)
         |
         v
4. Firecrawl /v1/map
   - Limit: 200 URLs
   - Fallback: continues if map fails
         |
         v
5. Parse Results
   |-- Merge and deduplicate URLs from scrape + map
   |-- detectTechnologies() - regex matching against HTML
   |-- Extract JS files (*.js, *.mjs, *.jsx, *.ts, *.tsx)
   |-- extractForms() - parse <form> tags for actions, methods, inputs
   |-- Filter external dependencies (different hostname)
   |-- Filter endpoints (API-like paths, query params)
   |-- analyzeSecurityFromMeta() - check 7 security headers
         |
         v
6. Generate Enrichment
   |-- Simulated WHOIS data
   |-- Hosting provider detection (Cloudflare check)
   |-- Risk factor assessment
         |
         v
7. Update scan (status: "analyzing", store parsed_data)
         |
         v
8. generateFindings()
   |-- Security header checks (CSP, HSTS, X-Frame-Options)
   |-- Sensitive path patterns (admin, config, .env, .git)
   |-- Suspicious query parameters (redirect, url, file, cmd)
   |-- Form XSS input detection
   |-- Technology risk assessment (jQuery, WordPress)
   |-- Supply chain dependency count
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

The `detectTechnologies()` function uses regex pattern matching against the raw HTML to identify 19 technologies:

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
| Cloudflare | `cloudflare`, `cf-ray`, `__cf_bm` |
| Shopify | `shopify.com`, `cdn.shopify` |
| Stripe | `stripe.com`, `stripe.js` |
| *...and 7 more* | |

#### Finding Generation Categories

| Category | Checks | Severity |
|----------|--------|----------|
| Security Headers | Missing CSP, HSTS, X-Frame-Options | High / Medium |
| Exposed Paths | Admin panels, config files, .git, .env | Critical / High |
| Injection Points | Suspicious query params (redirect, url, file, cmd) | High / Medium |
| XSS | Form inputs with search/query/comment fields | Medium |
| Outdated Libraries | jQuery presence | Low |
| CMS Risk | WordPress detection | Medium |
| Supply Chain | >10 external dependencies | Low |

### 4.2 AI Threat Report Generator

**File**: `supabase/functions/analyze-threats/index.ts`

Generates comprehensive AI threat intelligence reports using Google Gemini.

**Input**: `{ scanId }` → Fetches scan + findings from database

**AI Prompt Structure**:
- Role: Senior penetration tester
- Data provided: Domain, risk score, severity counts, category breakdown, technologies, security headers, all findings with details
- Output format: Structured markdown report with executive summary, critical findings, vulnerability analysis, technology assessment, and remediation roadmap

**Model**: Google Gemini 2.5 Flash (via Lovable AI proxy)

### 4.3 AI Surface Analyst

**File**: `supabase/functions/analyze-surface/index.ts`

Powers the interactive AI chatbot on the scan detail page. Handles multiple analysis contexts with tailored prompts:

| Section | Context Data | Analysis Focus |
|---------|-------------|----------------|
| `security_headers` | Header configuration | Attack vectors from missing headers, exact fix values |
| `endpoints` | Discovered URLs | Reconnaissance value, sensitive paths, API exposure |
| `forms` | HTML form data | Injection attack potential, CSRF risk |
| `external_deps` | Third-party resources | Supply chain risk, known vulnerable CDNs |
| `technologies` | Tech stack | Known CVEs, version-specific risks |
| `findings` | All findings | Priority triage, attack chain analysis |
| `chat` | Full scan context | Free-form analyst questions |

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
2. Check domain_policies table
        |
   EXISTS? ----YES----> Return stored policy + log audit
        |
        NO
        |
        v
3. AI Evaluation (Gemini Flash Lite)
   |
   Prompt rules:
   |-- ALLOW: Public sites, businesses, SaaS, news, education
   |-- BLOCK: Military (.mil), intelligence, critical infrastructure,
   |          healthcare portals, core banking, honeypots
   |-- REVIEW: Ambiguous, small government, suspicious TLDs
        |
        v
4. Parse AI JSON response
   |-- Fallback to "review" if AI fails or response unclear
        |
        v
5. Store policy in domain_policies table
        |
        v
6. Log to scan_audit_log
        |
        v
OUTPUT: { allowed, policy, reason, ai_evaluated }
```

---

## 5. Frontend Components

### 5.1 Pages

#### `Auth.tsx` — Authentication
- Tab-based Sign In / Sign Up UI
- Google OAuth via `lovable.auth.signInWithOAuth()`
- Profile-based registration gate: Sign Up creates a `profiles` row; Sign In checks for existing profile
- Unauthorized users are signed out with an error message

#### `Index.tsx` — Dashboard
- Animated hero section with pulsing radar rings
- Scan form with integrated domain policy evaluation
- Stats grid: Total Scans, Unique Domains, Vulnerabilities, Avg Risk (completed scans only)
- Recent scans list with status badges and risk scores
- Risk distribution by severity
- Technology fingerprint cloud

#### `ScanDetail.tsx` — Scan Results
- Tabbed interface: Attack Surface | Findings | AI Report
- **Attack Surface tab**: Security headers table, clickable stat cards (scroll to detail), AI chatbot, discovered endpoints, JS files, forms, external dependencies
- **Findings tab**: Expandable cards grouped by severity with details
- **AI Report tab**: One-click report generation, markdown rendering, copy button
- PDF export button
- Risk score breakdown component

#### `History.tsx` — Scan History
- Chronological list of all scans
- Status badges, risk score display
- Delete functionality with AlertDialog confirmation
- Cascading delete (findings → scan)

#### `Compare.tsx` — Scan Comparison
- Dual dropdown selectors for completed scans
- Side-by-side metrics: risk score, findings count, URLs, technologies
- Delta visualization with color-coded +/- indicators
- Findings diff: new, removed, and common findings
- Technology and URL overlap analysis

#### `Policies.tsx` — Domain Policy Management
- Stats: Allowed, Blocked, Under Review, AI Evaluated counts
- Manual policy addition form (domain + type + reason)
- Policy list with inline type editing (hover to reveal controls)
- AI-evaluated badge indicator
- Full audit log with color-coded action dots

### 5.2 Core Components

#### `AiChatPanel.tsx`
- Collapsible chat interface with message history
- Suggested question chips for quick analysis
- Markdown renderer supporting:
  - Bold text (`**text**`)
  - Headers (##, ###, ####)
  - Bullet lists with nesting
  - Tables with styled headers and hover rows
  - Code blocks and blockquotes
  - Horizontal rules
- Copy-to-clipboard button on each AI response

#### `ScanForm.tsx`
- Domain input with Globe icon
- Two-phase submit: evaluate domain policy → start scan
- Policy status badge (green/red/amber) with AI reasoning
- Blocks scan if domain is blocked or under review

#### `AuthProvider.tsx`
- React context for session state
- `onAuthStateChange` listener (set up before `getSession`)
- Provides `session`, `loading`, and `signOut` to all components

#### `RiskScoreBreakdown.tsx`
- Visual risk gauge with color-coded score
- Severity legend with descriptions
- Score interpretation guide

#### `SeverityBadge.tsx`
- Exports: `SeverityBadge`, `StatusBadge`, `RiskScoreGauge`
- Color mapping for severity levels and scan statuses

### 5.3 UI Component Library

Built on **shadcn/ui** with Radix primitives. Key components used:
- `Card`, `Tabs`, `Badge`, `Button`, `Input`, `Select`
- `AlertDialog` (delete confirmations)
- `Tooltip` (stat card explanations)
- `Popover` (user avatar menu)
- `Avatar` (user profile display)
- `Accordion` (expandable finding details)

---

## 6. AI Integration

ThreatLens uses Lovable AI's managed model proxy, requiring no API keys from the user.

### Models Used

| Function | Model | Reasoning |
|----------|-------|-----------|
| Domain Policy Evaluation | Gemini 2.5 Flash Lite | Fast, cheap; simple classification task |
| Threat Report Generation | Gemini 2.5 Flash | Balanced speed/quality for long-form reports |
| Interactive Chat Analysis | Gemini 2.5 Flash | Context-aware, multi-turn analysis |

### AI Proxy Integration

All AI calls route through the Lovable AI proxy:

```
Edge Function → POST {SUPABASE_URL}/functions/v1/ai-proxy
              → Headers: Authorization: Bearer {SUPABASE_ANON_KEY}
              → Body: { model, messages: [{ role, content }] }
              → Response: { choices: [{ message: { content } }] }
```

---

## 7. Authentication System

### Flow

```
User visits app
      |
      v
AuthProvider checks session
      |
  session? ----YES----> Render protected routes
      |
      NO
      |
      v
Redirect to /auth
      |
      v
User clicks Sign Up / Sign In
      |
      v
localStorage.setItem("auth_intent", mode)
      |
      v
lovable.auth.signInWithOAuth("google")
      |
      v
Google OAuth redirect + callback
      |
      v
onAuthStateChange fires with session
      |
      v
Check profiles table for user_id
      |
  profile? ----YES----> Navigate to /
      |
      NO
      |
      v
  intent === "signup"?
      |          |
     YES         NO
      |          |
  Create       Sign out +
  profile      "No account found"
      |
      v
  Navigate to /
```

### Security
- Protected routes via `<ProtectedRoute>` wrapper
- Session-based auth state via Supabase `onAuthStateChange`
- Profile existence check prevents unauthorized access via direct sign-in
- Avatar and email shown in header via Popover

---

## 8. Security Architecture

### Row Level Security (RLS)

| Table | Policy | Rule |
|-------|--------|------|
| `profiles` | SELECT | `auth.uid() = user_id` |
| `profiles` | INSERT | `auth.uid() = user_id` |
| `profiles` | UPDATE | `auth.uid() = user_id` |
| `scans` | ALL | Open (public data) |
| `findings` | ALL | Open (public data) |
| `domain_policies` | SELECT | Open (anyone can check policies) |
| `domain_policies` | ALL | Open (management) |
| `scan_audit_log` | SELECT | Open (transparency) |
| `scan_audit_log` | INSERT | Open (logging) |

### Domain Policy Agent Security

The AI policy agent enforces responsible use:
- **Blocked categories**: Military (.mil), intelligence agencies, critical infrastructure, healthcare patient portals, core banking
- **Auto-allowed**: Public websites, businesses, SaaS, educational institutions
- **Flagged for review**: Ambiguous or potentially sensitive targets
- All decisions logged immutably in `scan_audit_log`
- Manual override available via Policies page

---

## 9. Firecrawl Web Scraping Process

### Detailed Scraping Flow

```
TARGET: https://example.com
              |
              v
+------- FIRECRAWL /v1/scrape -------+
|                                      |
|  Request:                            |
|    url: "https://example.com"        |
|    formats: [markdown, html, links]  |
|    onlyMainContent: false            |
|                                      |
|  Response:                           |
|    data.html     -> Raw HTML         |
|    data.links    -> Discovered URLs  |
|    data.metadata -> HTTP headers     |
|    data.markdown -> Page content     |
+------------------+-------------------+
                   |
                   v
+------- FIRECRAWL /v1/map -----------+
|                                      |
|  Request:                            |
|    url: "https://example.com"        |
|    limit: 200                        |
|                                      |
|  Response:                           |
|    links -> Site map URLs            |
|                                      |
|  (Non-blocking: continues if fails)  |
+------------------+-------------------+
                   |
                   v
+------- DATA MERGING ----------+
|                                |
|  1. Deduplicate URLs from     |
|     scrape.links + map.links  |
|  2. Cap at 500 URLs           |
|                                |
+------- PARSING ---------------+
|                                |
|  From merged URLs:             |
|   - JS files (*.js, *.mjs...) |
|   - External deps (diff host) |
|   - Endpoints (API patterns)  |
|                                |
|  From raw HTML:                |
|   - Forms (action, method,    |
|     input names) - max 20     |
|   - Technologies (19 regex    |
|     patterns against HTML)    |
|                                |
|  From metadata:                |
|   - 7 security headers check  |
|     CSP, HSTS, X-Frame,       |
|     X-Content-Type, X-XSS,    |
|     Referrer-Policy,           |
|     Permissions-Policy         |
|                                |
+--------------------------------+
```

### Data Extraction Details

**Endpoint Filtering**: URLs containing `?` (query params) or matching API patterns:
```regex
/(api|graphql|rest|v\d|admin|login|dashboard|wp-|config)/i
```

**Form Extraction**: Regex-based HTML parsing:
```regex
/<form[^>]*action="([^"]*)"[^>]*method="([^"]*)">(.*?)<\/form>/gi
```
Extracts: action URL, HTTP method, input field names (max 20 forms)

**External Dependency Detection**: Compares URL hostname against target domain — different host = external dependency

---

## 10. Risk Scoring Algorithm

### Scoring Formula

```
risk_score = min(100, sum(finding_scores))

where finding_score =
  critical: 25 points
  high:     15 points
  medium:    8 points
  low:       3 points
  info:      1 point
```

### Score Interpretation

| Range | Label | Color |
|-------|-------|-------|
| 75-100 | Critical Risk | Red |
| 50-74 | High Risk | Orange |
| 25-49 | Medium Risk | Yellow |
| 1-24 | Low Risk | Green |
| 0 | No Risk | Green |

### Dashboard Average

Average risk is calculated only from **completed** scans, excluding failed or in-progress scans that would skew the metric downward.

---

## 11. PDF Export Engine

**File**: `src/lib/pdf-export.ts`

Generates professional PDF reports using jsPDF with the following structure:

1. **Cover Page** — ThreatLens branding, domain, date, report ID, confidential label
2. **Executive Summary** — Risk score, severity breakdown, key metrics
3. **Technologies Detected** — Grid layout of fingerprinted technologies
4. **Findings** — Grouped by severity with full descriptions and details
5. **Attack Surface** — Endpoint count, JS files, forms, external dependencies
6. **AI Insights** — Surface analysis insights if available
7. **AI Report** — Full AI-generated threat intelligence report
8. **Footer** — Page numbers, report ID, confidential marking

Features:
- Automatic page breaks with `checkPageBreak()`
- Text wrapping with `splitTextToSize()`
- Color-coded severity indicators
- Two-pass rendering for accurate total page counts

---

## 12. Conclusion

ThreatLens represents a modern approach to automated threat intelligence that bridges the gap between manual penetration testing and fully automated security scanning. The architecture separates concerns cleanly — Firecrawl handles data acquisition, PostgreSQL provides persistence, and AI models deliver contextual analysis — while the React frontend presents everything through an intuitive, professional interface.

The AI domain policy agent is a differentiating feature that addresses the ethical dimension of security scanning tools. By evaluating targets before scanning, ThreatLens ensures its capabilities are used responsibly while maintaining the speed and convenience that security professionals need.

Key architectural decisions:
- **Serverless edge functions** for zero-infrastructure backend scaling
- **Multi-model AI strategy** using lighter models for classification and more capable models for analysis
- **Profile-based access control** ensuring only registered users can operate the platform
- **Immutable audit logging** for accountability and compliance

The platform is designed to be extended with additional scanning modules, AI models, and integration points as the threat landscape evolves.

---

*ThreatLens Technical Documentation — Confidential*
*Built with [Lovable](https://lovable.dev)*
