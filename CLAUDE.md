# KeyFlash - Claude Guide

> AI-powered keyword research tool - 10x cheaper and faster than enterprise tools.

**Status**: MVP Phase | **License**: AGPL-3.0

## Tech Stack

| Layer     | Technology                  |
| --------- | --------------------------- |
| Framework | Next.js 16 (App Router)     |
| Language  | TypeScript 5+ (strict)      |
| Styling   | Tailwind CSS v4             |
| Cache     | Upstash Redis               |
| APIs      | Google Ads API → DataForSEO |
| Testing   | Vitest + Playwright         |
| Hosting   | Vercel                      |

## Key Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm test                 # Run all tests
npm run lint             # Lint code
npm run quality:check    # Full quality check
npm run validate:all     # Comprehensive validation
```

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── lib/
│   ├── api/            # Provider factory + implementations
│   ├── cache/          # Redis caching
│   ├── rate-limit/     # Rate limiting
│   └── validation/     # Zod schemas
└── types/              # TypeScript definitions
```

## Critical Patterns

### API Provider Factory

```typescript
// lib/api/factory.ts - switch providers via KEYWORD_API_PROVIDER env
createProvider() // returns GoogleAdsProvider | DataForSEOProvider | MockProvider
```

### Caching

- Key: `kw:${location}:${language}:${matchType}:${hash(keywords)}`
- TTL: 7 days
- Privacy mode: `PRIVACY_MODE=true` disables caching

### Security (see docs/SECURITY.md)

- SSRF protection: `lib/ssrf-protection.ts`
- Token encryption: `lib/encryption.ts` (AES-256-GCM)
- Input validation: Zod schemas required

## What NOT to Do

- Don't commit secrets (pre-commit hook scans)
- Don't skip rate limiting (10 req/hour per IP)
- Don't store tokens unencrypted
- Don't fetch URLs without SSRF protection
- Don't use `any` types
- Don't store user searches (privacy-first)

## Key Files

- `lib/api/factory.ts` - Provider selection logic
- `lib/ssrf-protection.ts` - External URL security
- `lib/encryption.ts` - Token encryption
- `.env.example` - Required environment variables

## Docs

- `docs/REQUIREMENTS.md` - Feature scope
- `docs/SECURITY.md` - Security controls (CRITICAL)
- `docs/ARCHITECTURE.md` - Design decisions

---

_70% test coverage target. See `docs/` for details. Global rules in `~/.claude/CLAUDE.md`._
