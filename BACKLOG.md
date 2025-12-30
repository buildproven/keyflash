# KeyFlash - Backlog

**Last Updated**: 2025-12-30
**Priority System**: Value-based (Revenue × Retention × Differentiation ÷ Effort)

---

## 🚨 Critical - SOTA Audit Fixes (2025-12-30)

| ID           | Feature                           | Category    | Effort | Status  |
| ------------ | --------------------------------- | ----------- | ------ | ------- |
| **SEO-001**  | Create sitemap.ts                 | SEO         | S      | ✅ Done |
| **SEO-002**  | Create robots.ts                  | SEO         | S      | ✅ Done |
| **SEO-003**  | Add metadataBase + canonical URLs | SEO         | S      | ✅ Done |
| **SEO-004**  | Add JSON-LD structured data       | SEO         | S      | ✅ Done |
| **A11Y-001** | Fix modal focus (Escape + trap)   | A11y        | M      | ✅ Done |
| **A11Y-002** | Fix color contrast (gray-400→600) | A11y        | S      | ✅ Done |
| **A11Y-003** | Add prefers-reduced-motion CSS    | A11y        | S      | ✅ Done |
| **PERF-001** | Lazy load Clerk authentication    | Performance | M      | ✅ Done |
| **PERF-002** | Dynamic import modals             | Performance | S      | ✅ Done |

---

## 🔥 High Value - Next Up

| ID           | Feature         | Value Drivers                                             | Effort | Status     |
| ------------ | --------------- | --------------------------------------------------------- | ------ | ---------- |
| **FEAT-001** | Saved searches  | Retention: saves user work, Revenue: premium feature      | M      | ✅ Done    |
| **FEAT-005** | Bulk CSV upload | Revenue: enterprise/agency appeal, Retention: power users | M      | 💡 Planned |

**Recommended next**: FEAT-005 (Bulk CSV upload) for enterprise/agency appeal

---

## 📊 Medium Value - Worth Doing

| ID           | Feature                    | Value Drivers                                                  | Effort | Status     |
| ------------ | -------------------------- | -------------------------------------------------------------- | ------ | ---------- |
| **TEST-004** | Improve test coverage >85% | Quality: reduce bugs, Retention: reliability                   | M      | 💡 Planned |
| **FEAT-003** | Keyword clustering         | Differentiation: unique vs competitors, Retention: power users | L      | 💭 Idea    |

**TEST-004 Details**: Current coverage 79%. Gaps:

- `lib/user/user-service.ts` (9%) - needs Redis mocking
- `lib/api/serp-service.ts` (68%) - external API mocking
- `lib/rate-limit/` (66-74%) - Redis integration tests

---

## 📚 Low Value - When Needed

| ID           | Feature                            | Value Drivers                            | Effort | Status  |
| ------------ | ---------------------------------- | ---------------------------------------- | ------ | ------- |
| **DOCS-001** | API integration guide (Google Ads) | Enables self-service setup               | M      | 💭 Idea |
| **DOCS-002** | Self-hosting guide                 | AGPL compliance, niche audience          | M      | 💭 Idea |
| **FEAT-004** | Browser extension                  | Differentiation, but XL effort kills ROI | XL     | 💭 Idea |

---

## Completed ✅

| ID                        | Feature                                                          | Completed  |
| ------------------------- | ---------------------------------------------------------------- | ---------- |
| **PERF-001**              | Lazy load Clerk authentication                                   | 2025-12-30 |
| **SEC-001**               | Security hardening (origin allowlist, 5xx redaction, validation) | 2025-12-30 |
| **FIX-003**               | Monthly keyword reset bug fix                                    | 2025-12-30 |
| **FEAT-001**              | Saved searches (Redis storage, list, load, delete)               | 2025-12-30 |
| **AUTH-001**              | User authentication (Clerk) + tier tracking                      | 2025-12-22 |
| **PAY-001**               | Stripe checkout + subscriptions ($29/mo Pro)                     | 2025-12-22 |
| **FEAT-008**              | Content Brief Generator with SERP analysis                       | 2025-12-13 |
| **FEAT-006**              | Related keywords suggestions with relevance scoring              | 2025-12-14 |
| **FEAT-007**              | Historical trend data visualization (sparklines)                 | 2025-12-14 |
| **FEAT-002**              | DataForSEO API integration for scaling                           | 2025-11-28 |
| **MONITOR-001**           | Sentry error tracking                                            | 2025-12-05 |
| **STYLE-001**             | Tailwind CSS v4 migration                                        | 2025-12-05 |
| **CI-001**                | Dependabot auto-merge workflow                                   | 2025-12-13 |
| **CI-002**                | Weekly audit and daily deploy check workflows                    | 2025-12-05 |
| **DEPLOY-001**            | Vercel deployment configuration                                  | 2025-11-22 |
| **TEST-001/002/003**      | Unit, integration, and E2E tests                                 | 2025-11-21 |
| **EXPORT-001**            | CSV export functionality                                         | 2025-11-20 |
| **VALID-001**             | Input validation with Zod schemas                                | 2025-11-20 |
| **RATE-001**              | Rate limiting middleware                                         | 2025-11-20 |
| **CACHE-001**             | Redis caching strategy                                           | 2025-11-20 |
| **UI-001/002/003**        | Landing page, search form, results table                         | 2025-11-20 |
| **API-001/002**           | API abstraction layer, Google Ads integration                    | 2025-11-20 |
| **INFRA-001/002/003**     | Next.js 16, Google Ads credentials, Upstash Redis                | 2025-11-20 |
| **SETUP-001/002/003/004** | Documentation, GitHub repo, quality automation                   | 2025-11-19 |
| **UI-004**                | Standard VibeBuildLab footer with legal links                    | 2025-12-17 |
| **COPY-001**              | Landing page copy improvements (accurate messaging)              | 2025-12-17 |
| **FIX-001**               | Tailwind CSS v4 import syntax fix                                | 2025-12-17 |
| **FIX-002**               | DataForSEO response parsing fix                                  | 2025-12-17 |

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
- **Test Coverage**: 711 tests passing, ~79% line coverage
- **Tech Stack**: Next.js 16, TypeScript 5+, Tailwind v4, Vitest + Playwright
