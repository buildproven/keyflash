# Architecture Exceptions — KeyFlash

Purpose: document intentional deviations from the `saas-starter-kit` reference so reviewers understand what differs and why.

## Reference Baseline

- `saas-starter-kit` (Next.js App Router, Prisma/PostgreSQL, NextAuth, Stripe, Sentry, Vitest/Playwright).

## Deviations

- **Data Providers**: Uses Google Ads API or DataForSEO instead of a first-party DB for keyword metrics. Rationale: authoritative keyword data and latency targets (<3s). Mitigation: isolate provider adapters in `src/lib/api/providers/*` and keep fallbacks/mocks for tests.
- **Cache/Rate Limit**: Upstash Redis cache + custom spoof-resistant rate limiter (`src/lib/cache/redis.ts`, `src/lib/rate-limit/redis-rate-limiter.ts`) rather than starter middleware. Rationale: defend against scraping/abuse on public endpoints. Mitigation: enforce HMAC client identification and keep Redis optional for local dev.
- **Privacy Mode**: Toggle to disable keyword caching (`PRIVACY_MODE`). Rationale: user promise around data retention. Mitigation: default caching ON for performance; document behavior for compliance reviews.
- **Styling**: Tailwind CSS v4 preview. Rationale: new engine gains. Mitigation: pin versions; run visual smoke tests before upgrades.
- **State Management**: No global client store yet (Zustand planned). Rationale: pages are server-driven; UI state is local. Mitigation: add slices when batching/filtering UI grows.
- **Observability**: Sentry added with conservative sampling (20% traces, 10% replay) and DSN gating. Rationale: control cost while usage scales. Mitigation: adjust sampling during incidents; set `SENTRY_ENVIRONMENT` per stage.

## Cleanup Plan

- Add Playwright smoke path for search -> results -> export.
- Introduce Zustand slices if multi-step batch flows grow.
- Consider adding provider health metrics to Sentry breadcrumbs for faster incident triage.
