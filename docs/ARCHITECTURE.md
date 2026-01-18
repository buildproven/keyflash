# keyflash - Architecture

**Updated:** 2025-12-30
**Framework:** Next.js 16 (App Router)
**Maturity:** production-ready

## Overview

KeyFlash is an AI-powered keyword research tool built with Next.js 16 (App Router), TypeScript 5+, and Tailwind CSS v4. It uses Upstash Redis for caching and user data persistence, Clerk for authentication, and Stripe for payments.

## Tech Stack

| Layer           | Technology              |
| --------------- | ----------------------- |
| Framework       | Next.js 16 (App Router) |
| Language        | TypeScript 5+           |
| Styling         | Tailwind CSS v4         |
| Auth            | Clerk                   |
| Payments        | Stripe                  |
| Cache/Storage   | Upstash Redis           |
| Testing         | Vitest + Playwright     |
| Package Manager | npm                     |

## Project Structure

```
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes (12 endpoints)
│   │   ├── search/          # Search page
│   │   └── layout.tsx       # Root layout with auth
│   ├── components/          # React components
│   │   ├── layout/          # Layout components (auth header)
│   │   ├── saved-searches/  # Saved searches UI
│   │   └── ...              # Feature components
│   ├── lib/                 # Shared utilities
│   │   ├── api/             # API provider factory
│   │   ├── cache/           # Redis cache utilities
│   │   ├── rate-limit/      # Rate limiting
│   │   ├── saved-searches/  # Saved searches service
│   │   ├── user/            # User service
│   │   └── validation/      # Zod schemas
│   └── types/               # TypeScript types
├── tests/                   # Test files
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── e2e/                 # Playwright E2E tests
└── docs/                    # Documentation
```

## Key Components

### API Provider Pattern

Factory pattern for keyword data providers (`src/lib/api/factory.ts`):

```
createProvider() → GoogleAdsProvider | DataForSEOProvider | MockProvider
```

All providers implement `KeywordAPIProvider` interface.

### API Endpoints

| Endpoint                | Method | Description              |
| ----------------------- | ------ | ------------------------ |
| `/api/keywords`         | POST   | Main keyword search      |
| `/api/keywords/related` | POST   | Related keywords lookup  |
| `/api/content-brief`    | POST   | Content brief generation |
| `/api/checkout`         | POST   | Stripe checkout session  |
| `/api/webhooks/stripe`  | POST   | Stripe webhook handler   |
| `/api/health`           | GET    | Health check             |
| `/api/searches`         | GET    | List saved searches      |
| `/api/searches`         | POST   | Create saved search      |
| `/api/searches/[id]`    | GET    | Get saved search         |
| `/api/searches/[id]`    | PUT    | Update saved search      |
| `/api/searches/[id]`    | DELETE | Delete saved search      |

### Authentication & Payments

- **Auth**: Clerk (`@clerk/nextjs`) - handles sign up, sign in, user management
- **Lazy Loading**: Auth UI components are dynamically imported with `ssr: false` to reduce initial bundle
- **Billing Toggle**: Set `BILLING_ENABLED=true` to enable Stripe payments (disabled by default)
- **Open Source Mode**: When billing is disabled, all features are free and unlimited
- **Payments** (when enabled): Stripe subscriptions for Pro tier
- **User tiers** (when billing enabled): Trial (7 days, mock data) → Pro (real DataForSEO data)

### Saved Searches

Users can save, load, and delete keyword searches:

- **Storage**: Redis with 1-year TTL
- **Limit**: 50 saved searches per user
- **Key pattern**: `saved-search:{userId}:{searchId}`
- **Index**: `saved-searches:{userId}` (Set of search IDs)

### Security Layers

1. **Rate limiting**: Redis-based, 10 req/hour per IP
2. **Input validation**: Zod schemas
3. **SSRF protection**: URL validation for external fetches
4. **Token encryption**: AES-256-GCM

### Caching

- **Keywords**: `kw:${location}:${language}:${matchType}:${hash}` (7 days TTL)
- **Users**: `user:${clerkUserId}` (persistent)
- **Saved searches**: 1 year TTL
- `PRIVACY_MODE=true` disables keyword caching

## Performance Optimizations

- **Lazy-loaded Auth**: Clerk UI components loaded dynamically to reduce initial bundle
- **SSR-safe imports**: Client wrapper pattern for dynamic imports
- **Loading skeletons**: Placeholder UI during auth component loading

## Quality Standards

| Metric        | Target            |
| ------------- | ----------------- |
| Test Coverage | 70%               |
| Unit Tests    | 544+              |
| E2E Tests     | Playwright        |
| Type Safety   | Strict TypeScript |

---

_Updated 2025-12-30 with saved searches and lazy loading features_

---

> **Vibe Build Lab LLC** · [vibebuildlab.com](https://vibebuildlab.com)
