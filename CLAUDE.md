# KeyFlash - Claude Development Guide

> **AI-powered keyword research tool** - Fast, simple, and affordable keyword data for entrepreneurs and marketers.

**Last Updated**: 2025-12-05
**Status**: Early Development (MVP Phase)
**License**: AGPL-3.0

---

## Project Overview

### What is KeyFlash?

KeyFlash is a keyword research tool designed to be **10x cheaper** and **10x faster** than enterprise tools like Ahrefs, SEMrush, and Moz.

**Core Value Proposition**:

- Results in <3 seconds
- Maximum 3 clicks from landing to results
- Privacy-first (no search data stored)
- Open source with hosted SaaS option

**Target Users**:

- Solo entrepreneurs validating content ideas
- Content creators researching blog/video topics
- Small marketing teams who don't need enterprise tools
- SEO beginners learning keyword research

**Business Model**:

- Free tier: 5 searches/day, 50/month
- Pro tier: Included in Vibe Lab Pro membership ($49/mo)

---

## Tech Stack

| Layer         | Technology                          |
| ------------- | ----------------------------------- |
| **Framework** | Next.js 16 (App Router)             |
| **Language**  | TypeScript 5+                       |
| **Runtime**   | Node.js 20+                         |
| **Styling**   | Tailwind CSS                        |
| **Caching**   | Upstash Redis                       |
| **APIs**      | Google Ads API → DataForSEO (scale) |
| **Testing**   | Vitest + Playwright                 |
| **Hosting**   | Vercel                              |
| **Linting**   | ESLint + Prettier + Stylelint       |
| **Quality**   | Husky, lint-staged                  |

---

## Key Commands

### Development

```bash
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Build for production
npm start                # Start production server
```

### Testing

```bash
npm test                 # Run all unit/integration tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # End-to-end tests (Playwright)
npm run test:e2e:ui      # E2E tests with UI
npm run test:all         # All tests (unit + integration + e2e)
npm run test:ci          # CI test suite
```

### Code Quality

```bash
npm run lint             # Lint TypeScript + CSS
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format all files with Prettier
npm run format:check     # Check formatting (CI)
npm run type-check       # TypeScript type checking
npm run type-check:all   # Type check src + tests
npm run quality:check    # Full quality check (types + lint + test)
```

### Security

```bash
npm run security:audit   # Check for vulnerabilities
npm run security:secrets # Scan for hardcoded secrets
npm run validate:all     # Comprehensive validation + security
```

### Redis (Development)

```bash
npm run redis:start      # Start local Redis via Docker
npm run redis:stop       # Stop Redis container
npm run redis:clean      # Remove Redis container
npm run redis:logs       # View Redis logs
```

---

## Project Structure

```
keyflash/
├── docs/                           # Project documentation
│   ├── REQUIREMENTS.md            # Product requirements (READ FIRST)
│   ├── ARCHITECTURE.md            # Tech stack & design decisions
│   ├── SECURITY.md                # Security strategy (CRITICAL)
│   └── TESTING_STRATEGY.md        # Testing approach
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Landing page
│   │   └── globals.css           # Global styles
│   │
│   ├── lib/                       # Core business logic
│   │   ├── api/
│   │   │   ├── factory.ts        # Provider factory (Google Ads/DataForSEO/Mock)
│   │   │   ├── types.ts          # API interfaces
│   │   │   └── providers/        # API provider implementations
│   │   │       ├── google-ads.ts
│   │   │       └── dataforseo.ts
│   │   │
│   │   └── rate-limit/
│   │       └── rate-limiter.ts   # In-memory rate limiting
│   │
│   └── types/                     # TypeScript type definitions
│
├── tests/
│   ├── unit/                      # Unit tests (60% coverage target)
│   ├── integration/               # Integration tests (30%)
│   ├── e2e/                       # End-to-end tests (10%)
│   └── setup.ts                   # Test configuration
│
├── .env.example                   # Environment variable template
├── eslint.config.cjs              # ESLint configuration
├── next.config.js                 # Next.js + security headers
├── tailwind.config.js             # Tailwind CSS config
├── tsconfig.json                  # TypeScript config
├── vitest.config.ts               # Vitest config
└── playwright.config.ts           # Playwright E2E config
```

---

## Architecture & Patterns

### API Provider Pattern

KeyFlash uses a **factory pattern** to support multiple keyword APIs:

```typescript
// lib/api/factory.ts
export function createProvider(): KeywordAPIProvider {
  const provider = process.env.KEYWORD_API_PROVIDER || 'mock'

  switch (provider) {
    case 'google-ads':
      return new GoogleAdsProvider()
    case 'dataforseo':
      return new DataForSEOProvider()
    case 'mock':
      return new MockProvider() // For development
  }
}
```

**All providers implement**:

```typescript
interface KeywordAPIProvider {
  name: string
  getKeywordData(
    keywords: string[],
    options: SearchOptions
  ): Promise<KeywordData[]>
  getBatchLimit(): number
  getRateLimit(): RateLimit
  validateConfiguration(): void
}
```

### Caching Strategy

```typescript
// Cache key structure
cache_key = `kw:${location}:${language}:${matchType}:${hash(keywords)}`

// Flow:
1. Check Redis cache
2. If HIT: return cached data (instant)
3. If MISS: fetch from API, cache for 7 days, return data
```

**Cache TTL**: 7 days (keyword data rarely changes weekly)

### Rate Limiting

**In-memory rate limiter** (MVP):

- Default: 10 requests/hour per IP
- Tracks by `x-forwarded-for` or `x-real-ip` headers
- Auto-cleanup of expired entries

**Future**: Redis-based distributed rate limiting for production scale

---

## Important Conventions

### Code Style

**File Naming**:

- Components: `PascalCase.tsx`
- Utilities: `kebab-case.ts`
- CSS: `kebab-case.css`

**Import Order**:

```typescript
// 1. React
import { useState } from 'react'

// 2. Third-party
import { z } from 'zod'

// 3. Internal (use @ alias)
import { createProvider } from '@/lib/api/factory'
import type { KeywordData } from '@/types/keyword'
```

**TypeScript**:

- Always use strict types (no `any`)
- Use `interface` for public APIs
- Use `type` for unions/intersections
- Prefer `const` over `let`

### Testing

**Testing Pyramid** (70% overall coverage target):

- 60% Unit tests
- 30% Integration tests
- 10% E2E tests

**Test Structure**:

```typescript
describe('FeatureName', () => {
  it('does something specific', () => {
    // Arrange
    const input = setupTest()

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toBe(expected)
  })
})
```

### Git Workflow

**Branch Naming**:

- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation
- `refactor/*` - Code refactoring
- `test/*` - Adding tests

**Commit Messages** (Conventional Commits):

```bash
feat(api): add DataForSEO provider support
fix(ui): correct keyword input validation
docs(readme): update installation instructions
test(api): add rate limiting tests
```

---

## Security Guidelines

⚠️ **CRITICAL**: Read `docs/SECURITY.md` before writing any code.

### Non-Negotiable Rules

1. **NEVER commit secrets**
   - Use `.env.local` only
   - Pre-commit hook scans for hardcoded secrets
   - Verify `.gitignore` includes `.env*.local`

2. **ALWAYS validate user input**
   - Use Zod schemas for validation
   - Sanitize before processing
   - Never trust client-side data

3. **Prevent injection attacks**
   - No `eval()`, `Function()`, or `innerHTML` with user input
   - Use parameterized queries
   - Escape output properly

4. **Rate limiting required**
   - Implement per-IP rate limiting
   - Default: 10 requests/hour per IP
   - Configurable via environment variables

5. **Privacy by design**
   - Do NOT store user keyword searches
   - Minimal data collection
   - GDPR/CCPA compliant

### Security Checks (CI/CD)

Automated security scanning checks for:

- Hardcoded secrets
- XSS vulnerability patterns (`innerHTML`, `eval`, `document.write`)
- Unvalidated user inputs
- npm security vulnerabilities
- Configuration security issues

---

## Environment Variables

```bash
# API Provider Selection
KEYWORD_API_PROVIDER=mock  # or 'google-ads' | 'dataforseo'

# Google Ads API (Phase 1 - MVP)
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=

# DataForSEO API (Phase 2 - Scale)
DATAFORSEO_API_LOGIN=
DATAFORSEO_API_PASSWORD=

# Redis Cache (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_HOUR=10
RATE_LIMIT_ENABLED=true
```

**Setup**:

```bash
cp .env.example .env.local
# Edit .env.local with your credentials
# NEVER commit .env.local
```

---

## Development Workflow

### 1. Setup

```bash
# Clone and install
git clone https://github.com/brettstark73/keyflash.git
cd keyflash
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with API keys

# Start development server
npm run dev
```

### 2. Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature

# Write code + tests
# Pre-commit hook automatically runs:
# - Prettier formatting
# - ESLint linting
# - Stylelint validation
# - TypeScript type checking (staged files only)

# Commit
git commit -m "feat(scope): description"

# Push and create PR
git push origin feature/your-feature
```

### 3. Quality Checks

Before pushing:

```bash
npm run quality:check     # Type check + lint + test
npm run test:coverage     # Verify test coverage
npm run security:audit    # Check for vulnerabilities
```

### 4. Deployment

**Auto-deploy on merge to `main`**:

- Vercel builds and deploys automatically
- Preview deployments for PRs
- Zero-downtime deployments

---

## Common Tasks

### Adding a New Feature

1. **Check requirements** - Ensure feature aligns with `docs/REQUIREMENTS.md`
2. **Check out-of-scope** - Verify not listed as out-of-scope for MVP
3. **Create branch** - `git checkout -b feature/feature-name`
4. **Write tests first** (TDD recommended)
5. **Implement feature**
6. **Update documentation**
7. **Run quality checks** - `npm run quality:check`
8. **Commit and PR**

### Adding a New API Provider

1. Create provider class: `src/lib/api/providers/provider-name.ts`
2. Implement `KeywordAPIProvider` interface
3. Add to factory: `src/lib/api/factory.ts`
4. Write unit tests with mocked API responses
5. Write integration tests (if possible with real API)
6. Update `.env.example` with required variables
7. Update `docs/ARCHITECTURE.md` with provider documentation

### Fixing a Bug

1. Create branch: `git checkout -b fix/bug-description`
2. Write failing test that reproduces bug
3. Fix the bug
4. Verify test passes
5. Run quality checks
6. Commit: `git commit -m "fix(scope): description"`
7. Push and create PR

---

## Testing Strategy

### Unit Tests (Vitest)

```bash
npm run test:unit        # Run unit tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
```

**What to test**:

- Pure functions and utilities
- React components (user interactions)
- API provider implementations (mocked)
- Input validation and sanitization
- Error handling

### Integration Tests (Vitest)

```bash
npm run test:integration
```

**What to test**:

- API routes end-to-end
- Cache integration (Redis)
- Provider factory with real providers
- Rate limiting behavior

### E2E Tests (Playwright)

```bash
npm run test:e2e         # Headless
npm run test:e2e:ui      # With UI
npm run test:e2e:headed  # See browser
npm run test:e2e:debug   # Debug mode
```

**What to test**:

- User flows (landing → search → results)
- Keyword search submission
- CSV export functionality
- Error states and messaging

### Coverage Goals

**Overall**: 70% minimum

- Unit: 60%
- Integration: 30%
- E2E: 10%

**Run coverage report**:

```bash
npm run test:coverage
open coverage/index.html
```

---

## Deployment

### Environments

**Development**:

- Local: `npm run dev` (http://localhost:3000)
- Uses `.env.local` for API keys
- Hot reload enabled

**Preview**:

- Auto-deployed by Vercel on PR creation
- Unique URL: `keyflash-pr-123.vercel.app`
- Uses staging API keys
- Deleted when PR closed

**Production**:

- Domain: TBD (waiting for domain purchase)
- Auto-deployed on merge to `main`
- Uses production API keys
- Zero-downtime deployments

### Pre-Deployment Checklist

```bash
✅ All tests passing (npm test)
✅ No TypeScript errors (npm run type-check)
✅ No ESLint errors (npm run lint)
✅ No security vulnerabilities (npm run security:audit)
✅ Environment variables configured
✅ Redis connection tested
✅ API credentials validated
```

### Post-Deployment Verification

```bash
✅ Health check endpoint returns 200
✅ Can complete a keyword search
✅ Cache is working (check Redis)
✅ Rate limiting active
✅ Error tracking active (future: Sentry)
```

---

## Performance Targets

### Bundle Size

- First Load JS: <200KB
- Total page size: <500KB
- Largest Contentful Paint: <2.5s

### API Response

- <3 seconds for batches up to 50 keywords
- <8 seconds for 100-200 keyword batches
- Cache hit rate: >70%

### Lighthouse CI

Minimum thresholds:

- Performance: 80%
- SEO: 90% (blocks deployment if fails)
- Accessibility: 80%

```bash
npm run lighthouse:ci    # Run Lighthouse checks
```

---

## Important Documentation

### Must-Read Before Coding

1. **README.md** - Project overview and quick start
2. **docs/REQUIREMENTS.md** - Product requirements, features, out-of-scope
3. **docs/ARCHITECTURE.md** - Tech stack rationale, system design
4. **docs/SECURITY.md** - Security threats, controls, compliance ⚠️ CRITICAL
5. **docs/TESTING_STRATEGY.md** - Testing pyramid, coverage goals

### When to Update Documentation

**Always update when**:

- Adding new features
- Changing API behavior
- Modifying environment variables
- Updating dependencies with breaking changes
- Adding new testing patterns
- Changing security controls

---

## Troubleshooting

### Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep keyflash-redis

# Start Redis
npm run redis:start

# View logs
npm run redis:logs
```

### API Provider Issues

**Mock provider not working**:

```bash
# Verify environment variable
echo $KEYWORD_API_PROVIDER  # Should be 'mock' or empty

# Or set explicitly
export KEYWORD_API_PROVIDER=mock
npm run dev
```

**Google Ads API errors**:

- Verify all credentials in `.env.local`
- Check Google Ads account is active
- Confirm Developer Token is approved
- See provider `validateConfiguration()` for detailed error messages

### Test Failures

```bash
# Run tests in watch mode to debug
npm run test:watch

# Run specific test file
npm test -- path/to/test.test.ts

# Check coverage gaps
npm run test:coverage
```

---

## AI Assistant Guidelines

### When Working on KeyFlash

1. **Read documentation first**
   - Check `docs/REQUIREMENTS.md` for feature scope
   - Check `docs/SECURITY.md` for security requirements
   - Check `docs/ARCHITECTURE.md` for design decisions

2. **Follow existing patterns**
   - Use provider factory for API integrations
   - Follow TypeScript strict mode
   - Maintain consistent naming conventions

3. **Security is paramount**
   - Never commit secrets
   - Always validate user input with Zod
   - Follow OWASP Top 10 guidelines
   - Check for XSS and injection attacks

4. **Test everything**
   - Write tests before or with code (TDD)
   - Maintain 70% coverage minimum
   - Test edge cases and error states

5. **Document changes**
   - Update relevant documentation
   - Add JSDoc comments for complex logic
   - Use TypeScript for self-documenting code

6. **Run quality checks before committing**
   ```bash
   npm run lint:fix
   npm run type-check:all
   npm test
   npm run validate:all
   ```

### Questions to Ask Before Coding

- Is this feature in scope for MVP? (Check `docs/REQUIREMENTS.md`)
- Are there security implications? (Check `docs/SECURITY.md`)
- What tests are needed? (Check `docs/TESTING_STRATEGY.md`)
- Does this follow the existing architecture?
- Are there existing patterns to follow?

---

## Project Status

### Current Phase: Early Development (MVP)

**Completed** ✅:

- Project structure and configuration
- Comprehensive documentation
- Quality automation (ESLint, Prettier, Husky)
- Testing infrastructure (Vitest, Playwright)
- API provider abstraction layer
- Basic UI scaffolding
- Security headers and configuration

**In Progress** 🔄:

- API provider implementations (Google Ads, DataForSEO)
- Keyword search UI/UX
- Redis caching integration
- Rate limiting implementation

**Upcoming** ⏳:

- User authentication (future)
- Database integration (future)
- Advanced features (see `docs/REQUIREMENTS.md`)

### Known Limitations

- No database (MVP is stateless)
- In-memory rate limiting (not distributed)
- Mock provider for development only
- No user accounts or saved searches (MVP)

---

## Quick Reference

### Essential URLs

- **Repository**: https://github.com/brettstark73/keyflash
- **License**: AGPL-3.0
- **Issues**: https://github.com/brettstark73/keyflash/issues

### Key Constraints

- **Node Version**: 20+ (enforced by Volta, `.nvmrc`, `package.json`)
- **Test Coverage**: 70% minimum overall
- **SEO Score**: 90% minimum (Lighthouse CI)
- **API Response Time**: <3 seconds (p95)
- **Bundle Size**: First Load JS <200KB

### Critical Security Rules

1. ❌ NEVER commit API keys or secrets
2. ❌ NEVER use `eval()`, `Function()`, or `innerHTML` with user input
3. ❌ NEVER trust client-side data without validation
4. ✅ ALWAYS validate with Zod schemas
5. ✅ ALWAYS sanitize user input
6. ✅ ALWAYS implement rate limiting

---

## Getting Help

### Resources

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions, share ideas
- **Documentation**: Check `docs/` folder for detailed guides

### Contact

- Maintained by: **Vibe Build Lab LLC**
- Website: https://www.vibebuildlab.com

---

**Happy coding! Let's build something amazing.** 🚀

**Version**: 1.0
**Last Updated**: 2025-12-05
**Next Review**: After API provider implementation
