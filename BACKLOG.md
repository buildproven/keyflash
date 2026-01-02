# KeyFlash - Backlog

**Last Updated**: 2026-01-02
**Priority System**: Value-based (Revenue × Retention × Differentiation ÷ Effort)

---

## 🚨 Critical - Deep Review Fixes (2025-12-31)

| ID          | Issue                                            | Category    | Effort | Status  |
| ----------- | ------------------------------------------------ | ----------- | ------ | ------- |
| **FIX-004** | Add authentication to checkout endpoint          | Security    | S      | ✅ Done |
| **FIX-005** | Webhook returns 503 on Redis errors (not 200)    | Reliability | S      | ✅ Done |
| **FIX-006** | Fix race condition in saved searches limit check | Reliability | M      | ✅ Done |
| **FIX-007** | Fix Stripe type assertions (customer as object)  | Type Safety | S      | ✅ Done |
| **FIX-008** | Services throw errors instead of returning null  | Reliability | M      | ✅ Done |

## 🔶 High Priority - Deep Review Fixes

| ID           | Issue                                     | Category    | Effort | Status  |
| ------------ | ----------------------------------------- | ----------- | ------ | ------- |
| **FIX-009**  | Fix N+1 query in listSavedSearches (MGET) | Performance | S      | ✅ Done |
| **FIX-010**  | Add rate limiting to checkout endpoint    | Security    | S      | ✅ Done |
| **FIX-011**  | Add search ID parameter validation        | Security    | S      | ✅ Done |
| **FIX-012**  | Fix rate limiter memory leak and logging  | Reliability | S      | ✅ Done |
| **TEST-004** | Improve user-service.ts coverage to 70%+  | Quality     | M      | 🟠 High |

## 🟡 Medium Priority - Deep Review Fixes

| ID          | Issue                                      | Category      | Effort | Status    |
| ----------- | ------------------------------------------ | ------------- | ------ | --------- |
| **FIX-013** | Fix memory leak in rate limit fallback     | Performance   | S      | ✅ Done   |
| **FIX-014** | Use logger instead of console.warn         | Observability | S      | ✅ Done   |
| **FIX-015** | Add provider name type guard               | Type Safety   | S      | ✅ Done   |
| **SEC-002** | Integrate SSRF protection module           | Security      | M      | 🟡 Medium |
| **FIX-016** | Add request timeouts to external API calls | Reliability   | S      | 🟡 Medium |

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
| **A11Y-006**              | Dark mode color contrast fixes (7 components, WCAG 2.1 AA)       | 2026-01-02 |
| **A11Y-007**              | ARIA labels for icon buttons (related, content brief)            | 2026-01-02 |
| **A11Y-008**              | Modal focus restoration (3 modals: content brief, related, save) | 2026-01-02 |
| **A11Y-009**              | Table caption for screen readers (keyword results)               | 2026-01-02 |
| **A11Y-010**              | Aria-live regions for modal error announcements                  | 2026-01-02 |
| **FIX-029**               | Content brief error handling (cache write timeout race)          | 2026-01-02 |
| **FIX-030**               | Redis KEYS to SCAN migration (purgeKeywordCache, non-blocking)   | 2026-01-02 |
| **FIX-031**               | Structured Redis error classes (CacheError hierarchy)            | 2026-01-02 |
| **FIX-032**               | Rate limiter fail-fast validation (production HMAC + Redis)      | 2026-01-02 |
| **FIX-033**               | Enhanced getAppUrl() production validation (URL format, HTTPS)   | 2026-01-02 |
| **FIX-034**               | Remove redundant isAvailable() checks in searches API            | 2026-01-02 |
| **FIX-021**               | Webhook idempotency fail closed (prevent duplicate billing)      | 2026-01-01 |
| **FIX-022**               | Cache health tracking (cacheHealthy field in API responses)      | 2026-01-01 |
| **FIX-023**               | Saved search race condition (SCARD before SADD atomic check)     | 2026-01-01 |
| **A11Y-004**              | WCAG 2.1 AA color contrast (text-gray-400 → text-gray-600)       | 2026-01-01 |
| **A11Y-005**              | Screen reader accessibility (aria-label, sr-only text)           | 2026-01-01 |
| **FIX-024**               | Replace hardcoded domains with getAppUrl() env-based helper      | 2026-01-01 |
| **FIX-025**               | Remove redundant isAvailable() checks (services throw errors)    | 2026-01-01 |
| **FIX-026**               | Monthly reset race condition (Redis TTL atomic operations)       | 2026-01-01 |
| **FIX-027**               | DRY violation eliminated (monthly reset via TTL refactor)        | 2026-01-01 |
| **FIX-028**               | Runtime validation with Zod schemas (UserData, SavedSearch)      | 2026-01-01 |
| **FIX-008**               | Services throw errors instead of null (proper 503 responses)     | 2025-12-31 |
| **FIX-020**               | Webhook idempotency (track event IDs to prevent duplicates)      | 2025-12-31 |
| **FIX-004**               | Add authentication to checkout endpoint                          | 2025-12-31 |
| **FIX-005**               | Webhook returns 503 on Redis errors (enables Stripe retry)       | 2025-12-31 |
| **FIX-006**               | Fix race condition in saved searches limit (atomic ops)          | 2025-12-31 |
| **FIX-007**               | Fix Stripe type assertions (type-safe customer extraction)       | 2025-12-31 |
| **FIX-009**               | Fix N+1 query in listSavedSearches (Redis MGET)                  | 2025-12-31 |
| **FIX-010**               | Add rate limiting to checkout endpoint                           | 2025-12-31 |
| **FIX-011**               | Add search ID parameter validation (UUID + legacy format)        | 2025-12-31 |
| **FIX-012**               | Fix rate limiter memory leak (remove setTimeout accumulation)    | 2025-12-31 |
| **FIX-013**               | Fix memory leak in rate limit fallback (cap at 10K entries)      | 2025-12-31 |
| **FIX-014**               | Use logger instead of console.warn (edge rate limit)             | 2025-12-31 |
| **FIX-015**               | Add provider name type guard (factory pattern)                   | 2025-12-31 |
| **FIX-017**               | Throw on invalid provider in production (not mock fallback)      | 2025-12-31 |
| **FIX-018**               | Add error logging to handleAPIError (operational visibility)     | 2025-12-31 |
| **FIX-019**               | Fix deleteSavedSearch to check SREM return value (proper 404)    | 2025-12-31 |
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
- **Test Coverage**: 714 tests passing, ~84% line coverage (all tests passing after deep review fixes)
- **Tech Stack**: Next.js 16, TypeScript 5+, Tailwind v4, Vitest + Playwright
