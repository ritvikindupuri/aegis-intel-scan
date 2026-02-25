# ThreatLens

### Automated Threat Intelligence & Attack Surface Mapping Platform

**By: Ritvik Induopuri**
**Date: February 25, 2026**

---

## Executive Summary

ThreatLens is an AI-powered cybersecurity platform that automates threat intelligence gathering and attack surface mapping for web domains. It combines automated web crawling via the Firecrawl API with multi-model AI analysis to deliver comprehensive security assessments — including vulnerability detection, security header analysis, technology fingerprinting, and actionable remediation guidance.

The platform features an AI domain policy agent that prevents misuse by automatically evaluating scan targets, an interactive AI analyst chatbot for deep-dive investigations, and a full reporting suite with PDF export capabilities. Built with a modern React frontend and serverless edge function backend, ThreatLens provides enterprise-grade threat intelligence in a streamlined, accessible interface.

---

## Table of Contents

- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Setup & Installation](#setup--installation)
- [Technical Documentation](#technical-documentation)
- [Conclusion](#conclusion)

---

## Key Features

### Automated Domain Scanning
- One-click domain reconnaissance via Firecrawl web scraping API
- Automatic URL discovery and site mapping (up to 500 endpoints)
- HTML parsing for forms, scripts, and external dependencies
- Technology stack fingerprinting (React, WordPress, Angular, Cloudflare, etc.)

### AI Domain Policy Agent
- AI-powered allowlist/blocklist system using Google Gemini Flash Lite
- **Auto-approve**: Safe public websites, businesses, SaaS products
- **Auto-block**: Military domains, critical infrastructure, intelligence agencies
- **Flag for review**: Ambiguous or sensitive domains
- Full scan audit log tracking every evaluation decision
- Manual policy override via the Policies management page

### Interactive AI Analyst Chatbot
- Context-aware AI assistant available on every scan detail page
- Three analysis contexts: Attack Surface, Findings, Raw Data
- Pre-built suggested questions for common security assessments
- Professional markdown rendering with tables, bold text, bullets, and code blocks
- Copy-to-clipboard on every AI response

### Attack Surface Analysis
- **Discovered Endpoints**: All crawled URL paths with clickable stat cards
- **Client-Side Scripts**: JavaScript files that may expose API keys or internal routes
- **Input Vectors**: HTML forms as potential injection points (XSS, SQLi, CSRF)
- **External Dependencies**: Third-party resources representing supply chain risk
- **Security Headers**: Analysis of CSP, HSTS, X-Frame-Options, and more
- Interactive tooltips explaining the security implications of each metric

### Vulnerability Detection
- Missing security header detection (CSP, HSTS, X-Frame-Options, etc.)
- Exposed admin panel and sensitive path discovery
- Suspicious query parameter identification (redirect, file, cmd, etc.)
- Potential XSS input point detection
- Outdated library and CMS risk assessment
- Supply chain dependency risk scoring

### Risk Scoring & Severity Classification
- Composite risk score (0-100) calculated from findings
- Severity levels: Critical (25pts), High (15pts), Medium (8pts), Low (3pts), Info (1pt)
- Color-coded risk gauges and severity badges throughout the UI
- Risk distribution dashboard with breakdown by severity

### AI Threat Reports
- One-click AI-generated comprehensive threat intelligence reports
- Executive summary, vulnerability analysis, and remediation roadmap
- Professional markdown formatting with tables and structured sections
- Copy report to clipboard functionality

### PDF Export
- Professional PDF report generation with jsPDF
- Branded cover page, table of contents, and confidential watermarking
- Includes findings, technologies, attack surface data, and AI insights
- Paginated with headers, footers, and report IDs

### Scan Comparison
- Side-by-side comparison of any two completed scans
- Delta analysis: new/removed findings, tech changes, risk score diff
- URL and technology overlap visualization

### Authentication & Access Control
- Google OAuth sign-in/sign-up via Lovable Cloud
- Separate sign-up and sign-in flows with profile-based registration gate
- Protected routes — unauthenticated users redirected to login
- User avatar and email displayed in header

### Scan History & Management
- Chronological scan history with status badges and risk scores
- Delete scans with confirmation dialog (cascading to findings)
- Dashboard with aggregate stats: total scans, unique domains, avg risk, total vulnerabilities

---

## System Architecture

```
+------------------------------------------------------------------+
|                      CLIENT (React + Vite)                        |
|                                                                    |
|  +----------+  +----------+  +----------+  +----------------+     |
|  |Dashboard |  |Scan      |  |History   |  |Policies        |     |
|  |  Index   |  |  Detail  |  |  Compare |  |  Audit Log     |     |
|  +----+-----+  +----+-----+  +----+-----+  +-------+--------+     |
|       |              |              |               |              |
|       +--------------+--------------+---------------+              |
|                              |                                     |
|                    Supabase JS Client                              |
+------------------------------+-------------------------------------+
                               |
                    +----------v----------+
                    |   Lovable Cloud     |
                    |   (Supabase)        |
                    |                     |
                    |  +---------------+  |
                    |  |  PostgreSQL   |  |
                    |  |  - scans      |  |
                    |  |  - findings   |  |
                    |  |  - profiles   |  |
                    |  |  - policies   |  |
                    |  |  - audit_log  |  |
                    |  +---------------+  |
                    |                     |
                    |  +---------------+  |
                    |  |Edge Functions |  |
                    |  |  - firecrawl  |  |
                    |  |  - analyze    |  |
                    |  |  - evaluate   |  |
                    |  |  - surface    |  |
                    |  +-------+-------+  |
                    |          |          |
                    |  +-------v-------+  |
                    |  |  Auth (OAuth) |  |
                    |  |  Google SSO   |  |
                    |  +---------------+  |
                    +----------+----------+
                               |
              +----------------+----------------+
              |                |                |
     +--------v------+ +------v------+ +-------v------+
     | Firecrawl API | | Lovable AI  | | Google OAuth  |
     | Web Scraping  | | Gemini/GPT  | | Identity     |
     +---------------+ +-------------+ +--------------+
```

### Architecture Explanation

**Client Layer**: A single-page React application built with Vite, using React Router for navigation across Dashboard, Scan Detail, History, Compare, and Policies pages. All API communication flows through the Supabase JS client.

**Backend Layer (Lovable Cloud)**: A managed backend providing PostgreSQL for data persistence, Edge Functions for serverless compute, and OAuth for authentication. Row Level Security (RLS) policies protect user data on the profiles table.

**Edge Functions**:
- `firecrawl-scan` — Orchestrates the full scan pipeline: crawling, parsing, finding generation, and risk scoring
- `analyze-threats` — Generates comprehensive AI threat reports from scan data using Gemini
- `analyze-surface` — Powers the interactive AI analyst chatbot with context-specific prompts
- `evaluate-domain` — AI domain policy agent that gates scan requests before execution

**External Services**:
- **Firecrawl API** — Web scraping (scrape endpoint) and site mapping (map endpoint)
- **Lovable AI** — Multi-model AI inference (Gemini Flash, Gemini Flash Lite) for threat analysis
- **Google OAuth** — User authentication via managed SSO

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui, Framer Motion |
| **State** | React hooks, TanStack React Query |
| **Routing** | React Router v6 |
| **Backend** | Lovable Cloud (Supabase), Deno Edge Functions |
| **Database** | PostgreSQL with Row Level Security |
| **Auth** | Google OAuth (Lovable Cloud managed) |
| **AI Models** | Google Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash Lite |
| **Web Scraping** | Firecrawl API (scrape + map endpoints) |
| **PDF Export** | jsPDF |
| **Charts** | Recharts |

---

## Setup & Installation

### Prerequisites
- Node.js 18+ or Bun
- A Lovable account with Cloud enabled
- Firecrawl API key

### Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd threatlens
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   The `.env` file is auto-managed by Lovable Cloud with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

4. **Add required secrets**
   In Lovable Cloud, add the following secret:
   - `FIRECRAWL_API_KEY` — Your Firecrawl API key for web scraping

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Access the app**
   Open `http://localhost:5173` in your browser. Sign up with Google to create an account.

---

## Technical Documentation

For comprehensive technical documentation covering every component, system flow, AI integration, and security architecture in detail, see:

**[TECHNICAL_DOCS.md](./TECHNICAL_DOCS.md)**

---

## Conclusion

ThreatLens demonstrates how modern AI capabilities can be combined with automated web reconnaissance to create a practical, accessible threat intelligence platform. By integrating Firecrawl's web scraping with multi-model AI analysis (Gemini Flash for domain policy evaluation, Gemini Pro for deep threat analysis), the platform delivers actionable security insights that would traditionally require hours of manual penetration testing work.

The AI domain policy agent adds a critical layer of responsible use — ensuring the scanning capabilities cannot be weaponized against sensitive targets while maintaining ease of use for legitimate security assessments. The combination of automated detection, interactive AI analysis, and professional reporting makes ThreatLens a comprehensive tool for security professionals and organizations looking to understand and reduce their attack surface.

---

*Built with [Lovable](https://lovable.dev)*
