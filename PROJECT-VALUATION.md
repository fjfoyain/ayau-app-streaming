# AYAU — Project Valuation Report

> Prepared: March 2026
> Scope: Full lifecycle — AWS original build through Supabase migration and current state

---

## Executive Summary

AYAU is a professionally architected, production-ready B2B SaaS platform for the music streaming and royalty management market in the hospitality sector. This document estimates the fair value of the work invested in the platform across its two development phases, including architecture, technical leadership, engineering, and intellectual property.

**Estimated total invested value: $180,000 – $350,000 USD** (at market rates for the region and role)

**Platform IP value (if productized as SaaS): $500,000 – $1,500,000 USD**

---

## 1. Project Phases

### Phase 1 — AWS Original Build
**Duration:** ~9–12 months
**Role:** Architect + Technical Lead managing a development team
**Infrastructure:** Amazon Web Services

Key deliverables:
- System architecture design (cloud infrastructure, data model, API design)
- AWS infrastructure setup: API Gateway, Lambda (serverless functions), RDS (PostgreSQL), S3 (file storage), CloudFront (CDN), Cognito (authentication)
- Core platform built: authentication system, multi-tenant data model, playlist and song management, admin panel, royalty tracking schema, user roles
- Technical leadership: sprint planning, code reviews, architectural decisions, team onboarding
- Database schema design (normalized PostgreSQL with royalty tracking in mind from day one)
- Security model: IAM roles, VPC configuration, bucket policies, API authorization

**Team composition (estimated):**
- 1 Architect / Tech Lead (the role being valued here)
- 1–2 Backend developers
- 1 Frontend developer
- Part-time DevOps support

---

### Phase 2 — Migration & Platform Enhancement
**Duration:** ~6–8 months
**Role:** Solo Architect + Lead Developer
**Migration:** AWS → Supabase + Vercel

Key deliverables:
- Cloud migration strategy and execution (AWS → managed Supabase platform)
- Architecture redesign: replaced custom Lambda/API Gateway with Supabase Edge Functions; replaced manual WebSocket server with Supabase Realtime
- **New feature: DJ Mode** — real-time synchronized playback across multiple venues using Supabase Realtime (WebSockets + PostgreSQL logical replication)
- **New feature: Account/Venue multi-tenant management** — full CRUD for companies and their locations
- Enhanced RBAC: four-tier access control (admin, manager, user, client user) with row-level security
- Royalty tracking improvements: ISRC/ISWC/IPI metadata, monthly pre-aggregation, geographic breakdown
- Advanced audio engine: gapless playback, signed URL caching, prefetch system, spectrum visualizer
- Edge Functions for user invitation lifecycle (Deno/TypeScript)
- Security hardening: RLS policies on all tables, CSP headers, signed URLs, single-use reset tokens
- Complete documentation suite (technical specs, deployment guides, architecture docs)

---

## 2. Effort Estimation

### Phase 1 — AWS Build

| Work Category | Estimated Hours |
|--------------|----------------|
| System architecture & infrastructure design | 120 – 160 h |
| AWS infrastructure setup & configuration | 80 – 120 h |
| Database schema design & implementation | 60 – 80 h |
| Backend API development (leadership + core work) | 200 – 280 h |
| Frontend architecture & core implementation | 150 – 200 h |
| Authentication & security model | 40 – 60 h |
| Admin panel (initial version) | 100 – 140 h |
| Royalty tracking system design | 40 – 60 h |
| Team coordination, code reviews, planning | 100 – 150 h |
| Testing, QA, deployment pipeline | 60 – 80 h |
| **Phase 1 Total** | **950 – 1,330 h** |

### Phase 2 — Migration & Enhancement

| Work Category | Estimated Hours |
|--------------|----------------|
| Migration architecture & planning | 40 – 60 h |
| AWS → Supabase migration execution | 80 – 120 h |
| DJ Mode / Realtime sync system | 120 – 160 h |
| Account + Venue management system | 80 – 100 h |
| Enhanced RBAC + RLS policies | 60 – 80 h |
| Advanced audio engine (prefetch, gapless, visualizer) | 80 – 100 h |
| Royalty metadata & analytics improvements | 60 – 80 h |
| Edge Functions & email system | 40 – 60 h |
| Security hardening (CSP, signed URLs, reset tokens) | 40 – 50 h |
| Admin panel expansion (5 new sections) | 120 – 160 h |
| Documentation (12,000+ lines across 20+ docs) | 80 – 100 h |
| Testing, QA, bug fixes | 80 – 100 h |
| **Phase 2 Total** | **880 – 1,170 h** |

### Total Estimated Hours

| Phase | Hours |
|-------|-------|
| Phase 1 (AWS build) | 950 – 1,330 h |
| Phase 2 (migration + features) | 880 – 1,170 h |
| **Total** | **1,830 – 2,500 h** |

> These estimates deliberately focus on the architect/lead contribution. The full team effort in Phase 1 (backend + frontend developers) represents an additional 1,500–2,000 hours of engineering work not included above.

---

## 3. Cost Valuation by Market

### Architect / Tech Lead Rate Reference

| Market | Architect / Tech Lead Rate | Source |
|--------|--------------------------|--------|
| Latin America (Guatemala, regional) | $50 – $90 / hour | Regional IT market rates, 2024–2025 |
| Latin America (international remote) | $80 – $130 / hour | Remote B2B contracts |
| USA / Canada | $150 – $250 / hour | North American market |
| Europe | $100 – $180 / hour | Western European market |

### Architect / Lead Work Value

| Market | Low Estimate | High Estimate |
|--------|-------------|---------------|
| Latin America (local) | $91,500 | $225,000 |
| Latin America (international remote) | $146,400 | $325,000 |
| USA equivalent | $274,500 | $625,000 |

### Full Team Cost (Phase 1 — with development team)

Assuming a 3-person dev team in Phase 1 at $40–$60/hr in addition to the architect:

| Component | Low | High |
|-----------|-----|------|
| Architect / Lead (both phases) | $91,500 | $225,000 |
| Backend developers (Phase 1) | $48,000 | $84,000 |
| Frontend developer (Phase 1) | $36,000 | $60,000 |
| DevOps / infrastructure (Phase 1) | $12,000 | $24,000 |
| **Total team cost** | **$187,500** | **$393,000** |

### Agency Equivalent Cost

If this project were contracted to a software development agency (with agency margin):

| Agency Tier | Estimate |
|-------------|---------|
| Nearshore agency (LatAm) | $250,000 – $400,000 |
| US-based agency | $450,000 – $800,000 |

---

## 4. Intellectual Property & Platform Value

Beyond the development hours, the platform represents significant intellectual property value:

### Why AYAU Has Defensible IP Value

1. **Specialized domain knowledge**: The royalty tracking system (ISRC, ISWC, IPI, stream validation rules, geographic breakdown) reflects deep industry knowledge that would take any team 3–6 months just to research and design correctly.

2. **Unique technical architecture**: The DJ Mode synchronized playback system (multi-location real-time sync with deduplication, sequence numbers, and gapless audio) is a non-trivial engineering achievement with no direct off-the-shelf equivalent for this market.

3. **Market fit**: The B2B hospitality music platform market in Latin America is underserved. Existing solutions (Soundtrack Your Brand, Rockbot, Mood Media) are priced $50–$200/month per location and do not offer the regional compliance features or royalty tracking specificity that AYAU provides.

4. **SaaS scalability**: The multi-tenant architecture cleanly supports growth from 1 client to 1,000 clients with no structural changes. This is a design decision made at inception that compounds in value as the platform scales.

### IP Valuation Scenarios

| Scenario | Estimated Value |
|----------|----------------|
| Internal tool (single company) | $100,000 – $200,000 |
| Productized SaaS (early stage, 10–20 clients) | $300,000 – $600,000 |
| Productized SaaS (growth stage, 100+ clients) | $1,000,000 – $2,500,000 |
| Acquisition by regional music licensing body | $500,000 – $1,500,000 |

---

## 5. Comparable Market References

| Product | Category | Price | Notes |
|---------|----------|-------|-------|
| Soundtrack Your Brand | Business music streaming | $35–$55/location/mo | No royalty reporting for venues |
| Rockbot | Business music + digital signage | $60–$200/location/mo | US-focused, no ISRC tracking |
| Mood Media | Enterprise music licensing | Custom pricing | Complex, legacy infrastructure |
| Custom-built equivalent | SaaS development | $250K–$500K to build | Agency quote for similar scope |

AYAU is positioned competitively in this space, with a specialized advantage in royalty compliance data (ISRC/ISWC/IPI tracking) and the DJ Mode synchronization feature, neither of which is standard in existing products at this price point.

---

## 6. Summary Table

| Category | Low Estimate | High Estimate |
|----------|-------------|---------------|
| Architect / Lead hours (1,830–2,500 h @ LatAm rates) | $91,500 | $225,000 |
| Full team total (Phase 1 + Phase 2) | $187,500 | $393,000 |
| Agency equivalent cost | $250,000 | $800,000 |
| Platform IP value (early SaaS) | $300,000 | $600,000 |
| Platform IP value (growth SaaS) | $1,000,000 | $2,500,000 |

---

## 7. Notes on Methodology

- Hour estimates are based on analysis of the actual codebase: ~3,500 lines of React components, ~1,200 lines of API service layer, ~50+ SQL migration scripts, 12,000+ lines of documentation, and 1 Deno Edge Function.
- Rates reflect 2024–2025 market conditions for technical roles in Guatemala and the broader Latin American market.
- The architect/lead premium (vs. standard developer rates) reflects the design, decision-making, and technical leadership work that has a disproportionate impact on project success and long-term maintainability.
- These estimates do not include ongoing maintenance, infrastructure costs, or future feature development.
- All figures are in USD.

---

> This document was prepared for internal reference and professional portfolio purposes.
> AYAU — MÚSICA, ON FIRE
