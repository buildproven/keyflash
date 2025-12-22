# KeyFlash - Backlog

**Last Updated**: 2025-12-22
**Priority System**: Value-based (Revenue × Retention × Differentiation ÷ Effort)

---

## 🔥 High Value - Next Up

| ID           | Feature         | Value Drivers                                             | Effort | Status     |
| ------------ | --------------- | --------------------------------------------------------- | ------ | ---------- |
| **FEAT-001** | Saved searches  | Retention: saves user work, Revenue: premium feature      | M      | 💡 Planned |
| **FEAT-005** | Bulk CSV upload | Revenue: enterprise/agency appeal, Retention: power users | M      | 💡 Planned |

**Recommended next**: FEAT-001 (Saved searches) - auth is now in place to support it

---

## 📊 Medium Value - Worth Doing

| ID           | Feature            | Value Drivers                                                  | Effort | Status  |
| ------------ | ------------------ | -------------------------------------------------------------- | ------ | ------- |
| **FEAT-003** | Keyword clustering | Differentiation: unique vs competitors, Retention: power users | L      | 💭 Idea |

---

## 📚 Low Value - When Needed

| ID           | Feature                            | Value Drivers                            | Effort | Status  |
| ------------ | ---------------------------------- | ---------------------------------------- | ------ | ------- |
| **DOCS-001** | API integration guide (Google Ads) | Enables self-service setup               | M      | 💭 Idea |
| **DOCS-002** | Self-hosting guide                 | AGPL compliance, niche audience          | M      | 💭 Idea |
| **FEAT-004** | Browser extension                  | Differentiation, but XL effort kills ROI | XL     | 💭 Idea |

---

## Completed ✅

| ID                        | Feature                                             | Completed  |
| ------------------------- | --------------------------------------------------- | ---------- |
| **AUTH-001**              | User authentication (Clerk) + tier tracking         | 2025-12-22 |
| **PAY-001**               | Stripe checkout + subscriptions ($29/mo Pro)        | 2025-12-22 |
| **FEAT-008**              | Content Brief Generator with SERP analysis          | 2025-12-13 |
| **FEAT-006**              | Related keywords suggestions with relevance scoring | 2025-12-14 |
| **FEAT-007**              | Historical trend data visualization (sparklines)    | 2025-12-14 |
| **FEAT-002**              | DataForSEO API integration for scaling              | 2025-11-28 |
| **MONITOR-001**           | Sentry error tracking                               | 2025-12-05 |
| **STYLE-001**             | Tailwind CSS v4 migration                           | 2025-12-05 |
| **CI-001**                | Dependabot auto-merge workflow                      | 2025-12-13 |
| **CI-002**                | Weekly audit and daily deploy check workflows       | 2025-12-05 |
| **DEPLOY-001**            | Vercel deployment configuration                     | 2025-11-22 |
| **TEST-001/002/003**      | Unit, integration, and E2E tests                    | 2025-11-21 |
| **EXPORT-001**            | CSV export functionality                            | 2025-11-20 |
| **VALID-001**             | Input validation with Zod schemas                   | 2025-11-20 |
| **RATE-001**              | Rate limiting middleware                            | 2025-11-20 |
| **CACHE-001**             | Redis caching strategy                              | 2025-11-20 |
| **UI-001/002/003**        | Landing page, search form, results table            | 2025-11-20 |
| **API-001/002**           | API abstraction layer, Google Ads integration       | 2025-11-20 |
| **INFRA-001/002/003**     | Next.js 16, Google Ads credentials, Upstash Redis   | 2025-11-20 |
| **SETUP-001/002/003/004** | Documentation, GitHub repo, quality automation      | 2025-11-19 |
| **UI-004**                | Standard VibeBuildLab footer with legal links       | 2025-12-17 |
| **COPY-001**              | Landing page copy improvements (accurate messaging) | 2025-12-17 |
| **FIX-001**               | Tailwind CSS v4 import syntax fix                   | 2025-12-17 |
| **FIX-002**               | DataForSEO response parsing fix                     | 2025-12-17 |

---

## Value Scoring Framework

**Score each feature 1-5 on:**

- **Revenue**: Will users pay for this? Enables monetization?
- **Retention**: Keeps users coming back? Saves their work?
- **Differentiation**: Sets us apart from competitors?

**Then divide by effort:**

- S (< 4h) = ÷1, M (4-16h) = ÷2, L (16-40h) = ÷3, XL (40h+) = ÷4

**Formula**: `(Revenue + Retention + Differentiation) ÷ Effort = Priority Score`

---

## Stats

- **MVP Status**: Complete
- **Deployment**: https://keyflash.vibebuildlab.com (Live)
- **Test Coverage**: 505 unit tests + integration + E2E
- **Tech Stack**: Next.js 16, TypeScript 5+, Tailwind v4, Vitest + Playwright
