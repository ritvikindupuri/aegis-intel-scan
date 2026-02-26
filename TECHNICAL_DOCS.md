# ThreatLens — Technical Documentation

### Comprehensive Technical Reference

**By: Ritvik Induopuri**
**Date: February 25, 2026**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Deep Dive](#2-system-architecture-deep-dive)
   - 2.1 [High-Level Data Flow](#21-high-level-data-flow)
   - 2.2 [Routing & Protected Routes](#22-routing--protected-routes)
3. [Database Schema](#3-database-schema)
   - 3.1 [scans Table](#31-scans-table)
   - 3.2 [findings Table](#32-findings-table)
   - 3.3 [profiles Table](#33-profiles-table)
   - 3.4 [domain_policies Table](#34-domain_policies-table)
   - 3.5 [scan_audit_log Table](#35-scan_audit_log-table)
   - 3.6 [Entity Relationship Diagram](#36-entity-relationship-diagram)
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
14. [Elasticsearch Integration](#14-elasticsearch-integration)
    - 14.1 [Architecture Overview](#141-architecture-overview)
    - 14.2 [Index Schema](#142-index-schema)
    - 14.3 [Data Sync Pipeline](#143-data-sync-pipeline)
    - 14.4 [Search Engine](#144-search-engine)
    - 14.5 [Global Search UI (Cmd+K)](#145-global-search-ui-cmdk)
    - 14.6 [Kibana Dashboards](#146-kibana-dashboards)
15. [Conclusion](#15-conclusion)

---

## 1. Executive Summary

ThreatLens is a full-stack cybersecurity platform that automates the process of domain reconnaissance, vulnerability detection, and threat intelligence reporting. The system ingests a target domain, crawls it using the Firecrawl API, parses the results for security-relevant data (endpoints, scripts, forms, headers, technologies), generates findings with severity ratings, calculates a composite risk score, and provides AI-powered analysis through both automated reports and an interactive chatbot.

The platform is designed with three core principles:
1. **Automation** — Minimize manual effort in security assessment
2. **Intelligence** — Leverage AI models for context-aware analysis
3. **Responsibility** — Prevent misuse via an AI domain policy gatekeeper

To understand how these principles translate into a working system, the next section dissects the architecture that ties the frontend, backend, and external services together into a unified pipeline.

---

## 2. System Architecture Deep Dive

The architecture of ThreatLens follows a three-tier model: a React single-page application on the client, serverless edge functions for compute, and PostgreSQL for persistence — all orchestrated through Lovable Cloud. This section walks through the data flow, component organization, and routing structure that make the platform work.

### 2.1 High-Level Data Flow

```mermaid
flowchart TD
    A["User enters domain"] --> B["evaluate-domain\nAI Policy Check\n(Gemini 3 Flash Preview)"]
    B --> C{"Allowed?"}
    C -- "NO" --> D["Block / Review\nShow reason to user"]
    C -- "YES" --> E["firecrawl-scan\nOrchestration Edge Function"]
    
    E --> F["Firecrawl API\n/v1/scrape\nHTML + links + metadata"]
    E --> G["Firecrawl API\n/v1/map\nSite map (200 URLs)"]
    
    F --> H["Parse Results"]
    G --> H
    
    H --> H1["Extract endpoints,\nJS files, forms, deps"]
    H --> H2["Detect technologies\n(20 regex patterns)"]
    H --> H3["Analyze security headers\nfrom metadata"]
    H --> H4["Generate enrichment\n(WHOIS, hosting, risk)"]
    
    H1 --> I["Generate Findings"]
    H2 --> I
    H3 --> I
    H4 --> I
    
    I --> I1["Security header gaps"]
    I --> I2["Sensitive path detection"]
    I --> I3["Suspicious query params"]
    I --> I4["XSS input points"]
    I --> I5["Technology risk"]
    I --> I6["Supply chain analysis"]
    
    I1 --> J["Calculate Risk Score\n(0-100, capped)"]
    I2 --> J
    I3 --> J
    I4 --> J
    I5 --> J
    I6 --> J
    
    J --> K["Store in PostgreSQL\nscans + findings tables"]
    K --> K2["elasticsearch-sync\nSync to Elastic Cloud"]
    K2 --> L["Display in Scan Detail UI\nauto-polls every 3s"]
    
    L --> M["analyze-threats\nAI Report\n(Gemini 3 Flash Preview)"]
    L --> N["analyze-surface\nAI Chat\n(Gemini 3 Flash Preview)"]
    L --> O["PDF Export\n(jsPDF)"]
    L --> P["Global Search\n(Cmd+K via Elasticsearch)"]
```

<p align="center"><em>Figure 1 — End-to-End Data Flow: From Domain Input to Intelligence Output</em></p>

**Step-by-step flow breakdown:**

1. **Domain Input** — The user enters a target domain into the `ScanForm` component on the dashboard.
2. **AI Policy Gate** — Before any crawling begins, the domain is sent to the `evaluate-domain` edge function, which uses Gemini Flash Lite to classify it as `allow`, `block`, or `review`.
3. **Block / Review Path** — If the domain is blocked or flagged for review, the scan is halted immediately. The user sees a toast notification explaining *why* the domain was rejected, with a "Go to Policies" button for manual override.
4. **Firecrawl Scrape** — For allowed domains, the `firecrawl-scan` edge function calls the Firecrawl `/v1/scrape` endpoint, requesting full HTML content, all hyperlinks, HTTP response metadata (headers), and a markdown representation of the page.
5. **Firecrawl Map** — A second call to `/v1/map` discovers up to 200 additional URLs across the site by following sitemaps and internal links. This call is non-blocking — if it fails, the pipeline continues with scrape data alone.
6. **Parsing Pipeline** — The raw data enters four parallel extraction paths:
   - **Endpoint extraction**: URLs are deduplicated, capped at 500, and filtered for JavaScript files, external dependencies (different hostname), and API-like endpoint patterns.
   - **Technology detection**: 20 regex patterns are matched against the raw HTML to identify frameworks, CDNs, CMSs, and analytics tools.
   - **Security header analysis**: 7 critical headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy) are checked from response metadata.
   - **Enrichment generation**: Real WHOIS data is fetched via RDAP (Registration Data Access Protocol) and IP geolocation via ip-api.com. Risk factors are computed from detected technologies and URL count.
7. **Finding Generation** — The parsed data feeds into six finding categories: security header gaps, sensitive exposed paths (e.g., `/admin`, `/.env`, `/.git`), suspicious query parameters (e.g., `redirect`, `cmd`, `exec`), XSS input points (e.g., search/comment forms), technology risks (e.g., jQuery, WordPress), and supply chain vulnerabilities (excessive external dependencies).
8. **Risk Scoring** — Each finding is assigned a severity (critical/high/medium/low/info), and a composite risk score is calculated from the weighted sum: Critical = 25pts, High = 15pts, Medium = 8pts, Low = 3pts, Info = 1pt. The total is capped at 100.
9. **Database Persistence** — The scan record (with parsed data, technologies, enrichment) and all findings are written to the `scans` and `findings` PostgreSQL tables.
10. **Frontend Polling** — The Scan Detail page polls the database every 3 seconds until the scan status changes from `crawling`/`analyzing` to `completed` or `failed`.
11. **Output Paths** — From a completed scan, users can trigger three additional outputs:
    - **AI Threat Report** (`analyze-threats`) — A comprehensive, structured markdown report generated by Gemini Pro.
    - **Interactive AI Chat** (`analyze-surface`) — A conversational analyst chatbot powered by Gemini Flash.
    - **PDF Export** — A branded, paginated PDF document generated client-side with jsPDF.

With the data flow established, the next question is how routing and access control determine which parts of the UI a user can reach.

### 2.2 Routing & Protected Routes

```mermaid
flowchart LR
    subgraph Public
        AuthPage["/auth -- Auth.tsx"]
        NotFound["/* -- NotFound.tsx"]
    end
    
    subgraph Protected["Protected (requires session)"]
        Index["/ -- Index.tsx\nDashboard"]
        Scan["/scan/:id -- ScanDetail.tsx"]
        HistoryPage["/history -- History.tsx"]
        Compare["/compare -- Compare.tsx"]
        PoliciesPage["/policies -- Policies.tsx"]
    end
    
    AuthPage -- "session exists" --> Index
    NoSession["No session"] -- "redirect" --> AuthPage
    
    Index --> AppLayout["Wrapped in\nAppLayout + PageTransition"]
    Scan --> AppLayout
    HistoryPage --> AppLayout
    Compare --> AppLayout
    PoliciesPage --> AppLayout
```

<p align="center"><em>Figure 2 — Application Routing Map with Protected Route Guards</em></p>

**Step-by-step routing breakdown:**

1. **Route Registration** — React Router v6 defines all routes in `App.tsx`. Routes are split into two groups: public (no session required) and protected (session required).
2. **Public Routes** — `/auth` (the login/signup page) and `/*` (the 404 catch-all) are accessible without authentication.
3. **Protected Route Guard** — Every other route is wrapped in a `ProtectedRoute` component. If no session exists, it redirects the user to `/auth`.
4. **Auth Page Redirect** — The `/auth` route itself checks for an existing session on mount. If the user is already authenticated, they are redirected to `/` (the dashboard) to prevent accessing the login page when already signed in.
5. **Layout Wrapping** — Every protected route is wrapped with two higher-order components:
   - **`AppLayout`** — Renders the sticky glassmorphism header with navigation links (Dashboard, History, Compare, Policies), the ThreatLens logo, and the user avatar popover with sign-out functionality.
   - **`PageTransition`** — Applies Framer Motion fade + slide animations (0.25s duration, custom easing) for smooth visual transitions between pages.
6. **Route Parameters** — The `/scan/:id` route uses a dynamic URL parameter to load a specific scan by its UUID.

Now that we've seen how data flows through the system and how the client is organized, the next layer to examine is where all of this data lives — the PostgreSQL database schema that underpins every scan, finding, policy, and user profile.

---

## 3. Database Schema

The database is the backbone of ThreatLens, storing everything from raw crawl data to AI-generated reports. Five tables work together to support the scan lifecycle, vulnerability tracking, user management, domain policy enforcement, and audit logging. Each table is designed with specific JSONB columns to accommodate the flexible, deeply nested data structures that web scraping and AI analysis produce.

### 3.1 `scans` Table
The primary table storing all scan results. Every scan begins as a `crawling` record and progresses through `analyzing` to `completed` (or `failed`). The JSONB columns (`raw_crawl_data`, `parsed_data`, `enrichment`, `technologies`) store the full depth of scraping and analysis results without requiring rigid column definitions.

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
Each scan produces zero or more findings — individual vulnerability detections linked back to the parent scan via `scan_id`. Findings are the atomic units that feed into risk scoring, severity breakdowns, and AI analysis.

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
While scans and findings are shared across all users, the `profiles` table is the only user-specific table — it stores registration data from Google OAuth and serves as the registration gate that distinguishes signed-up users from anonymous Google account holders.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Profile identifier |
| `user_id` | UUID (UNIQUE) | Auth user ID reference |
| `email` | TEXT | User's email address |
| `display_name` | TEXT | User's display name (from Google) |
| `avatar_url` | TEXT | Google avatar URL |
| `created_at` | TIMESTAMPTZ | Registration timestamp |

### 3.4 `domain_policies` Table
Before any scan executes, the domain must pass through a policy check. This table caches the results of AI evaluations and manual overrides so that repeat scans against the same domain don't require redundant AI calls.

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
Every domain evaluation — whether served from the policy cache or freshly evaluated by AI — generates an immutable audit log entry. This table provides the accountability trail visible on the Policies page and is append-only by design.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Log entry identifier |
| `domain` | TEXT | Domain that was evaluated |
| `action` | TEXT | `approved`, `blocked`, or `flagged` |
| `reason` | TEXT | Evaluation reason (prefixed with "Existing policy:" or "AI evaluation:") |
| `created_at` | TIMESTAMPTZ | Timestamp |

### 3.6 Entity Relationship Diagram

The following diagram shows how these five tables relate to each other. The only true foreign key relationship is between `scans` and `findings` — the other tables are logically connected through shared domain values and the scan lifecycle but remain structurally independent for flexibility and performance.

```mermaid
erDiagram
    scans ||--o{ findings : "has many"
    scans {
        uuid id PK
        text domain
        text status
        int risk_score
        int urls_found
        int vulnerabilities_found
        jsonb technologies
        jsonb raw_crawl_data
        jsonb parsed_data
        jsonb enrichment
        text ai_report
        text error_message
        timestamptz created_at
        timestamptz updated_at
    }
    findings {
        uuid id PK
        uuid scan_id FK
        text title
        text description
        text severity
        text category
        jsonb details
        timestamptz created_at
    }
    profiles {
        uuid id PK
        uuid user_id UK
        text email
        text display_name
        text avatar_url
        timestamptz created_at
    }
    domain_policies {
        uuid id PK
        text domain UK
        text policy_type
        text reason
        boolean ai_evaluated
        timestamptz created_at
        timestamptz updated_at
    }
    scan_audit_log {
        uuid id PK
        text domain
        text action
        text reason
        timestamptz created_at
    }
    domain_policies ||--o{ scan_audit_log : "generates"
```

<p align="center"><em>Figure 1 — Database Entity Relationship Diagram</em></p>

**Step-by-step schema relationship breakdown:**

1. **`scans` → `findings` (one-to-many)** — Each scan record produces zero or more findings, linked by the `scan_id` foreign key on the `findings` table. When a scan is deleted, its findings must be deleted first (cascading delete handled in application code, not a DB cascade constraint).
2. **`profiles` (standalone)** — Stores user registration data keyed by `user_id`. This is the **only table with Row Level Security** restricted to the owning user — users can only read, insert, and update their own profile row. It has no foreign key to any other table.
3. **`domain_policies` → `scan_audit_log` (logical relationship)** — Every time a domain is evaluated (whether from the policy cache or via a fresh AI call), an entry is written to `scan_audit_log`. The relationship is logical (shared `domain` value), not enforced by a foreign key, because audit logs are append-only and must persist even if a policy is deleted.
4. **`scans` and `findings` (open access)** — These tables have open RLS policies, meaning all authenticated users can see all scan data. This is intentional — scan results are shared knowledge, not per-user private data.
5. **`domain_policies` (open access)** — Also open to all users, allowing anyone to view and manage the domain allowlist/blocklist. Manual overrides on this table directly affect which domains can be scanned.
6. **`scan_audit_log` (append-only)** — Open for SELECT and INSERT, but no UPDATE or DELETE policies. This ensures the audit trail is immutable — once a domain evaluation is logged, it cannot be modified or removed.

With the data model defined, the next question is: what code actually reads from and writes to these tables? That's the job of the four serverless edge functions that form ThreatLens's backend compute layer.

---

## 4. Edge Functions (Backend)

The backend logic lives entirely in four Deno-based edge functions deployed to Lovable Cloud. Each function serves a distinct role in the scan lifecycle: `firecrawl-scan` orchestrates the crawling and analysis pipeline, `analyze-threats` generates AI reports, `analyze-surface` powers the interactive chatbot, and `evaluate-domain` gates every scan request through the AI policy agent. Together, they transform a raw domain name into structured intelligence — reading from and writing to the database tables described above.

### 4.1 Firecrawl Scan Pipeline

**File**: `supabase/functions/firecrawl-scan/index.ts`

This is the core orchestration function that manages the entire scan lifecycle. It requires the `FIRECRAWL_API_KEY` secret and is the most complex of the four edge functions — handling everything from API calls to data parsing to finding generation in a single invocation.

#### Process Flow

```mermaid
flowchart TD
    Input["INPUT: domain, scanId?"] --> A["Create scan record\nstatus: crawling"]
    A --> B["Format target URL\nadd https:// if missing"]
    B --> C["Firecrawl /v1/scrape\nformats: markdown, html, links\nonlyMainContent: false"]
    C --> D{"Scrape\nsucceeded?"}
    D -- "NO" --> E["Mark scan as FAILED\nreturn error"]
    D -- "YES" --> F["Firecrawl /v1/map\nlimit: 200 URLs\n(non-blocking)"]
    F --> G["Parse Results"]
    
    G --> G1["Merge + deduplicate URLs\n(scrape.links + map.links)"]
    G --> G2["detectTechnologies()\n20 regex patterns vs HTML"]
    G --> G3["Extract JS files\n.js .mjs .jsx .ts .tsx"]
    G --> G4["extractForms()\nparse form tags (max 20)"]
    G --> G5["Filter external deps\ndifferent hostname"]
    G --> G6["Filter endpoints\nquery params + API patterns"]
    G --> G7["analyzeSecurityFromMeta()\n7 security headers"]
    
    G1 --> H["Generate Enrichment\nWHOIS, hosting, risk factors"]
    G2 --> H
    G3 --> H
    G4 --> H
    G5 --> H
    G6 --> H
    G7 --> H
    
    H --> I["Update scan\nstatus: analyzing\nstore parsed_data"]
    I --> J["generateFindings()"]
    
    J --> J1["Security headers\nCSP, HSTS, X-Frame"]
    J --> J2["Sensitive paths\nadmin, .env, .git"]
    J --> J3["Suspicious params\nredirect, cmd, exec"]
    J --> J4["XSS inputs\nsearch, query, comment"]
    J --> J5["Tech risks\njQuery, WordPress"]
    J --> J6["Supply chain\nexternal dep count"]
    
    J1 --> K["Insert findings\ninto database"]
    J2 --> K
    J3 --> K
    J4 --> K
    J5 --> K
    J6 --> K
    
    K --> L["calculateRiskScore()\ncritical:25 high:15\nmedium:8 low:3 info:1\ncapped at 100"]
    L --> M["Update scan\nstatus: completed\nrisk_score, vuln count"]
    M --> Output["OUTPUT:\nscanId, urlsFound\nfindingsCount, riskScore"]
```

<p align="center"><em>Figure 1 — Firecrawl Scan Pipeline: Complete Orchestration Flow</em></p>

**Step-by-step pipeline breakdown:**

1. **Scan Record Creation** — The function receives a domain (and optionally an existing `scanId`). If no `scanId` is provided, it creates a new scan record in the `scans` table with `status: crawling`. If a `scanId` is provided, it updates the existing record.
2. **URL Formatting** — The domain is normalized: if it doesn't start with `http://` or `https://`, `https://` is prepended to form a valid target URL.
3. **Firecrawl Scrape Call** — A POST request is sent to `https://api.firecrawl.dev/v1/scrape` with `formats: ['markdown', 'html', 'links']` and `onlyMainContent: false` (to capture the entire page, not just the main body content). The response contains raw HTML, discovered URLs, HTTP response metadata, and a markdown representation.
4. **Failure Check** — If the scrape call fails (network error, invalid domain, Firecrawl service down), the scan is immediately marked as `failed` with the error message stored in `error_message`, and the function returns early.
5. **Firecrawl Map Call** — On successful scrape, a second call is made to `https://api.firecrawl.dev/v1/map` with `limit: 200` to discover additional URLs across the site via sitemaps and internal link following. This call is wrapped in a try-catch — if it fails, the pipeline continues using only the scrape data (non-blocking).
6. **URL Merging & Deduplication** — Links from both the scrape response and the map response are combined into a single array, deduplicated using a `Set`, and capped at 500 URLs maximum.
7. **Seven-Step Parsing Phase** — The merged data is processed through seven parallel extraction functions:
   - **`detectTechnologies()`** — Matches 20 regex patterns against the raw HTML to identify frameworks, CDNs, CMSs, and analytics tools (see Technology Detection table below).
   - **JS File Extraction** — Filters URLs by file extension (`.js`, `.mjs`, `.jsx`, `.ts`, `.tsx`) to identify client-side scripts.
   - **`extractForms()`** — Uses regex to parse `<form>` tags from the HTML, extracting action URLs, HTTP methods, and input field names (capped at 20 forms).
   - **External Dependency Filtering** — Compares each URL's hostname against the target domain; different hostnames are classified as external dependencies (capped at 100).
   - **Endpoint Filtering** — Identifies URLs containing query parameters (`?`) or matching API-like patterns (`/api/`, `/graphql/`, `/v1/`, `/admin/`, etc.).
   - **`analyzeSecurityFromMeta()`** — Checks the Firecrawl metadata object for 7 security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, and Permissions-Policy. Present values are stored; missing values are marked as `"Not Set"`.
   - **Real Enrichment Generation** — Fetches live WHOIS data via RDAP (`https://rdap.org/domain/`) and IP geolocation via ip-api.com (`http://ip-api.com/json/`). Returns registrar, registration/expiry dates, nameservers, status flags, ISP, ASN, country, city, and organization. Risk factors (hasLogin, isEcommerce, usesCDN, surfaceSize) are computed from detected technologies and URL count.
8. **Status Update** — The scan record is updated to `status: analyzing` with all parsed data stored in the `parsed_data`, `technologies`, and `enrichment` JSONB columns.
9. **Finding Generation** — The `generateFindings()` function runs six categories of security checks against the parsed data (see Finding Generation Categories table below). Each check produces zero or more findings with a title, description, severity, category, and details object.
10. **Database Insertion** — All generated findings are batch-inserted into the `findings` table with the scan's `scan_id` as the foreign key.
11. **Risk Score Calculation** — The `calculateRiskScore()` function sums findings by weighted severity: Critical = 25pts, High = 15pts, Medium = 8pts, Low = 3pts, Info = 1pt. The raw total is capped at 100 using `Math.min(total, 100)`.
12. **Final Update** — The scan record is updated to `status: completed` with the final `risk_score`, `vulnerabilities_found` count, and `urls_found` count. The function returns the scan ID and summary metrics.

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

#### Scan Consistency Mechanisms

To ensure that repeated scans of the same domain produce consistent, reproducible results — a critical requirement for enterprise audit and compliance workflows — ThreatLens employs three mechanisms:

**1. Deterministic AI Analysis (Temperature = 0)**

All AI model calls across the platform (`analyze-threats`, `analyze-surface`) use `temperature: 0` in their API requests. This forces the model to select the highest-probability token at each step, eliminating the randomness that causes different outputs from the same input. Without this, the same scan data could produce different severity ratings, CVSS estimates, or remediation priorities on each run — unacceptable for compliance reporting.

```json
{
  "model": "google/gemini-3-flash-preview",
  "temperature": 0,
  "messages": [...]
}
```

**2. Finding Deduplication**

The `generateFindings()` function can produce duplicate findings when multiple URLs match the same pattern (e.g., three `/admin`-like paths would previously create three separate "Exposed Admin Panel" findings). A deduplication step now runs before database insertion:

```typescript
const seen = new Set<string>();
const findings = rawFindings.filter(f => {
  const key = `${f.title}::${f.category}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

Deduplication uses a composite key of `title + category`. This means two findings with the same title in different categories are preserved (intentional — they represent different security concerns), but identical findings within the same category are collapsed to a single entry. This directly stabilizes the risk score, since fewer duplicate findings means less score inflation.

**3. Crawl Normalization**

URLs discovered from both the Firecrawl scrape and map endpoints are sorted alphabetically after deduplication:

```typescript
const links = [...new Set([...scrapeLinks, ...mapLinks])].sort();
```

This ensures that even if Firecrawl returns URLs in a different order between runs (due to internal concurrency, CDN routing, or server-side randomization), the downstream slicing (`urls.slice(0, 500)`, `endpoints.slice(0, 100)`, etc.) always selects the same subset of URLs. Without sorting, two scans of the same domain could process different URL subsets, leading to different findings simply because the array order changed.

**Combined Effect**: These three mechanisms work together to minimize variance between scans of the same domain. The remaining sources of variance (dynamic site content, A/B testing, CDN geo-routing, bot detection) are inherent to web scraping and cannot be eliminated from the client side.

#### Per-User Rate Limiting

Every scan request is subject to a per-user daily quota to prevent Firecrawl credit exhaustion. The system uses a `scan_quotas` table to track usage:

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID (UNIQUE) | The authenticated user |
| `scans_today` | INTEGER | Number of scans performed today |
| `daily_limit` | INTEGER | Configurable daily cap (default: 10) |
| `last_scan_date` | DATE | Date of last scan (for daily reset) |

**Rate limiting flow:**

1. **Extract user identity** — The edge function extracts the user ID from the `Authorization` header using the anon key to verify the JWT token.
2. **Check or create quota** — If no quota record exists, one is created with `scans_today: 1`. If the record exists but `last_scan_date` is not today, the counter resets to 1.
3. **Enforce limit** — If `scans_today >= daily_limit`, the function returns HTTP 429 with a descriptive error message including the limit and reset time.
4. **Increment counter** — On successful quota check, `scans_today` is incremented before the scan proceeds.
5. **Frontend display** — The `ScanForm` component displays a quota indicator (`X/10 scans used today`) and shows a "Limit reached" warning when exhausted.

Administrators can adjust per-user limits by updating the `daily_limit` column in the `scan_quotas` table directly.

#### Real Enrichment Data

All domain enrichment data is sourced from live external APIs — **no simulated or mocked data** exists in the application.

**RDAP (Registration Data Access Protocol)** — Modern replacement for WHOIS:
- Endpoint: `https://rdap.org/domain/{domain}`
- Returns: Registrar name, registration date, expiry date, last-changed date, nameservers, domain status flags
- Extracted from the RDAP JSON response structure (entities with `registrar` role, event actions for dates)

**IP Geolocation (ip-api.com)** — Free IP intelligence:
- Endpoint: `http://ip-api.com/json/{domain}`
- Returns: Resolved IP address, ISP, organization, ASN (number + name), country, region, city
- Accepts domain names directly (handles DNS resolution server-side)

**Risk Factors** — Computed locally from scan data:
- `hasLogin`: Detected if WordPress, Shopify, or Drupal are present
- `isEcommerce`: Detected if Shopify, Stripe, or Wix are present
- `usesCDN`: Detected if Cloudflare is present
- `surfaceSize`: Classified as `small` (<30 URLs), `medium` (30-100), or `large` (>100)

Both external API calls are wrapped in try-catch blocks with graceful fallback — if RDAP or ip-api.com is unreachable, the enrichment object still returns with an `error` field and `source` identifier, preventing scan pipeline failures.

Once the scan pipeline completes and findings are stored, users can request deeper analysis. The next two edge functions handle that — generating comprehensive AI reports and powering the interactive chatbot.

### 4.2 AI Threat Report Generator

**File**: `supabase/functions/analyze-threats/index.ts`

Generates comprehensive enterprise-grade AI threat intelligence reports. While the scan pipeline handles automated detection, this function adds the layer of AI reasoning — interpreting findings in context, estimating CVSS scores, mapping to OWASP categories, and building a prioritized remediation roadmap.

**Input**: `{ scanId }` → Fetches scan + findings from database using service role key

**AI Model**: `google/gemini-3-flash-preview` via Lovable AI Gateway (`https://ai.gateway.lovable.dev`)

**AI Prompt Structure**:
- System role: Principal Cybersecurity Analyst at a Fortune 500 firm
- Data provided: Full scan metadata, severity counts, category breakdown, technologies, enrichment (WHOIS, hosting, risk factors), security headers, all findings with details, attack surface metrics
- Output format: 11-section structured markdown report:
  1. Executive Summary
  2. Scope & Methodology
  3. Critical & High-Severity Findings (with CVSS estimates, CWE/OWASP refs)
  4. Medium & Low-Severity Findings (table format)
  5. Attack Surface Analysis (endpoints, tech stack, dependencies, forms)
  6. Security Headers Assessment
  7. Infrastructure & Hosting Analysis
  8. Remediation Roadmap (immediate → long-term)
  9. Compliance Considerations (GDPR, PCI-DSS, SOC 2)
  10. Risk Assessment Overview (with risk matrix)
  11. Conclusion

**Post-generation**: Report is stored in the `scans.ai_report` column.

**Error handling**: Returns specific error codes for rate limiting (429) and credit exhaustion (402).

The threat report provides a one-shot comprehensive analysis, but users often need to ask follow-up questions or drill into specific areas. That's where the interactive AI analyst comes in.

### 4.3 AI Surface Analyst (Chatbot & Insights)

**File**: `supabase/functions/analyze-surface/index.ts`

Powers both the interactive AI chatbot (`AiChatPanel`) and the one-click AI analysis buttons (`AiSurfaceInsight`). Unlike the threat report generator which produces a single monolithic report, this function is designed for targeted, conversational analysis — handling **7 different section types** with tailored prompts that focus on specific aspects of the scan data:

| Section | Source Component | Context Data | Analysis Focus |
|---------|-----------------|-------------|----------------|
| `security_headers` | `AiSurfaceInsight` | Header config object | Per-header risk assessment, exact remediation values |
| `endpoints` | `AiSurfaceInsight` | Discovered URLs (max 40) | Endpoint classification, high-risk paths, recon insights |
| `dependencies` | `AiSurfaceInsight` | External deps (max 30) | Supply chain risk, privacy concerns, Magecart scenarios |
| `raw_data` | `AiSurfaceInsight` | Raw crawl JSON (truncated 12KB) | Infrastructure overview, app fingerprint, data exposure |
| `surface_chat` | `AiChatPanel` (surface tab) | Full surface data + question | Free-form attack surface Q&A |
| `findings_chat` | `AiChatPanel` (findings tab) | All findings + question | Severity prioritization, remediation guidance |
| `raw_data_chat` | `AiChatPanel` (raw data tab) | Raw crawl data + question | Data interpretation and contextualization |

**AI Model**: `google/gemini-3-flash-preview` via Lovable AI Gateway

**System prompt**: Principal Cybersecurity Analyst specializing in web app security, pen testing, and threat intelligence. References OWASP, CWE, MITRE ATT&CK.

Before any of these analysis functions can run, though, the domain must first be approved. The fourth and final edge function acts as the gatekeeper that decides whether a scan should proceed at all.

### 4.4 AI Domain Policy Agent

**File**: `supabase/functions/evaluate-domain/index.ts`

The gatekeeper function that evaluates every scan request before execution. This is the first edge function called in any scan workflow — if it blocks the domain, none of the other functions ever fire.

```mermaid
flowchart TD
    Input["INPUT: domain"] --> A["Clean domain\nlowercase, strip protocol/path"]
    A --> B["Check domain_policies table\nfor existing policy"]
    B --> C{"Policy\nexists?"}
    C -- "YES" --> D["Return stored policy\n+ log to audit_log"]
    C -- "NO" --> E["AI Evaluation\nGemini 3 Flash Preview\nvia Lovable AI Gateway"]
    
    E --> F{"AI response\nparseable?"}
    F -- "YES" --> G{"Policy\ntype?"}
    F -- "NO" --> H["Fallback: review\nwith descriptive error reason"]
    
    G --> G1["ALLOW\nPublic sites, businesses,\nSaaS, education, open-source"]
    G --> G2["BLOCK\nMilitary .mil, intelligence,\ncritical infrastructure,\nhoneypots"]
    G --> G3["REVIEW\nAmbiguous, small gov,\nsuspicious TLDs"]
    
    G1 --> I["Store policy in\ndomain_policies table\nai_evaluated: true"]
    G2 --> I
    G3 --> I
    H --> I
    
    I --> J["Log to scan_audit_log\napproved / blocked / flagged"]
    J --> Output["OUTPUT:\nallowed, policy,\nreason, ai_evaluated"]
```

<p align="center"><em>Figure 2 — AI Domain Policy Agent: Evaluation Decision Flow</em></p>

**Step-by-step policy evaluation breakdown:**

1. **Domain Cleaning** — The input domain is normalized: converted to lowercase, and any protocol prefix (`https://`, `http://`) or trailing path (`/page/about`) is stripped, leaving only the bare hostname (e.g., `example.com`).
2. **Cache Check** — The function queries the `domain_policies` table for an existing policy matching the cleaned domain.
3. **Cache Hit Path** — If a policy already exists (either from a previous AI evaluation or a manual override), it is returned immediately without making any AI call. An audit log entry is written to `scan_audit_log` with the prefix `"Existing policy:"` followed by the cached reason.
4. **AI Evaluation (Cache Miss)** — For unknown domains, the function sends a classification request to **Gemini 3 Flash Preview** via the Lovable AI Gateway. The prompt defines three categories:
   - **ALLOW** — Public websites, businesses, SaaS products, educational institutions (`.edu`), open-source projects, news sites, and personal sites.
   - **BLOCK** — Military domains (`.mil`), intelligence agencies, critical infrastructure (power grids, water systems), healthcare patient portals, core banking systems, and law enforcement honeypots.
   - **REVIEW** — Ambiguous or sensitive targets, small government agencies, suspicious TLDs (`.onion`, `.tk`), and private-looking internal domains.
5. **AI Response Parsing** — The AI response is expected to be a JSON object with `policy` (`"allow"`, `"block"`, or `"review"`) and `reason` (a human-readable explanation). The function attempts to parse this from the response text.
6. **Parse Failure Fallback** — If the AI response cannot be parsed as valid JSON (malformed output, unexpected format), the function defaults to `review` with a descriptive error reason explaining what went wrong — e.g., `"AI evaluation returned an unparseable response. Please review this domain manually."`.
7. **HTTP Error Handling** — Specific HTTP error codes produce specific fallback reasons:
   - **429 (Rate Limited)** — `"The AI evaluation service is temporarily rate-limited. Please try again shortly or approve this domain manually."`
   - **402 (Credits Exhausted)** — `"AI evaluation credits have been exhausted. Please approve this domain manually."`
   - **Other errors** — Include the HTTP status code in the reason for debugging.
8. **Policy Storage** — The resulting policy (whether from AI or fallback) is inserted into the `domain_policies` table with `ai_evaluated: true` (or `false` for manual overrides done through the Policies page).
9. **Audit Logging** — An entry is written to `scan_audit_log` with the action (`approved`, `blocked`, or `flagged`) and the full reason text, prefixed with `"AI evaluation:"`.
10. **Output** — The function returns a JSON response with `allowed` (boolean), `policy` (the policy type string), `reason` (the explanation), and `ai_evaluated` (whether AI made the decision).

The edge functions above reference Firecrawl API calls extensively but only at a high level. The next section zooms into the scraping process itself — the specific API endpoints, request parameters, response structures, and data extraction logic that turn a domain name into structured security data.

### 4.5 CVE Lookup Engine

**File**: `supabase/functions/cve-lookup/index.ts`

Performs real-time vulnerability lookups against the **NIST National Vulnerability Database (NVD) 2.0 API** for each technology detected during the scan. This replaces passive-only analysis with active CVE correlation.

**Input**: `{ technologies: string[] }` — Array of detected technology names from the scan pipeline

**Process**:
1. **CPE Mapping** — Each technology is mapped to its Common Platform Enumeration (CPE) vendor/product pair via a built-in lookup table (e.g., `jQuery` → `jquery/jquery`, `WordPress` → `wordpress/wordpress`, `Nginx` → `f5/nginx`). Technologies without CPE mappings are skipped.
2. **NVD API Query** — For each mapped technology, a keyword search is performed against `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch={vendor}+{product}&resultsPerPage=10`. The NVD rate limit (5 requests per 30 seconds without an API key) is respected via a 6.5-second delay between requests.
3. **CVSS Extraction** — Each CVE result has its CVSS v3.1 (or v3.0 fallback) base score and severity extracted. If no CVSS data exists, severity is estimated from the score range (≥9 = critical, ≥7 = high, ≥4 = medium, <4 = low).
4. **Finding Generation** — CVE results are converted to ThreatLens findings with the category `Known CVEs`, including the CVE ID, description (truncated to 500 chars), CVSS score, published date, and up to 3 reference URLs.
5. **Integration** — The `firecrawl-scan` pipeline calls `cve-lookup` after generating passive findings and merges the CVE findings into the same deduplication + risk scoring pipeline.

**Output**: Up to 50 CVEs sorted by CVSS score (descending), plus metadata about which technologies were checked vs skipped.

**Supported Technologies** (CPE-mapped): jQuery, WordPress, React, Angular, Vue.js, Next.js, Bootstrap, Drupal, PHP, Nginx, ASP.NET, Shopify, HubSpot, Stripe

### 4.6 Scheduled Scan Runner

**File**: `supabase/functions/scheduled-scan-runner/index.ts`

Executes automated recurring scans on a configurable schedule. Triggered every hour by a `pg_cron` job that calls the function via `pg_net`.

**Process**:
1. **Fetch Due Schedules** — Queries the `scan_schedules` table for all enabled schedules where `next_run_at <= now()`.
2. **Execute Scans** — For each due schedule, internally calls the `firecrawl-scan` edge function with the scheduled domain.
3. **Update Schedule** — After each scan (success or failure), updates `last_run_at`, `last_scan_id`, and calculates `next_run_at` based on the frequency (`daily` = +24h, `weekly` = +7d, `biweekly` = +14d, `monthly` = +30d).
4. **Error Resilience** — If a scan fails, the schedule still advances its `next_run_at` to prevent infinite retry loops. Errors are logged but don't block other scheduled scans.

**Cron Configuration**: `0 * * * *` (every hour at minute 0) via `pg_cron` + `pg_net` HTTP POST to the function endpoint.

**`scan_schedules` Table**:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Schedule identifier |
| `user_id` | UUID | Owner of this schedule |
| `domain` | TEXT | Target domain |
| `frequency` | TEXT | `daily`, `weekly`, `biweekly`, `monthly` |
| `enabled` | BOOLEAN | Whether this schedule is active |
| `last_scan_id` | UUID (FK → scans) | Most recent scan produced |
| `last_run_at` | TIMESTAMPTZ | When last executed |
| `next_run_at` | TIMESTAMPTZ | When next execution is due |

### 4.7 Public REST API Gateway

**File**: `supabase/functions/api-gateway/index.ts`

Provides programmatic access to ThreatLens functionality via API keys, enabling CI/CD integration, SIEM workflows, and third-party automation.

**Authentication**: API key passed via `x-api-key` header. Keys are SHA-256 hashed before storage — only the prefix (`tl_XXXX...`) is stored in plaintext for identification. The full key is shown once at creation time and never stored.

**Endpoints**:

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/scan` | `scan:create` | Start a new scan. Body: `{ "domain": "example.com" }` |
| `GET` | `/scan/:id` | `scan:read` | Get scan details (status, risk score, technologies, enrichment) |
| `GET` | `/scan/:id/findings` | `scan:read` | Get all findings for a scan |
| `GET` | `/scans` | `scan:read` | List recent scans (query: `?limit=20`, max 100) |

**Permission Model**: Each API key has an array of permissions (`scan:create`, `scan:read`, `findings:read`). The gateway checks permissions before executing each request and returns HTTP 403 if insufficient.

**`api_keys` Table**:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Key identifier |
| `user_id` | UUID | Owner |
| `key_hash` | TEXT (UNIQUE) | SHA-256 hash of the full API key |
| `key_prefix` | TEXT | Display prefix (`tl_XXXX...`) |
| `name` | TEXT | User-assigned label |
| `permissions` | TEXT[] | Array of permission strings |
| `last_used_at` | TIMESTAMPTZ | Last API call timestamp |
| `expires_at` | TIMESTAMPTZ | Optional expiry date |

**Example Usage**:
```bash
# Start a scan
curl -X POST https://project.supabase.co/functions/v1/api-gateway/scan \
  -H "x-api-key: tl_YourKeyHere" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}'

# Get scan results
curl https://project.supabase.co/functions/v1/api-gateway/scan/{scanId} \
  -H "x-api-key: tl_YourKeyHere"

# Get findings
curl https://project.supabase.co/functions/v1/api-gateway/scan/{scanId}/findings \
  -H "x-api-key: tl_YourKeyHere"
```

---

## 5. Firecrawl Web Scraping Process

Firecrawl is the data acquisition engine at the heart of ThreatLens. The `firecrawl-scan` edge function uses two Firecrawl API endpoints — `/v1/scrape` for deep single-page extraction and `/v1/map` for broad site-wide URL discovery. This section details exactly what data is requested, what comes back, and how it's parsed into the structured format stored in the database.

### 5.1 Scraping Flow Diagram

```mermaid
flowchart TD
    Target["TARGET: https://example.com"] --> Scrape

    subgraph Scrape["FIRECRAWL /v1/scrape"]
        S1["Request:\nurl, formats: markdown + html + links\nonlyMainContent: false"]
        S2["Response:\ndata.html -- Raw HTML\ndata.links -- Discovered URLs\ndata.metadata -- HTTP headers\ndata.markdown -- Page content"]
        S1 --> S2
    end

    Scrape --> Map

    subgraph Map["FIRECRAWL /v1/map"]
        M1["Request:\nurl, limit: 200"]
        M2["Response:\nlinks -- Full site map URLs\n(non-blocking: continues if fails)"]
        M1 --> M2
    end

    Map --> Merge

    subgraph Merge["DATA MERGING AND PARSING"]
        P1["1. Deduplicate URLs\nfrom scrape.links + map.links\n2. Cap at 500 URLs"]
        P2["From merged URLs:\n- JS files (.js, .mjs, .jsx, .ts, .tsx)\n- External deps (diff hostname)\n- Endpoints (API patterns + query params)"]
        P3["From raw HTML:\n- Forms (action, method, inputs) -- max 20\n- Technologies (20 regex patterns)"]
        P4["From metadata:\n7 security headers:\nCSP, HSTS, X-Frame-Options,\nX-Content-Type-Options, X-XSS,\nReferrer-Policy, Permissions-Policy"]
        P1 --> P2
        P1 --> P3
        P1 --> P4
    end
```

<p align="center"><em>Figure 1 — Firecrawl Web Scraping Pipeline: Two-Phase Data Acquisition and Parsing</em></p>

**Step-by-step scraping breakdown:**

1. **Phase 1: Scrape Request** — The target URL is sent to Firecrawl's `/v1/scrape` endpoint with three requested formats: `markdown` (for readable page content), `html` (for raw DOM parsing), and `links` (for discovered hyperlinks). The `onlyMainContent: false` flag ensures the entire page is captured — including navigation bars, footers, sidebars, and hidden elements that may reveal security-relevant information.
2. **Scrape Response** — Firecrawl returns a data object containing:
   - `data.html` — The complete raw HTML of the page
   - `data.links` — An array of all discovered URLs (internal and external links found on the page)
   - `data.metadata` — HTTP response headers including security headers, content type, and server information
   - `data.markdown` — A markdown representation of the page content
3. **Phase 2: Map Request** — A second request is sent to `/v1/map` with `limit: 200` to discover additional URLs beyond the initial page. This endpoint follows sitemaps, internal links, and crawl paths to build a broader picture of the site's URL structure.
4. **Map Response (Non-Blocking)** — The map endpoint returns an array of discovered URLs. This call is wrapped in a try-catch — if it fails (timeout, rate limit, unsupported site), the pipeline continues with scrape data alone. No data is lost; the map simply provides additional URL coverage.
5. **URL Deduplication** — URLs from both sources (`scrape.links` + `map.links`) are merged into a single array and deduplicated using a `Set` to remove exact duplicates. The final list is capped at 500 URLs to prevent excessive data in the database.
6. **URL-Based Extraction** — From the merged URL list, three categories are filtered:
   - **JavaScript files** — URLs ending in `.js`, `.mjs`, `.jsx`, `.ts`, or `.tsx` are classified as client-side scripts that may expose API keys, internal routes, or business logic.
   - **External dependencies** — URLs whose hostname differs from the target domain are classified as third-party resources representing supply chain risk.
   - **Endpoints** — URLs containing query parameters (`?`) or matching API-like patterns (`/api/`, `/graphql/`, `/v1/`, `/admin/`, `/login/`, etc.) are classified as interactive endpoints.
7. **HTML-Based Extraction** — From the raw HTML, two categories are extracted:
   - **Forms** — Regex parsing identifies `<form>` tags, extracting action URLs, HTTP methods, and input field names. Capped at 20 forms to prevent data bloat.
   - **Technologies** — 20 regex patterns are matched against the HTML source to detect frameworks (React, Vue, Angular), CMSs (WordPress, Drupal), CDNs (Cloudflare), analytics (Google Analytics, GTM), and more.
8. **Metadata-Based Extraction** — From the Firecrawl response metadata, 7 critical security headers are checked. For each header, the present value is stored; missing headers are marked as `"Not Set"` — these missing headers become findings in the next pipeline stage.

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

Firecrawl provides the raw data, but it takes AI to turn that data into actionable intelligence. The next section covers how ThreatLens integrates with multiple AI models through a unified gateway, and why different functions use different models.

---

## 6. AI Integration

All three AI-powered edge functions use the **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`) for inference. No user API keys are required — the `LOVABLE_API_KEY` environment variable is auto-provisioned by Lovable Cloud. This unified gateway approach means all AI calls follow the same OpenAI-compatible API pattern, differing only in the model selected and the prompt constructed.

### 6.1 Models Used

As of February 2026, ThreatLens has been upgraded to use a **single unified model** across all three AI-powered edge functions: **`google/gemini-3-flash-preview`**. This is Google's next-generation Flash model, offering a strong balance of speed and capability that eliminates the need for a multi-model strategy. All functions — from simple domain classification to comprehensive threat reports — now use the same model, simplifying the codebase and ensuring consistent quality across all AI outputs.

| Function | Model | Use Case |
|----------|-------|----------|
| Domain Policy Evaluation | `google/gemini-3-flash-preview` | JSON classification (allow/block/review) |
| Threat Report Generation | `google/gemini-3-flash-preview` | Long-form structured markdown report with CVE/OWASP references |
| Interactive Chat & Surface Analysis | `google/gemini-3-flash-preview` | Multi-turn context-aware security analysis |

```mermaid
flowchart LR
    subgraph EdgeFunctions["Edge Functions"]
        EvalDomain["evaluate-domain"]
        AnalyzeThreats["analyze-threats"]
        AnalyzeSurface["analyze-surface"]
    end

    subgraph Gateway["Lovable AI Gateway\nhttps://ai.gateway.lovable.dev"]
        Model["Gemini 3\nFlash Preview"]
    end

    EvalDomain -- "classification\njson output" --> Model
    AnalyzeThreats -- "long-form\nthreat report" --> Model
    AnalyzeSurface -- "interactive\nchat + insights" --> Model
```

<p align="center"><em>Figure 1 — Unified AI Model Strategy: All Functions Use Gemini 3 Flash Preview</em></p>

**Step-by-step model strategy breakdown:**

1. **Unified Model Choice** — All three edge functions now use `google/gemini-3-flash-preview`, Google's next-generation Flash model. This simplifies the codebase by eliminating the need to select different models for different tasks — a single model string is used across the entire backend.
2. **`evaluate-domain`** — Performs domain classification (allow/block/review) by sending a structured prompt and expecting a JSON response. Gemini 3 Flash Preview handles this lightweight task with sub-second latency while maintaining high classification accuracy.
3. **`analyze-threats`** — Generates comprehensive, multi-section markdown reports requiring deep reasoning: CVSS score estimation, CWE/OWASP mapping, compliance assessment (GDPR, PCI-DSS, SOC 2), and prioritized remediation roadmaps. Gemini 3 Flash Preview delivers sufficient depth and accuracy for these complex outputs.
4. **`analyze-surface`** — Powers the interactive chatbot and one-click surface analysis. Users expect conversational response times when asking follow-up questions, and the model delivers substantive security analysis referencing OWASP, CWE, and MITRE ATT&CK frameworks with low latency.
5. **Unified Gateway** — All three functions access the model through the same Lovable AI Gateway endpoint (`https://ai.gateway.lovable.dev/v1/chat/completions`) using the same OpenAI-compatible request format. The only variable is the prompt — the `model` field is identical across all calls.

### 6.2 AI Gateway Integration

All edge functions use the same integration pattern:

```
Edge Function
  → POST https://ai.gateway.lovable.dev/v1/chat/completions
  → Headers: Authorization: Bearer ${LOVABLE_API_KEY}
  → Body: {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "..." },
        { role: "user", content: "..." }
      ]
    }
  → Response: { choices: [{ message: { content: string } }] }
```

**Authentication**: Uses `LOVABLE_API_KEY` environment variable (auto-provided by Lovable Cloud). This key is managed automatically — users never need to configure it.

**Error Handling**: All functions handle three error states:
- **429 Too Many Requests** — Rate limited; returns descriptive message to user
- **402 Payment Required** — Credits exhausted; surfaces billing guidance
- **Network/Parse errors** — Falls back gracefully with explanatory messages

The backend is only half the story — all of this data and AI analysis needs to be presented to the user through an intuitive interface. The next section covers the frontend components that render scans, findings, reports, and interactive analysis into a cohesive user experience.

---

## 7. Frontend Components

The React frontend is organized into seven page components and eight core components, all rendered within a shared layout that provides navigation, authentication state, and page transition animations. Each page maps to a specific step in the user workflow — from authentication to scanning to analysis to comparison — and leverages the API layer (covered in Section 13) to communicate with the backend.

### 7.1 Pages

#### `Auth.tsx` — Authentication
The entry point for all new and returning users. This page handles the full Google OAuth lifecycle:
- Tab-based Sign In / Sign Up UI with custom tab switcher (not shadcn tabs)
- Google OAuth via `lovable.auth.signInWithOAuth("google")`
- `auth_intent` stored in localStorage to distinguish signup vs signin after OAuth redirect
- Profile-based registration gate:
  - **Sign Up**: Creates a `profiles` row with `user_id`, email, display_name, avatar_url from Google metadata
  - **Sign In**: Checks for existing profile → rejects with "No account found" if missing
- Unauthorized users signed out with error toast
- Animated background with radial gradient

#### `Index.tsx` — Dashboard
Once authenticated, users land on the dashboard — the operational hub that provides an at-a-glance overview of scanning activity and serves as the primary entry point for new scans:
- Animated hero section with 3 concentric pulsing radar rings (Framer Motion)
- ThreatLens logo with pulse ring animation
- `ScanForm` component for domain input
- Stats grid (4 cards): Total Scans, Unique Domains, Vulnerabilities, Avg Risk
  - Avg Risk calculated only from **completed** scans (excludes failed/in-progress)
- Recent scans list (last 5) with staggered entry animations
- Risk distribution sidebar — scans bucketed by risk score ranges (≥75 critical, ≥50 high, ≥25 medium, >0 low, 0 info)
- Technology fingerprint cloud — top 8 technologies across all scans with occurrence counts

<p align="center">
  <img src="https://i.imgur.com/PRMxinn.png" alt="ThreatLens Dashboard" width="900" />
</p>
<p align="center"><em>Figure 1 — Dashboard — Hero section with scan form, stats grid, recent scans, risk distribution, and technology cloud</em></p>

The most complex page in the application — where the bulk of scan intelligence is consumed. Users navigate here after initiating a scan or clicking a scan from the dashboard/history. It's organized into **four tabs** that separate concerns:

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

<p align="center">
  <img src="https://i.imgur.com/ixhNJwz.png" alt="Scan Detail - Findings Tab" width="900" />
</p>
<p align="center"><em>Figure 2 — Scan Detail — Header stats, severity guide, domain enrichment, and Findings tab with severity-coded finding cards</em></p>

**Tab 2: Attack Surface**
- Attack Surface Summary table (5 rows: Security Headers, Endpoints, External Deps, JS Files, Input Vectors) with count, status, and risk implication
- AI Chat Panel (surface context)
- 4 clickable stat cards that scroll to detail sections (with tooltips explaining security implications)
- Technology Stack display (chips with primary styling)
- Security Headers table (green dot = set, red dot = missing, truncated values)
- Discovered Endpoints scrollable list
- JS Files and Forms side-by-side grid
- External Dependencies scrollable list

<p align="center">
  <img src="https://i.imgur.com/9YGmSm4.png" alt="Attack Surface - Summary and AI Chat" width="900" />
</p>
<p align="center"><em>Figure 3 — Attack Surface tab — Summary table, AI Threat Analyst chat with per-header analysis, and stat cards</em></p>

<p align="center">
  <img src="https://i.imgur.com/PS0KN01.png" alt="Attack Surface - Security Headers and Endpoints" width="900" />
</p>
<p align="center"><em>Figure 4 — Attack Surface tab — Technology stack, security headers table (red = missing), and discovered endpoints</em></p>

**Tab 3: AI Report**
- Generate button (if no report exists)
- Rendered markdown report with `renderMarkdown()` parser
- Copy Report and Download PDF buttons

**Tab 4: Raw Data**
- AI Chat Panel (raw_data context)
- Full raw crawl data displayed as formatted JSON in a scrollable `<pre>` block

<p align="center">
  <img src="https://i.imgur.com/7imT3Tb.png" alt="Raw Data tab with AI Analyst" width="900" />
</p>
<p align="center"><em>Figure 5 — Raw Data tab — AI Threat Analyst providing intelligence briefing on raw crawl data, with JSON viewer below</em></p>

#### `History.tsx` — Scan History
While the dashboard shows the 5 most recent scans, the History page provides a complete chronological view with management capabilities:
- Chronological list of all scans
- Each scan shows: domain, timestamp, URL count, findings count, status badge, risk score
- Delete button with AlertDialog confirmation
- Cascading delete: findings first, then scan record
- Staggered entry animations

#### `Compare.tsx` — Scan Comparison
For organizations scanning the same domain periodically, the Compare page enables structured delta analysis between any two completed scans. It is designed to give analysts an immediate, actionable view of what changed between scan intervals.

**Scan Selection**:
- Two Select dropdowns filter to completed scans only, with mutual exclusion (can't compare a scan with itself)
- Each selector card displays rich metadata once chosen: domain, exact scan timestamp, risk score, finding count, endpoint count, and technology count — so analysts can confirm they've selected the right pair before reviewing the diff
- Parallel data loading with `Promise.all` fetches both scan records and their findings simultaneously

**Executive Summary** (4-card grid):
- **Risk Score** — A → B with delta indicator (green = improvement, red = regression)
- **Findings** — Total vulnerability count with directional delta
- **Endpoints** — Discovered URL count with inverted delta logic (more = larger attack surface)
- **Technologies** — Stack size with inverted delta logic
- Each card includes an info tooltip explaining what the metric means for the analyst

**Risk Score Change** (detailed):
- Color-coded risk level cards for both scans (Critical ≥75, High ≥50, Medium ≥25, Low <25) with large numeric display
- Prominent delta indicator with contextual label: "RISK INCREASED" (red), "RISK DECREASED" (green), or "NO CHANGE"
- **What Drove This Change** — Auto-generated plain-language explanation listing severity-level shifts (e.g., "2 new critical findings detected", "1 high finding no longer detected")
- **How to Read This** — Inline explainer showing the scoring formula (`Critical×25 + High×15 + Medium×8 + Low×3 + Info×1`, capped at 100) with a contextual interpretation of the delta direction
- **Severity Breakdown** — Per-severity bar chart comparison (critical → info), showing A and B counts side-by-side with progress bars and delta indicators. Allows analysts to see whether the risk shift is driven by new critical findings or just informational noise

**Finding Delta** (3-column card):
- **Newly Detected** — Findings present in the current scan but absent from the baseline, shown with severity badge, title, and category, highlighted with an "Investigate" tag. Contextual note explains these represent new attack vectors or previously hidden surfaces
- **No Longer Detected** — Findings present in the baseline but absent from the current scan. Explicitly noted as *not confirmed remediation* — the target may have patched, reconfigured, added authentication, or the finding may be intermittent
- **Still Present** — Findings detected in both scans, indicating the target's attack surface still exposes these weaknesses
- Matching logic: findings are diffed by title (exact string match)
- Each finding card shows both severity badge and category label for faster triage
- This terminology deliberately avoids "resolved" or "unresolved" since the app performs passive reconnaissance, not vulnerability management

**Technology Stack Changes**:
- Grouped into three labeled sections: Added (green + border), Removed (red − border), Unchanged (neutral chips)
- Contextual description explains that added technologies expand the attack surface while removed ones may indicate decommissioning

**Endpoint Changes** (2-column grid):
- **New Endpoints** — URLs in B but not A, described as "potential new attack vectors", capped at 30 with "+N more" overflow
- **Removed Endpoints** — URLs in A but not B, described as "possibly decommissioned services"
- **Unchanged summary** — Footer line showing how many endpoints are stable between scans

**AI Analyst Chatbot** (compare context):
- An `AiChatPanel` instance is rendered at the bottom of the comparison view, scoped to the `compare` context
- Context data passed includes both scan summaries, the full finding delta (newly detected, no longer detected, still present), technology diff, and endpoint counts
- Suggested questions: "Explain the risk score change in plain language", "What are the most concerning newly detected findings?", "Has the attack surface expanded or contracted?", "What infrastructure changes should the analyst investigate?"
- The `compare_chat` handler in the `analyze-surface` edge function is instructed to respect passive recon semantics — it will never claim a finding is "fixed" just because it's no longer detected
- Uses `google/gemini-3-flash-preview` via the Lovable AI Gateway

<p align="center">
  <img src="https://i.imgur.com/jwj3GTB.png" alt="Scan Comparison — Executive Summary & Risk Score" width="900" />
</p>
<p align="center"><em>Figure 6 — Scan Comparison — Executive summary, risk score change with scoring formula explainer, and per-severity breakdown</em></p>

<p align="center">
  <img src="" alt="Scan Comparison — Finding Delta Triage" width="900" />
</p>
<p align="center"><em>Figure 7 — Scan Comparison — Finding Delta triage view with three-column layout: Newly Detected findings (new attack surface observed in latest scan), No Longer Detected findings (previously observed issues not found in latest scan — may indicate remediation or scan variance), and Still Present findings (persistent vulnerabilities across both scans requiring continued attention)</em></p>

<p align="center">
  <img src="https://i.imgur.com/5ZJoqK6.png" alt="Scan Comparison — Technology Changes & AI Analyst" width="900" />
</p>
<p align="center"><em>Figure 8 — Scan Comparison — Technology stack changes, new/removed endpoint lists, and AI Threat Analyst chatbot demonstrating domain mismatch detection, MITRE ATT&CK / CWE references, and principal remediation recommendations</em></p>


#### `Policies.tsx` — Domain Policy Management
This page is the human override layer on top of the AI policy agent — allowing administrators to manually approve, block, or flag domains, and review the full audit trail:
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

<p align="center">
  <img src="https://i.imgur.com/gyo02jq.png" alt="Domain Policies Page" width="900" />
</p>
<p align="center"><em>Figure 9 — Domain Policies — Stats cards, manual policy form, policy list with AI-evaluated indicators, and immutable audit log</em></p>

#### `NotFound.tsx` — 404 Page
- Centered layout with "404" heading, "Page not found" message, and link back to home
- Logs 404 errors to console with the attempted pathname

### 7.2 Core Components

Beyond the page components, several reusable components provide shared functionality across multiple pages. These handle everything from domain input to AI interaction to data visualization.

#### `AiChatPanel.tsx`
The interactive AI analyst interface that appears on the ScanDetail page — providing conversational access to the `analyze-surface` edge function:
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
Complements the chatbot with one-click AI analysis for specific attack surface sections:
- Supports 4 section types: `security_headers`, `endpoints`, `dependencies`, `raw_data`
- Renders analysis results inline with basic markdown parsing (headers, bold, bullets, numbered lists)
- Calls `onAnalysis` callback to pass results up to ScanDetail for PDF inclusion

#### `ScanForm.tsx`
The domain input component used on both the Dashboard and (implicitly) in the scan workflow:
- Domain input with Globe icon prefix
- Two-phase submit flow:
  1. `evaluateDomain()` — checks AI policy agent
  2. `startScan()` — only if domain is allowed
- Policy status badge (green = allow, red = block, amber = review) with AI reasoning text
- Blocks scan if domain is blocked or under review (shows destructive toast with "Go to Policies" action button)
- Navigates to `/scan/{scanId}` on success

#### `AuthProvider.tsx`
The authentication context that wraps the entire application:
- React context providing `session`, `loading`, and `signOut`
- Sets up `onAuthStateChange` listener **before** calling `getSession()` (proper Supabase pattern to avoid race conditions)
- Provides context to entire app via `useAuth()` hook

#### `RiskScoreBreakdown.tsx`
A detailed visualization of how a scan's risk score was calculated:
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
Provides smooth visual transitions between pages using Framer Motion:
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

The frontend components above rely on an authenticated session to function — the `AuthProvider` context, the `ProtectedRoute` wrapper, and the profile-based registration gate all work together to ensure only registered users can access the platform. The next section dives deeper into exactly how that authentication system works end-to-end.

---

## 8. Authentication System

Authentication is the first thing a user encounters and the last line of defense against unauthorized access. ThreatLens uses Google OAuth through Lovable Cloud, but adds a custom **profile-based registration gate** on top — meaning that having a Google account alone isn't enough to access the platform. Users must explicitly sign up, which creates a `profiles` row, before they can sign in on subsequent visits.

### 8.1 Auth Flow Diagram

```mermaid
flowchart TD
    A["User visits app"] --> B["AuthProvider:\nonAuthStateChange + getSession"]
    B --> C{"Session\nexists?"}
    C -- "YES" --> D["Render protected routes"]
    C -- "NO" --> E["ProtectedRoute:\nRedirect to /auth"]
    E --> F["User sees\nSign In / Sign Up tabs"]
    F --> G["User clicks Google button"]
    G --> H["localStorage.setItem\nauth_intent = signin or signup"]
    H --> I["lovable.auth.signInWithOAuth\ngoogle, redirect_uri"]
    I --> J["Google OAuth consent\nredirect back to app"]
    J --> K["onAuthStateChange fires\nwith new session"]
    K --> L["handlePostAuth()"]
    L --> M["Check profiles table\nfor user_id"]
    M --> N{"Profile\nexists?"}
    N -- "YES" --> O["Navigate to /"]
    N -- "NO" --> P{"auth_intent\n=== signup?"}
    P -- "YES" --> Q["Insert profile\nemail, display_name, avatar_url"]
    Q --> R["localStorage.removeItem\nauth_intent"]
    R --> O
    P -- "NO" --> S["signOut()\ntoast: No account found"]
```

<p align="center"><em>Figure 1 — Authentication Flow: Google OAuth with Profile-Based Registration Gate</em></p>

**Step-by-step authentication breakdown:**

1. **App Load** — When the user visits any page, the `AuthProvider` component (which wraps the entire app) initializes by setting up an `onAuthStateChange` listener and then calling `getSession()`. The listener is registered *before* `getSession()` to avoid race conditions where a session change event fires before the listener is ready.
2. **Session Check** — If a valid session exists (the user is already logged in), all protected routes render normally. The user sees the dashboard, scan detail, history, etc.
3. **No Session → Redirect** — If no session exists, the `ProtectedRoute` wrapper intercepts the route render and redirects the user to `/auth`.
4. **Auth Page Display** — The user sees a tab-based UI with "Sign In" and "Sign Up" tabs. Both tabs display a "Continue with Google" button, but the tab choice determines what happens *after* the OAuth flow.
5. **Intent Storage** — Before initiating the OAuth redirect, the app stores `auth_intent` ("signin" or "signup") in `localStorage`. This is critical because the Google OAuth redirect causes a full page reload, losing all React state — `localStorage` persists across the redirect.
6. **OAuth Redirect** — The app calls `lovable.auth.signInWithOAuth("google")` with a `redirect_uri` pointing back to the app. The user is redirected to Google's consent screen.
7. **Google Consent** — The user authenticates with Google and grants permissions. Google redirects back to the app with auth tokens in the URL hash.
8. **Session Established** — The `onAuthStateChange` listener fires with the new session containing the user's Google metadata (email, display name, avatar URL, user ID).
9. **Post-Auth Handler** — The `handlePostAuth()` function runs, checking the `profiles` table for a row matching the user's `user_id`.
10. **Profile Exists (Returning User)** — If a profile row exists, the user is navigated to the dashboard (`/`) regardless of whether they clicked "Sign In" or "Sign Up". The `auth_intent` is cleared from `localStorage`.
11. **No Profile + Signup Intent (New User)** — If no profile exists and `auth_intent === "signup"`, a new row is inserted into the `profiles` table with the user's `user_id`, `email`, `display_name`, and `avatar_url` extracted from `session.user.user_metadata`. After successful insertion, the user is navigated to the dashboard.
12. **No Profile + Signin Intent (Rejected)** — If no profile exists and `auth_intent === "signin"` (or is missing), the user is immediately signed out via `supabase.auth.signOut()`, and a destructive toast displays "No account found. Please sign up first." This prevents unregistered users from accessing the platform even if they have a valid Google account.

### 8.2 Session Management

- **AuthProvider** creates a React context with `session`, `loading`, `signOut`
- `onAuthStateChange` is registered before `getSession()` per Supabase best practices
- `signOut()` calls `supabase.auth.signOut()` and clears session state to `null`
- Session is checked on every protected route via `ProtectedRoute` wrapper
- User avatar + email shown in header Popover (from `session.user.user_metadata`)
- Loading spinner shown while auth state is being determined

Once authenticated, users interact with scan results — and the most prominent metric they encounter is the risk score. The next section explains exactly how that score is calculated from individual findings.

---

## 9. Risk Scoring Algorithm

Every completed scan produces a single composite risk score between 0 and 100. This score serves as the primary metric across the platform — it's displayed on the dashboard, in scan history, on the detail page, in comparisons, and in PDF reports. The algorithm is intentionally simple and transparent, so users can understand exactly why a domain received its score.

### Scoring Formula

```mermaid
flowchart LR
    Findings["All Findings"] --> Critical["Critical\n25 pts each"]
    Findings --> High["High\n15 pts each"]
    Findings --> Medium["Medium\n8 pts each"]
    Findings --> Low["Low\n3 pts each"]
    Findings --> Info["Info\n1 pt each"]
    
    Critical --> Sum["Sum all\npoints"]
    High --> Sum
    Medium --> Sum
    Low --> Sum
    Info --> Sum
    
    Sum --> Cap["min(total, 100)"]
    Cap --> Score["Risk Score\n0 - 100"]
```

<p align="center"><em>Figure 1 — Risk Score Calculation: Weighted Severity Sum Capped at 100</em></p>

**Step-by-step scoring breakdown:**

1. **Collect All Findings** — After the finding generation phase completes, all findings for the scan are retrieved from the `findings` table.
2. **Group by Severity** — Findings are grouped into five severity buckets: `critical`, `high`, `medium`, `low`, and `info`.
3. **Apply Weights** — Each severity level has a fixed point value reflecting its potential impact:
   - **Critical** = 25 points per finding (e.g., exposed `.env` files, database admin panels)
   - **High** = 15 points per finding (e.g., missing CSP header, admin panel detected)
   - **Medium** = 8 points per finding (e.g., missing HSTS, WordPress detected, XSS input points)
   - **Low** = 3 points per finding (e.g., jQuery detected, excessive external dependencies)
   - **Info** = 1 point per finding (informational observations)
4. **Calculate Raw Total** — Multiply each severity count by its weight and sum: `(critical × 25) + (high × 15) + (medium × 8) + (low × 3) + (info × 1)`.
5. **Cap at 100** — The raw total is capped using `Math.min(total, 100)`. This ensures the score remains on a normalized 0–100 scale regardless of how many findings exist.
6. **Example Calculation** — A scan with 2 critical findings (50pts), 1 high (15pts), and 3 medium (24pts) produces a raw total of 89, resulting in a risk score of **89**. A scan with 5 critical findings (125pts raw) would be capped at **100**.

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

Risk scores, findings, and AI analysis are all valuable in the browser — but security professionals often need to share results with stakeholders who don't have platform access. That's where the PDF export engine comes in.

---

## 10. PDF Export Engine

**File**: `src/lib/pdf-export.ts`

The PDF export engine transforms a scan's complete intelligence — findings, risk scores, AI reports, and surface analysis — into a professional, branded document suitable for executive briefings, compliance audits, and client deliverables. It runs entirely client-side using jsPDF, requiring no backend involvement.

The generated report follows this structure:

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

The PDF report mirrors the visual language of the application itself — the same dark background, purple accents, and severity color coding. That visual consistency is powered by a comprehensive design system, which the next section documents in full.

---

## 11. Design System & Styling

ThreatLens's visual identity is built on a dark-mode-only design system with cybersecurity-themed aesthetics — deep navy backgrounds, purple primary accents, teal secondary accents, and severity-coded colors that carry consistent meaning across every component. All styling is implemented through CSS custom properties (design tokens) consumed by Tailwind utility classes, ensuring that visual changes propagate globally from a single source of truth.

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

Beyond the standard Tailwind utilities, several custom CSS classes provide the platform's signature visual effects:

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

A beautiful interface is meaningless without proper security controls. The design system ensures visual consistency, but the security architecture ensures data integrity and access control — which is what the next section covers.

---

## 12. Security Architecture

Security in ThreatLens operates at two levels: **data-level security** through Row Level Security policies on the database, and **application-level security** through the AI domain policy agent and edge function access controls. Together, they ensure that users can only access their own profile data, that scan data is shared transparently, and that the scanning capabilities themselves cannot be weaponized against sensitive targets.

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

The AI policy agent enforces responsible use at the application level:
- **Blocked categories**: Military (.mil), intelligence agencies, critical infrastructure, healthcare patient portals, core banking systems, law enforcement honeypots
- **Auto-allowed**: Public websites, businesses, SaaS products, educational institutions, open-source projects, news sites, personal sites
- **Flagged for review**: Ambiguous or potentially sensitive targets, small government agencies, suspicious TLDs, private-looking internal domains
- All decisions logged immutably in `scan_audit_log` with timestamped action and reason
- Manual override available via Policies page (inline type changer or delete + re-add)

### Edge Function Security

- `firecrawl-scan`, `analyze-threats`, `analyze-surface`: JWT verification disabled (`verify_jwt = false` in `config.toml`) — accessible without auth token
- `evaluate-domain`: Not listed in config.toml — uses default settings
- All functions use CORS headers allowing all origins
- `firecrawl-scan` uses `SUPABASE_SERVICE_ROLE_KEY` for database writes
- `evaluate-domain` uses `SUPABASE_SERVICE_ROLE_KEY` for database writes + `LOVABLE_API_KEY` for AI
- `analyze-threats` and `analyze-surface` use `LOVABLE_API_KEY` for AI gateway access

The security architecture protects the backend, but the frontend also needs a clean abstraction to interact with it. The API layer provides that bridge — translating user actions into database queries and edge function invocations.

---

## 13. API Layer

**File**: `src/lib/api.ts`

The API layer is the single point of contact between the React frontend and the Lovable Cloud backend. Rather than scattering Supabase calls throughout page components, all data operations are centralized in this module — making it easy to trace data flow, modify query logic, and maintain type safety across the application.

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

This API layer completes the full-stack picture — from the database schema (Section 3) through edge functions (Section 4) to the frontend components (Section 7) and now the client-side abstraction that ties them together.

Beyond the frontend API layer, ThreatLens also exposes a public REST API for programmatic access — documented in the next section.

---

## 13.1 REST API (Programmatic Access)

**File**: `supabase/functions/api-gateway/index.ts`

The REST API gateway enables external tools, scripts, and CI/CD pipelines to interact with ThreatLens without the web UI. Authentication uses SHA-256 hashed API keys passed via the `x-api-key` header. Keys are generated from the **Settings → API Keys** tab in the dashboard.

### Use Cases

- A **DevOps pipeline** that automatically scans your production domain after every deployment
- A **Python script** that pulls scan findings into a Slack channel or SIEM
- A **third-party tool** that triggers scans and reads results via HTTP
- A **monitoring dashboard** that polls scan status and aggregates risk scores across domains

### Authentication

All requests require the `x-api-key` header. The gateway hashes the provided key with SHA-256 and looks it up in the `api_keys` table. If the key is missing, invalid, or expired, the request is rejected with `401 Unauthorized`.

```
x-api-key: tl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Key properties stored in the database:**

| Field | Description |
|-------|-------------|
| `key_hash` | SHA-256 hash of the raw key (raw key is never stored) |
| `key_prefix` | First 7 characters (e.g., `tl_abc1`) for identification in the UI |
| `permissions` | Array of permission strings: `scan:create`, `scan:read`, `findings:read` |
| `expires_at` | Optional expiry timestamp (null = never expires) |
| `last_used_at` | Updated on every successful request |

### Endpoints

#### `POST /scan` — Start a New Scan

Triggers the full scan pipeline (domain evaluation → Firecrawl scrape → analysis → findings generation).

**Permission required**: `scan:create`

**Request body:**
```json
{
  "domain": "example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "scanId": "79a2def6-f88b-4cf8-b95b-f82c03769b00",
  "urlsFound": 47,
  "findingsCount": 12,
  "riskScore": 62
}
```

**Response (400 — missing domain):**
```json
{
  "error": "domain is required in request body"
}
```

**Example:**
```bash
curl -X POST https://your-url/functions/v1/api-gateway/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: tl_your_key_here" \
  -d '{"domain": "example.com"}'
```

---

#### `GET /scan/:id` — Get Scan Details

Returns the full scan record including status, risk score, technologies, and enrichment data.

**Permission required**: `scan:read`

**Response (200):**
```json
{
  "id": "79a2def6-f88b-4cf8-b95b-f82c03769b00",
  "domain": "example.com",
  "status": "completed",
  "risk_score": 62,
  "urls_found": 47,
  "vulnerabilities_found": 12,
  "technologies": ["React", "Nginx", "Google Analytics"],
  "enrichment": {
    "whois": { "registrar": "...", "created": "..." },
    "hosting": { "ip": "...", "country": "US", "isp": "..." },
    "riskFactors": ["High URL count", "Multiple external dependencies"]
  },
  "error_message": null,
  "created_at": "2026-02-25T10:30:00Z",
  "updated_at": "2026-02-25T10:31:45Z"
}
```

**Response (404):**
```json
{
  "error": "Scan not found"
}
```

**Example:**
```bash
curl -H "x-api-key: tl_your_key_here" \
  https://your-url/functions/v1/api-gateway/scan/79a2def6-f88b-4cf8-b95b-f82c03769b00
```

---

#### `GET /scan/:id/findings` — Get Findings for a Scan

Returns all vulnerability findings for a specific scan, ordered by newest first.

**Permission required**: `findings:read`

**Response (200):**
```json
{
  "scanId": "79a2def6-f88b-4cf8-b95b-f82c03769b00",
  "findings": [
    {
      "id": "a1b2c3d4-...",
      "title": "Missing Content-Security-Policy Header",
      "description": "The server does not set a CSP header, allowing potential XSS attacks.",
      "severity": "high",
      "category": "Security Headers",
      "details": {
        "header": "Content-Security-Policy",
        "recommendation": "Add a strict CSP header to prevent inline script execution."
      },
      "created_at": "2026-02-25T10:31:00Z"
    }
  ],
  "count": 12
}
```

**Example:**
```bash
curl -H "x-api-key: tl_your_key_here" \
  https://your-url/functions/v1/api-gateway/scan/SCAN_ID/findings
```

---

#### `GET /scans` — List Recent Scans

Returns a paginated list of recent scans (default 20, max 100).

**Permission required**: `scan:read`

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 20 | Max results (capped at 100) |

**Response (200):**
```json
{
  "scans": [
    {
      "id": "79a2def6-...",
      "domain": "example.com",
      "status": "completed",
      "risk_score": 62,
      "urls_found": 47,
      "vulnerabilities_found": 12,
      "created_at": "2026-02-25T10:30:00Z"
    }
  ],
  "count": 1
}
```

**Example:**
```bash
curl -H "x-api-key: tl_your_key_here" \
  "https://your-url/functions/v1/api-gateway/scans?limit=50"
```

---

### Error Responses

All error responses follow a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Cause |
|--------|-------|
| `400` | Missing required field (e.g., `domain`) |
| `401` | Missing, invalid, or expired API key |
| `403` | Key lacks required permission |
| `404` | Scan not found or unknown endpoint |
| `500` | Internal server error or upstream failure |

### Security Model

- **Key hashing**: Raw keys are never stored. Only the SHA-256 hash is persisted in the `api_keys` table.
- **Permission scoping**: Each key carries an array of permissions (`scan:create`, `scan:read`, `findings:read`). The gateway checks the required permission for each endpoint before executing.
- **Expiry enforcement**: Keys with an `expires_at` timestamp are rejected after expiry.
- **Usage tracking**: `last_used_at` is updated on every successful authentication, visible in the Settings UI.
- **Service role isolation**: The gateway uses `SUPABASE_SERVICE_ROLE_KEY` internally to bypass RLS, but external callers never see this key — they only interact via their scoped API key.

---

## 14. Elasticsearch Integration

ThreatLens integrates with Elastic Cloud to provide enterprise-grade full-text search, log aggregation, and analytics capabilities beyond what PostgreSQL offers natively. Every completed scan is automatically synchronized to three Elasticsearch indices, enabling sub-second fuzzy search across all historical findings, Kibana-powered dashboards for threat trend analysis, and an in-app global search command palette (⌘K) for instant cross-scan discovery.

### 14.1 Architecture Overview

```mermaid
flowchart TD
    subgraph ScanPipeline["Scan Pipeline"]
        Scan["firecrawl-scan\nCompletes scan"] --> DB["PostgreSQL\nscans + findings"]
    end

    DB --> Sync["elasticsearch-sync\nEdge Function"]

    Sync --> I1["threatlens-scans\nDomain metadata"]
    Sync --> I2["threatlens-findings\nVulnerability records"]
    Sync --> I3["threatlens-audit\nEvent log"]

    subgraph Elastic["ELASTIC CLOUD"]
        I1
        I2
        I3
    end

    subgraph Consumers["CONSUMERS"]
        SearchFn["elasticsearch-search\nEdge Function"]
        Kibana["Kibana\nDashboards + Discover"]
    end

    Elastic --> SearchFn
    Elastic --> Kibana

    SearchFn --> GlobalSearch["Global Search UI\n(Cmd+K)"]
```

<p align="center"><em>Figure 1 — Elasticsearch Integration Architecture: Sync, Search, and Analytics</em></p>

**Step-by-step architecture breakdown:**

1. **Trigger** — When the `firecrawl-scan` edge function completes a scan and writes results to PostgreSQL, it calls the `elasticsearch-sync` edge function with the `scanId`.
2. **Sync** — The sync function fetches the scan record and all associated findings from PostgreSQL, then indexes them into three Elasticsearch indices with typed mappings.
3. **Consumers** — Two systems consume the indexed data: the `elasticsearch-search` edge function (powering the in-app Global Search) and Kibana (for dashboards, Discover, and alerting).

### 14.2 Index Schema

Three custom indices store different aspects of scan intelligence. Each index is created with explicit mappings on first sync via the `ensureIndex()` helper — if the index already exists, the mapping step is skipped.

#### `threatlens-scans` — Domain Scan Metadata

| Field | ES Type | Source |
|-------|---------|--------|
| `domain` | `keyword` | `scans.domain` |
| `status` | `keyword` | `scans.status` |
| `risk_score` | `integer` | `scans.risk_score` |
| `urls_found` | `integer` | `scans.urls_found` |
| `vulnerabilities_found` | `integer` | `scans.vulnerabilities_found` |
| `technologies` | `keyword` | `scans.technologies` (array) |
| `created_at` | `date` | `scans.created_at` |
| `updated_at` | `date` | `scans.updated_at` |
| `user_id` | `keyword` | `scans.user_id` |
| `ai_report` | `text` (standard analyzer) | `scans.ai_report` |

Documents are indexed using the scan UUID as the document ID (`PUT threatlens-scans/_doc/{scanId}`), ensuring upsert behavior on re-sync.

#### `threatlens-findings` — Vulnerability Records

| Field | ES Type | Source |
|-------|---------|--------|
| `scan_id` | `keyword` | `findings.scan_id` |
| `domain` | `keyword` | Denormalized from parent scan |
| `title` | `text` + `keyword` sub-field | `findings.title` |
| `description` | `text` (standard analyzer) | `findings.description` |
| `severity` | `keyword` | `findings.severity` |
| `category` | `keyword` | `findings.category` |
| `details` | `object` (disabled indexing) | `findings.details` JSONB |
| `created_at` | `date` | `findings.created_at` |

Findings are bulk-indexed using the Elasticsearch `_bulk` API with NDJSON format for efficiency. Each finding uses its UUID as the document ID.

The `title` field has a dual mapping: a `text` type for full-text search (tokenized, analyzed) and a `keyword` sub-field for exact match aggregations and sorting.

#### `threatlens-audit` — Event Log

| Field | ES Type | Source |
|-------|---------|--------|
| `event_type` | `keyword` | Always `"scan_completed"` |
| `domain` | `keyword` | `scans.domain` |
| `scan_id` | `keyword` | `scans.id` |
| `user_id` | `keyword` | `scans.user_id` |
| `risk_score` | `integer` | `scans.risk_score` |
| `findings_count` | `integer` | Count of findings |
| `technologies` | `keyword` | `scans.technologies` (array) |
| `timestamp` | `date` | `new Date().toISOString()` (sync time) |

Audit documents use auto-generated IDs (`POST threatlens-audit/_doc`) since they are append-only event records — each sync creates a new audit entry even if the same scan is re-synced.

### 14.3 Data Sync Pipeline

**File**: `supabase/functions/elasticsearch-sync/index.ts`

The sync edge function is the bridge between PostgreSQL and Elasticsearch. It reads from the database, ensures indices exist with correct mappings, and writes documents to Elastic Cloud using Basic Auth over HTTPS.

```mermaid
flowchart TD
    A["INPUT: scanId"] --> B["Fetch scan + findings\nfrom PostgreSQL\n(parallel queries)"]
    B --> C["ensureIndex()\nthreatlens-scans\n(HEAD check, create if 404)"]
    C --> D["ensureIndex()\nthreatlens-findings"]
    D --> E["ensureIndex()\nthreatlens-audit"]
    E --> F["PUT scan document\nthreatlens-scans/_doc/scanId"]
    F --> G{"Findings\nexist?"}
    G -- "YES" --> H["Bulk index findings\n_bulk API (NDJSON format)"]
    G -- "NO" --> I["Skip findings"]
    H --> J["POST audit entry\nthreatlens-audit/_doc"]
    I --> J
    J --> K["OUTPUT:\nscan: 1, findings: N, audit: 1"]
```

<p align="center"><em>Figure 2 — Elasticsearch Sync Pipeline: Database to Index</em></p>

**Step-by-step sync breakdown:**

1. **Input** — The function receives a `scanId` in the request body.
2. **Database Fetch** — Two parallel queries fetch the scan record and its findings from PostgreSQL using the service role key (bypasses RLS).
3. **Index Provisioning** — Three `ensureIndex()` calls check for index existence via `HEAD /{index}`. If a 404 is returned, the index is created with explicit field mappings via `PUT /{index}`. If the index already exists, the step is a no-op.
4. **Scan Indexing** — The scan document is indexed with `PUT threatlens-scans/_doc/{scanId}`, using the scan ID as the document ID for idempotent upserts.
5. **Findings Bulk Index** — If findings exist, they are formatted as NDJSON (alternating action/document lines) and submitted via `POST _bulk` with `Content-Type: application/x-ndjson`. Each finding includes a denormalized `domain` field copied from the parent scan.
6. **Audit Entry** — A `scan_completed` audit event is appended to `threatlens-audit` with the current timestamp, scan metadata, and finding count.
7. **Output** — The function returns counts of indexed documents: `{ scan: 1, findings: N, audit: 1 }`.

**Required secrets:**

| Secret | Purpose |
|--------|---------|
| `ELASTICSEARCH_URL` | Elastic Cloud endpoint (e.g., `https://xxx.es.us-central1.gcp.cloud.es.io:443`) |
| `ELASTICSEARCH_USERNAME` | Elastic user (typically `elastic`) |
| `ELASTICSEARCH_PASSWORD` | Elastic user password |
| `SUPABASE_SERVICE_ROLE_KEY` | Database access (bypass RLS) |

### 14.4 Search Engine

**File**: `supabase/functions/elasticsearch-search/index.ts`

The search edge function provides a flexible query API over the indexed data. It supports full-text search with fuzzy matching, field boosting, term filters, date ranges, result highlighting, and aggregations — all exposed through a single endpoint.

**Query construction:**

```mermaid
flowchart LR
    Input["INPUT:\nquery, filters,\nsize, from, aggs"] --> MultiMatch["multi_match\ntitle x3, description x2,\ndomain x2, category,\nai_report, technologies\nfuzziness: AUTO"]
    
    MultiMatch --> Bool["bool query\nmust + filter"]
    
    Filters["Term Filters:\nseverity, category,\ndomain, date range"] --> Bool
    
    Bool --> Highlight["Highlight:\ntitle, description\nmark tags"]
    
    Bool --> Aggs["Aggregations:\nseverity_counts,\ncategory_counts,\ndomain_counts,\ntimeline"]
    
    Highlight --> Output["OUTPUT:\ntotal, hits,\naggregations"]
    Aggs --> Output
```

<p align="center"><em>Figure 3 — Elasticsearch Search Query Construction</em></p>

**Step-by-step search breakdown:**

1. **Multi-match query** — The search query is matched against six fields with field boosting: `title` (3x), `description` (2x), `domain` (2x), `category` (1x), `ai_report` (1x), and `technologies` (1x). Fuzziness is set to `AUTO` for typo tolerance.
2. **Bool filter** — Optional term filters for `severity`, `category`, and `domain` are applied as `bool.filter` clauses (non-scoring). Date range filters use the `range` query on `created_at`.
3. **Sorting** — Results are sorted by `_score` (relevance) descending, then `created_at` descending as a tiebreaker.
4. **Highlighting** — Matching text in `title` and `description` fields is wrapped in `<mark>` tags for visual emphasis in the UI.
5. **Aggregations** — When requested, the function returns bucket aggregations: `severity_counts` (term agg on `severity`), `category_counts` (term agg on `category`, top 20), `domain_counts` (term agg on `domain`, top 20), and `timeline` (date histogram on `created_at`, daily buckets).
6. **Target index** — Defaults to `threatlens-findings` but can be overridden via the `index` parameter to search `threatlens-scans` or `threatlens-audit`.

**Client-side API function** (in `src/lib/api.ts`):

```typescript
export async function searchElastic(
  query: string,
  options?: {
    index?: string;
    filters?: {
      severity?: string;
      category?: string;
      domain?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    size?: number;
    from?: number;
    aggs?: string[];
  }
): Promise<ElasticSearchResponse>
```

### 14.5 Global Search UI (⌘K)

**File**: `src/components/GlobalSearch.tsx`

The Global Search is a command-palette-style search interface embedded in the application header, providing instant cross-scan search powered by Elasticsearch. It is always accessible via the ⌘K (Cmd+K / Ctrl+K) keyboard shortcut or by clicking the search trigger button in the navigation bar.

<p align="center">
  <img src="public/docs/global-search-trigger.png" alt="Global Search trigger button in the navigation header showing the ⌘K shortcut badge" width="600" />
</p>
<p align="center"><em>Figure 5 — Global Search Trigger: The compact search button in the application header with ⌘K keyboard shortcut badge</em></p>

<p align="center">
  <img src="public/docs/global-search-results.png" alt="Global Search overlay showing search results with severity badges, highlighted matches, and aggregation pills" width="600" />
</p>
<p align="center"><em>Figure 6 — Global Search Results Panel: Fuzzy-matched findings with severity badges, highlighted text, category filters, and aggregation summary pills</em></p>

```mermaid
flowchart TD
    A["User presses Cmd+K\nor clicks search trigger"] --> B["Search overlay opens\n(AnimatePresence animation)"]
    B --> C["User types query"]
    C --> D["300ms debounce"]
    D --> E["searchElastic()\nvia elasticsearch-search\nedge function"]
    E --> F["Display results\nwith mark highlights"]
    F --> G["Show aggregation\nseverity + category pills"]
    
    G --> H{"User clicks\nresult?"}
    H -- "YES" --> I["Navigate to\n/scan/scanId"]
    H -- "NO" --> J{"User applies\nfilter?"}
    J -- "YES" --> E
    J -- "NO" --> K{"Escape or\nclick outside?"}
    K -- "YES" --> L["Close overlay"]
```

<p align="center"><em>Figure 4 — Global Search UI: Interaction Flow</em></p>

**Step-by-step UI breakdown:**

1. **Trigger** — A compact search button in the header displays "Search findings..." with a `⌘K` keyboard badge. Clicking it or pressing ⌘K/Ctrl+K opens the search overlay.
2. **Overlay** — A 420–520px wide floating panel renders with a Framer Motion fade + scale animation (0.15s). It positions absolutely over the header, anchored to the right.
3. **Input** — A borderless input field with a search icon auto-focuses on open. The user types their query.
4. **Debounce** — Input changes are debounced by 300ms to avoid excessive API calls during typing.
5. **Search Execution** — After the debounce, `searchElastic()` is called with the query, any active filters, `size: 15`, and aggregation requests for `severity` and `category`.
6. **Results Rendering** — Each result displays:
   - A `SeverityBadge` component with the finding's severity level
   - The domain name in monospace font
   - The finding title with `<mark>` highlighted matches (rendered via `dangerouslySetInnerHTML`)
   - The description with highlighted matches (truncated to 2 lines via `line-clamp-2`)
   - A category badge (`Badge` component with `outline` variant)
7. **Aggregation Summary** — Below the results, clickable severity pills show bucket counts (e.g., "critical: 3", "high: 7"). Clicking a pill toggles that severity as a filter and re-executes the search.
8. **Category Filter** — A dropdown populated dynamically from the `category_counts` aggregation allows filtering by finding category. Each option shows the category name and document count.
9. **Result Navigation** — Clicking a result navigates to `/scan/{scanId}` using the `scan_id` from the finding's source document, then closes and resets the search overlay.
10. **Dismissal** — Pressing Escape or clicking outside the overlay closes it. Click-outside detection uses a `mousedown` event listener on the document.

### 14.6 Kibana Dashboards

With scan data indexed in Elasticsearch, Kibana provides powerful visualization and analytics capabilities without any custom frontend code. The following dashboard configurations are recommended for security operations:

| Visualization | Type | Index | Configuration |
|--------------|------|-------|---------------|
| **Threat Timeline** | Line chart | `threatlens-findings` | X-axis: `created_at` (date histogram, daily), Split series by `severity` |
| **Severity Breakdown** | Donut chart | `threatlens-findings` | Slice by `severity` (terms agg) |
| **Domain Heatmap** | Heatmap | `threatlens-findings` | X-axis: `domain` (terms), Y-axis: `severity` (terms), Value: count |
| **Top Categories** | Horizontal bar | `threatlens-findings` | Y-axis: `category` (terms), X-axis: count |
| **Risk Score Trend** | Line chart | `threatlens-scans` | X-axis: `created_at`, Y-axis: `risk_score` (average), Split by `domain` |
| **Scan Activity** | Area chart | `threatlens-audit` | X-axis: `timestamp` (date histogram), Y-axis: count |
| **Technology Distribution** | Tag cloud | `threatlens-scans` | Field: `technologies` (terms agg) |

**Data View setup**: Create a Kibana Data View with index pattern `threatlens-*` and timestamp field `created_at` to query across all three indices simultaneously. For focused analysis, create separate data views for each index (`threatlens-findings`, `threatlens-scans`, `threatlens-audit`).

<p align="center">
  <img src="https://i.imgur.com/n59pKSg.png" alt="Kibana Discover view showing the threatlens-findings index with 26 documents, field list, and JSON document detail including CVE data" width="800" />
</p>
<p align="center"><em>Figure 7 — Kibana Discover: Browsing the threatlens-findings index with 26 indexed vulnerability documents. The JSON panel shows a CVE-2000-0967 finding for wordpress.org with severity, category, and reference links.</em></p>

---

## 15. Conclusion

ThreatLens represents a modern approach to automated threat intelligence that bridges the gap between manual penetration testing and fully automated security scanning. The architecture separates concerns cleanly — Firecrawl handles data acquisition, PostgreSQL provides persistence, Elasticsearch delivers enterprise search and analytics, and AI models deliver contextual analysis — while the React frontend presents everything through an intuitive, professional interface.

The AI domain policy agent is a differentiating feature that addresses the ethical dimension of security scanning tools. By evaluating targets before scanning, ThreatLens ensures its capabilities are used responsibly while maintaining the speed and convenience that security professionals need.

Key architectural decisions:
- **Serverless edge functions** for zero-infrastructure backend scaling
- **Unified AI model**: All functions use `google/gemini-3-flash-preview` via the Lovable AI Gateway for consistent, high-quality inference
- **Unified AI Gateway integration**: All functions route through the Lovable AI Gateway with auto-provisioned API keys
- **Elasticsearch integration**: Automatic sync to Elastic Cloud for full-text search, Kibana dashboards, and enterprise analytics
- **Global Search (⌘K)**: Command-palette search powered by Elasticsearch with fuzzy matching, filtering, and aggregations
- **Profile-based access control** ensuring only registered users can operate the platform
- **Immutable audit logging** for accountability and compliance
- **Dark-mode cybersecurity aesthetic** with custom CSS design tokens, glass morphism, gradient text, and Framer Motion animations
- **Four-tab scan detail view** separating Findings, Attack Surface, AI Report, and Raw Data for focused analysis

The platform is designed to be extended with additional scanning modules, AI models, and integration points as the threat landscape evolves.

---

*ThreatLens Technical Documentation — Confidential*
