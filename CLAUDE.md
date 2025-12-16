# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

KeyFlash is an AI-powered keyword research tool built with Next.js 16 (App Router), TypeScript 5+, and Tailwind CSS v4. It uses Upstash Redis for caching and supports multiple API providers (Google Ads, DataForSEO, or mock).

## Key Commands

```bash
npm run dev                 # Start dev server (localhost:3000)
npm run build               # Production build
npm test                    # Run all Vitest tests
npm run test:watch          # Watch mode for tests
npm run test:unit           # Unit tests only (tests/unit/)
npm run test:integration    # Integration tests (tests/integration/)
npm run test:e2e            # Playwright E2E tests
npm run lint                # ESLint + Stylelint
npm run type-check:all      # TypeScript check (src + tests)
npm run quality:check       # Type-check + lint + test (run before commits)
npm run redis:start         # Start local Redis via Docker
```

## Architecture

### API Provider Pattern

The codebase uses a factory pattern for keyword data providers (`src/lib/api/factory.ts`):

```
createProvider() → GoogleAdsProvider | DataForSEOProvider | MockProvider
```

Switch providers via `KEYWORD_API_PROVIDER` env var. All providers implement `KeywordAPIProvider` interface with `getKeywordData()`, `getRelatedKeywords()`, `getBatchLimit()`, and `getRateLimit()`.

### API Routes

- `POST /api/keywords` - Main keyword search endpoint
- `POST /api/keywords/related` - Related keywords lookup
- `POST /api/content-brief` - Content brief generation
- `GET /api/health` - Health check

### Security Layers

1. **Rate limiting**: Redis-based, 10 req/hour per IP (`src/lib/rate-limit/`)
2. **Input validation**: Zod schemas in `src/lib/validation/schemas.ts`
3. **SSRF protection**: `src/lib/ssrf-protection.ts` for external URL fetching
4. **Token encryption**: AES-256-GCM via `src/lib/encryption.ts`

### Caching

- Redis cache key: `kw:${location}:${language}:${matchType}:${hash(keywords)}`
- TTL: 7 days
- `PRIVACY_MODE=true` disables all caching

## Configuration

Copy `.env.example` to `.env.local` for local development. Key variables:

- `KEYWORD_API_PROVIDER` - `mock` (default), `google-ads`, or `dataforseo`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - Redis connection
- `RATE_LIMIT_FAIL_SAFE` - `closed` (secure) or `open` (available when Redis fails)
- `PRIVACY_MODE` - `true` to disable keyword caching

## Constraints

- All external URL fetches must use SSRF protection utilities
- Pre-commit hooks run lint, format, type-check, and secret scanning
- 70% test coverage target
- No `any` types - use proper TypeScript interfaces
- No user search data stored (privacy-first design)

## Docs

- `docs/SECURITY.md` - Security controls and threat model
- `docs/ARCHITECTURE.md` - System design and scaling path
- `docs/REQUIREMENTS.md` - Feature specifications
