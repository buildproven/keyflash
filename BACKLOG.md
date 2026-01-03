# KeyFlash - Backlog

**Last Updated**: 2026-01-03
**Priority System**: Value-based (Revenue × Retention × Differentiation ÷ Effort)

---

## 🚨 CRITICAL - Deep Review 2026-01-02

**Value Score: 13-26 (Revenue:5, Retention:5, Differentiation:3)**
**All items completed 2026-01-02**

| ID           | Issue                                         | Category    | CVSS | Effort | Status  |
| ------------ | --------------------------------------------- | ----------- | ---- | ------ | ------- |
| **SEC-010**  | Trial period bypass - race condition          | Security    | 8.1  | M      | ✅ Done |
| **SEC-011**  | Webhook replay attack - idempotency timing    | Security    | 7.5  | S      | ✅ Done |
| **TYPE-001** | Stripe webhook unvalidated type assertions    | Type Safety | -    | S      | ✅ Done |
| **PERF-010** | Usage tracking blocks keyword search requests | Reliability | -    | S      | ✅ Done |

**SEC-010 Details**: Race condition in `keywords/route.ts:115` - concurrent user creation bypasses trial limits

- **Exploit**: 100 concurrent requests on first login → multiple trial periods
- **Impact**: Unlimited trial extensions, quota evasion, revenue loss
- **Fix**: Implement distributed lock using Redis SETNX before createUser()

**SEC-011 Details**: Webhook processed AFTER business logic in `webhooks/stripe/route.ts:186`

- **Exploit**: Trigger Redis failure during webhook → upgrade completes but not marked processed → Stripe retries → double subscription
- **Impact**: Financial loss from duplicate subscriptions
- **Fix**: Mark event processed BEFORE business logic (optimistic locking)

**TYPE-001 Details**: `event.data.object as Stripe.Checkout.Session` without validation

- **Impact**: Runtime errors if Stripe changes event structure
- **Fix**: Add Zod schemas: `CheckoutSessionSchema`, `SubscriptionSchema`, `InvoiceSchema`

**PERF-010 Details**: `await userService.incrementKeywordUsage()` in main request path

- **Impact**: 503 error if usage tracking fails, blocks critical operation
- **Fix**: Fire-and-forget: `incrementKeywordUsage().catch(err => logger.error(...))`

---

## 🔶 HIGH PRIORITY - Deep Review 2026-01-02

**Value Score: 6.5-13 (Revenue:4, Retention:5, Differentiation:4)**
**Partial completion: 5/8 items done (updated 2026-01-03)**

| ID           | Issue                                   | Category      | Effort | Status  |
| ------------ | --------------------------------------- | ------------- | ------ | ------- |
| **TYPE-002** | Non-null assertions (133 instances)     | Type Safety   | M      | 🟠 High |
| **SEC-012**  | Saved search quota bypass - TOCTOU      | Security      | S      | ✅ Done |
| **SEC-013**  | Rate limit HMAC fallback in development | Security      | S      | ✅ Done |
| **SEC-014**  | Cache poisoning - 32-bit hash collision | Security      | S      | ✅ Done |
| **A11Y-011** | Color contrast - text-gray-500 issues   | Accessibility | S      | ✅ Done |
| **A11Y-012** | Missing aria-labels on interactive btns | Accessibility | S      | ✅ Done |
| **A11Y-013** | Inconsistent focus indicators           | Accessibility | S      | 🟠 High |
| **PERF-011** | Cache write timeout race condition      | Performance   | S      | 🟠 High |

**TYPE-002 Details**: Replace `this.client!.set()` pattern with safe `getClient()` helper

- Files: `user-service.ts` (47), `saved-searches-service.ts` (23), `cache/redis.ts` (28)
- Fix: Create `private getClient()` that throws if null, removes all `!` assertions

**SEC-012 Details**: Race between SCARD check and SADD in `saved-searches-service.ts:88`

- **Exploit**: User at 49/50 sends 10 concurrent saves → 59/50 total
- **Fix**: Check count AFTER atomic SADD, rollback with SREM if over limit

**SEC-013 Details**: `'dev-only-insecure-fallback'` HMAC key in `redis-rate-limiter.ts:134`

- **Exploit**: Attacker pre-computes client IDs to bypass rate limits
- **Fix**: Remove fallback entirely, enforce secret in ALL environments

**SEC-014 Details**: `simpleHash()` in `cache/redis.ts:121` uses 32-bit hash (~25 bits entropy)

- **Exploit**: Brute force collisions to poison cache with attacker-controlled data
- **Fix**: Replace with `crypto.createHash('sha256').digest('hex').substring(0, 16)`

**A11Y-011 Details**: 5 files use text-gray-500 on white (4.1:1, needs 4.5:1 for WCAG AA)

- Files: keyword-search-form.tsx:105, saved-searches-list.tsx (5 locations), related-keywords-modal.tsx:184
- Fix: Global replace `text-gray-500` → `text-gray-600`

**A11Y-012 Details**: Buttons lack screen reader labels

- `saved-searches-list.tsx:152` - Load button needs aria-label
- `search/page.tsx:267` - Save Search button needs aria-label

**A11Y-013 Details**: Missing `focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`

- `saved-searches-list.tsx:152` - Load search button
- `saved-searches-list.tsx:172` - Delete button

**PERF-011 Details**: Promise.race() timeout doesn't cancel Redis operation

- Locations: `keywords/route.ts:196`, `keywords/related/route.ts:133`
- Fix: Remove race, use fire-and-forget: `cache.set(...).catch(err => logger.error(...))`

---

## 🟡 MEDIUM PRIORITY - Deep Review 2026-01-02

**Value Score: 4-8 (Revenue:3, Retention:4, Differentiation:3)**
**Total Effort: 5 hours**

| ID           | Issue                                    | Category      | Effort | Status    |
| ------------ | ---------------------------------------- | ------------- | ------ | --------- |
| **SEC-016**  | Unbounded cache key scan (OOM risk)      | Security      | S      | 🟡 Medium |
| **TYPE-003** | Weak generic constraints on Redis get<T> | Type Safety   | M      | 🟡 Medium |
| **TYPE-005** | Redundant type assertion after Zod parse | Type Safety   | S      | 🟡 Medium |
| **ERR-002**  | Dynamic import error handling missing    | Reliability   | S      | 🟡 Medium |
| **A11Y-014** | Table scope attributes missing           | Accessibility | S      | 🟡 Medium |
| **A11Y-015** | Modal loading states need role="status"  | Accessibility | S      | 🟡 Medium |
| **PERF-012** | Sequential user operations in hot path   | Performance   | M      | 🟡 Medium |
| **PERF-013** | Rate limiter not truly atomic            | Performance   | M      | 🟡 Medium |
| **PERF-014** | Large bundle size (285KB Clerk chunk)    | Performance   | M      | 🟡 Medium |

**SEC-015 Details**: Webhook signature verification lacks timestamp validation

- Location: `webhooks/stripe/route.ts:135`
- **Exploit**: Replay old valid webhooks after 72-hour idempotency window
- Fix: Add `tolerance: 300` to `stripe.webhooks.constructEvent()`

**SEC-016 Details**: `purgeKeywordCache()` accumulates all keys in memory before deletion

- Location: `cache/redis.ts:307`
- **Exploit**: Millions of cache entries → OOM during purge
- Fix: Delete in streaming fashion: `await redis.del(...keys)` inside scan loop

**TYPE-003 Details**: `client.get<UserData>()` accepts any type without verification

- Fix: Add optional validation callback: `get<T>(key, validate?: (data: unknown) => T)`

**TYPE-004 Details**: SavedSearch.results typed as `z.array(z.any())`

- Location: `domain-schemas.ts:51`
- Fix: Create `KeywordDataSchema` with proper structure validation

**TYPE-005 Details**: `SavedSearchSchema.parse(raw) as SavedSearch` is redundant

- Location: `saved-searches-service.ts:170`
- Fix: Remove `as SavedSearch` (Zod already infers type)

**ERR-001 Details**: All errors show "Failed to load searches"

- Locations: saved-searches-list.tsx, save-search-modal.tsx, related-keywords-modal.tsx
- Fix: Parse `response.json()` to extract API error messages

**ERR-002 Details**: Dynamic imports lack `onError` callback

- Locations: auth-header-wrapper.tsx:7, keyword-results-table.tsx:14,22
- Fix: Add `onError: (err) => logger.error('Failed to load component', err)`

**A11Y-014 Details**: Related keywords table headers missing `scope="col"`

- Location: `related-keywords-modal.tsx:223-236`
- Fix: Add to all 4 headers (Keyword, Volume, Relevance, Action)

**A11Y-015 Details**: Modal loading spinners need screen reader announcements

- Locations: content-brief-modal.tsx:176, related-keywords-modal.tsx:181
- Fix: Add `role="status"` and `aria-live="polite"` to loading divs

**PERF-012 Details**: 3-5 sequential Redis calls per keyword request (15-75ms overhead)

- Location: `keywords/route.ts:108-156`
- Fix: Cache user tier in JWT claims, use Redis pipelines for multi-key ops

**PERF-013 Details**: Rate limiter has race between TTL check and INCR

- Location: `redis-rate-limiter.ts:345-391`
- Fix: Use Lua script for atomic TTL + INCR + EXPIRE operations

**PERF-014 Details**: Large chunks reducing initial load performance

- Clerk SDK: 285KB, Total: ~1.1MB uncompressed
- Fix: Run `ANALYZE=true npm run build`, aggressive code splitting, check if using full Clerk bundle

---

## 🔶 Test Coverage Improvements - Deep Review 2026-01-02

**Target: 70%+ on all modules | Current: 73.75% overall**

| ID           | Module                    | Current | Target | Effort | Status      |
| ------------ | ------------------------- | ------- | ------ | ------ | ----------- |
| **TEST-010** | saved-searches-service.ts | 13.76%  | 70%+   | M      | 🔴 Critical |
| **TEST-011** | user-service.ts           | 25.38%  | 70%+   | M      | 🔴 Critical |
| **TEST-012** | app/api/checkout/route.ts | 30.18%  | 70%+   | M      | 🟠 High     |

**TEST-010 Details**: Add integration tests for saved searches

- CRUD operations with Redis mocks
- Quota enforcement (50 limit)
- Redis failure scenarios
- MGET batch operations

**TEST-011 Details**: Add tests for user service

- Trial expiration logic
- Monthly reset atomicity (TTL-based)
- Tier upgrade scenarios
- Usage tracking edge cases

**TEST-012 Details**: Add Stripe integration tests

- Checkout session creation
- Price configuration
- Error handling
- Clerk integration

**Total Test Coverage Effort**: 8 hours to bring all modules above 70%

---

## 📋 Long-Term Improvements - Deep Review Recommendations

| ID           | Improvement                            | Category      | Effort | Status  |
| ------------ | -------------------------------------- | ------------- | ------ | ------- |
| **SEC-017**  | Audit logging for subscription changes | Security      | M      | 💭 Idea |
| **SEC-018**  | Encrypt PII in Redis (Stripe IDs)      | Security      | M      | 💭 Idea |
| **SEC-019**  | Add Content-Security-Policy headers    | Security      | S      | 💭 Idea |
| **SEC-020**  | Automated vulnerability scanning       | Security      | S      | 💭 Idea |
| **PERF-015** | API response streaming (large batches) | Performance   | L      | 💭 Idea |
| **PERF-016** | CDN caching headers for public APIs    | Performance   | S      | 💭 Idea |
| **OBS-001**  | OpenTelemetry tracing                  | Observability | M      | 💭 Idea |
| **OBS-002**  | Cache hit/miss rate monitoring         | Observability | S      | 💭 Idea |
| **A11Y-016** | Automated a11y testing in CI (axe)     | Accessibility | S      | 💭 Idea |
| **A11Y-017** | Custom confirmation modal (no confirm) | Accessibility | M      | 💭 Idea |
| **TYPE-006** | Enable strict: true in tsconfig        | Type Safety   | L      | 💭 Idea |

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
| **SEC-015**               | CSRF protection (token generation, validation, origin checking)  | 2026-01-03 |
| **TYPE-004**              | z.array(z.any()) → KeywordDataSchema (proper type safety)        | 2026-01-03 |
| **ERR-001**               | Status-code-specific error messages (400-504 user-friendly)      | 2026-01-03 |
| **A11Y-011**              | Color contrast fixes (9 additional components, WCAG 2.1 AA)      | 2026-01-03 |
| **A11Y-012**              | Form labels and ARIA attributes (match type legend)              | 2026-01-03 |
| **SEC-010**               | Trial period bypass race condition (distributed lock with SETNX) | 2026-01-02 |
| **SEC-011**               | Webhook replay attack idempotency (optimistic locking)           | 2026-01-02 |
| **TYPE-001**              | Stripe webhook Zod validation (CheckoutSession, Subscription)    | 2026-01-02 |
| **PERF-010**              | Usage tracking fire-and-forget (non-blocking)                    | 2026-01-02 |
| **SEC-012**               | Saved search quota TOCTOU fix (atomic SADD with rollback)        | 2026-01-02 |
| **SEC-013**               | Rate limit HMAC fallback removal (enforce in all environments)   | 2026-01-02 |
| **SEC-014**               | Cache key SHA-256 upgrade (64-bit entropy vs 25-bit)             | 2026-01-02 |
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

### Deep Review Items Scoring

**Security/Quality issues are scored differently from features:**

- **Critical Security Issues** (SEC-010, SEC-011, TYPE-001, PERF-010):
  - Revenue: 5 (prevent revenue loss, legal liability, churn)
  - Retention: 5 (users leave if service is unreliable/insecure)
  - Differentiation: 3 (security is table stakes but builds trust)
  - Priority Score: 13 ÷ effort (6.5 for M, 13 for S)

- **High Priority Issues** (TYPE-002, SEC-012-014, A11Y-011-013, PERF-011):
  - Revenue: 4 (reduces operational costs, prevents issues)
  - Retention: 5 (improves reliability and accessibility)
  - Differentiation: 4 (WCAG compliance, reliability)
  - Priority Score: 13 ÷ effort (6.5 for M, 13 for S)

- **Medium Priority Issues** (SEC-015-016, TYPE-003-005, ERR-001-002, A11Y-014-015, PERF-012-014):
  - Revenue: 3 (operational efficiency)
  - Retention: 4 (incremental UX/reliability improvements)
  - Differentiation: 3 (polish and edge case handling)
  - Priority Score: 10 ÷ effort (3.3-5 for M, 10 for S)

---

## Stats

- **MVP Status**: Complete
- **Deployment**: https://keyflash.vibebuildlab.com (Live)
- **Test Coverage**: 714 tests passing, ~84% line coverage (all tests passing after deep review fixes)
- **Tech Stack**: Next.js 16, TypeScript 5+, Tailwind v4, Vitest + Playwright
