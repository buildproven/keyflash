# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                  # Start local dev server
npm run build                # Production build
npm run lint                 # ESLint + Stylelint
npm run lint:fix             # Auto-fix lint issues
npm run type-check:all       # Type-check app + tests
npm test                     # Run all Vitest tests
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests only
npm run test:e2e             # Playwright E2E tests
npm run test:coverage:check  # Coverage with 70% gate
npm run quality:check        # type-check + lint + tests
npm run redis:start          # Start local Redis (Docker)
npm run security:audit       # npm audit (high severity)
npm run security:secrets     # gitleaks secrets scan
```

Run a single test file:
```bash
npx vitest run tests/unit/your-file.test.ts
```

## Architecture

**Next.js 16 App Router** app with TypeScript 5, Tailwind CSS v4, and Upstash Redis.

### Request Flow

```
Browser → middleware.ts (CSRF + CORS + auth) → src/app/api/**/route.ts → src/lib/
```

**Middleware** (`src/middleware.ts`) runs on every request edge: Clerk auth, CSRF token generation/validation, CORS headers, HSTS, CSP nonce injection. Webhook routes (`/api/webhooks/*`) skip CSRF (they use Stripe signature validation instead).

### API Provider Pattern (`src/lib/api/`)

Factory pattern selects the keyword data provider at runtime based on env vars:

```
createProvider() → DataForSEOProvider | GoogleAdsProvider | MockProvider
```

All providers implement `KeywordAPIProvider` from `src/lib/api/types.ts`. Without DataForSEO credentials, the app runs in **mock mode** automatically.

### Key `src/lib/` Modules

| Module | Purpose |
|---|---|
| `api/factory.ts` | Provider selection factory |
| `api/providers/` | DataForSEO + GoogleAds implementations |
| `billing.ts` | `BILLING_ENABLED` flag — gates Stripe/Pro features |
| `cache/` | Upstash Redis wrappers; cache key conventions |
| `rate-limit/` | Redis-based rate limiting (10 req/hr per IP) |
| `saved-searches/` | CRUD for user saved searches in Redis |
| `user/` | User service (tier resolution, Redis persistence) |
| `validation/schemas.ts` | Zod schemas for all API inputs |
| `ssrf-protection.ts` | URL validation for external fetches |

### API Routes (`src/app/api/`)

| Endpoint | Description |
|---|---|
| `POST /api/keywords` | Main keyword search (rate-limited, cached 7d) |
| `POST /api/keywords/related` | Related keyword lookup |
| `POST /api/content-brief` | Content brief generation |
| `GET/POST /api/searches` | List / create saved searches |
| `GET/PUT/DELETE /api/searches/[id]` | Single saved search CRUD |
| `POST /api/checkout` | Stripe checkout session |
| `POST /api/webhooks/stripe` | Stripe webhook (signature-validated) |
| `GET /api/health` | Health check (no auth/CSRF) |

### Redis Key Patterns

- Keywords: `kw:{location}:{language}:{matchType}:{hash}` (7d TTL)
- Users: `user:{clerkUserId}` (persistent)
- Saved searches: `saved-search:{userId}:{searchId}` (1yr TTL), indexed by `saved-searches:{userId}`

### Auth & Billing

- **Clerk** handles auth. Currently no protected routes are enforced (middleware has placeholder).
- **Billing** is opt-in via `BILLING_ENABLED=true`. When disabled, all features are free.
- User tiers (when billing enabled): Trial (7 days, mock data) → Pro (real DataForSEO data).

## Code Conventions

- `@/` path alias for `src/`
- Kebab-case filenames: `keyword-results-table.tsx`, `route.ts` for API endpoints
- Prettier enforced: 2-space indent, single quotes, no semicolons, 80-char width, `es5` trailing commas
- Zod validation at all API boundaries (`src/lib/validation/schemas.ts`)
- Pino for structured logging (`src/lib/logger.ts`)

## Testing

- Vitest with `happy-dom` for unit/integration/component tests
- Playwright for E2E (`tests/e2e/`)
- Test files: `*.test.ts`, `*.test.tsx`, `*.spec.ts` under `tests/`
- Coverage minimum: 70% lines and functions
- Test scopes: `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/smoke/`, `tests/config-validation/`, `tests/quality-automation/`
- Schema and DB config in `prisma/`. Long-form technical docs in `docs/`.

## Project Structure

```
src/
├── app/          # Next.js App Router pages, layout, and API routes (src/app/api/**/route.ts)
├── components/   # UI and feature components grouped by domain (tables, trends, saved-searches)
├── lib/          # Business logic, providers, caching, validation, observability, utilities
└── types/        # Shared TypeScript types
tests/            # Split by scope: unit, integration, e2e, smoke, config-validation, quality-automation
prisma/           # Schema and DB config
docs/             # Long-form technical docs
```

## PR Guidelines

PRs follow `.github/PULL_REQUEST_TEMPLATE.md`: link issues, summarize changes, include test evidence, note deployment/env impacts, attach screenshots/videos for UI updates. Run `npm run security:audit` and `npm run security:secrets` before merging security-sensitive changes.

## Environment Variables

Copy `.env.example` to `.env.local`. Key variables:

| Variable | Purpose |
|---|---|
| `KEYWORD_API_PROVIDER` | `dataforseo`, `google-ads`, or `mock` |
| `DATAFORSEO_API_LOGIN` / `DATAFORSEO_API_PASSWORD` | DataForSEO credentials |
| `BILLING_ENABLED` | `true` to enable Stripe payments |
| `PRIVACY_MODE` | `true` to disable keyword caching |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (used in CORS allowlist) |
| `ALLOWED_ORIGINS` | Comma-separated extra allowed CORS origins |

---
**Last Updated:** 2026-03-01
