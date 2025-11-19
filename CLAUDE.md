# CLAUDE.md - AI Assistant Guide for KeyFlash

> **Purpose**: This document helps AI assistants understand the KeyFlash codebase, development workflows, and conventions to follow when making contributions.

**Last Updated**: 2025-11-19
**Repository**: https://github.com/brettstark73/keyflash
**License**: AGPL-3.0

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Codebase Structure](#codebase-structure)
3. [Development Workflow](#development-workflow)
4. [Code Conventions](#code-conventions)
5. [Testing Requirements](#testing-requirements)
6. [Security Guidelines](#security-guidelines)
7. [Quality Automation](#quality-automation)
8. [API Integration Patterns](#api-integration-patterns)
9. [Documentation Standards](#documentation-standards)
10. [Common Tasks](#common-tasks)

---

## Project Overview

### What is KeyFlash?

KeyFlash is an **open-source keyword research tool** designed to be:

- **Fast**: Results in <3 seconds
- **Simple**: Maximum 3 clicks from landing to results
- **Affordable**: 10x cheaper than competitors (Ahrefs, SEMrush, Moz)

**Business Model**: Public open-source repository + Hosted SaaS with free/paid tiers

### Core Value Proposition

KeyFlash solves a single problem exceptionally well: **fast, affordable keyword research** for entrepreneurs, content creators, and small marketing teams who don't need expensive enterprise SEO tools.

### Technology Stack

```
Frontend:  Next.js 14+ (App Router), React 18, Tailwind CSS
Backend:   Next.js API Routes (serverless)
Language:  TypeScript 5+
Caching:   Upstash Redis
APIs:      Google Ads API → DataForSEO (scale)
Hosting:   Vercel
Testing:   Vitest + Playwright
Quality:   ESLint, Prettier, Stylelint, Husky, lint-staged
```

### Project Status

**Current Phase**: Post-Setup, Pre-MVP Development

- ✅ Project structure created
- ✅ Comprehensive documentation written
- ✅ Quality automation configured
- ⏳ UI/UX implementation (next step)
- ⏳ API integration (pending)
- ⏳ Core functionality (pending)

---

## Codebase Structure

### Directory Organization

```
keyflash/
├── .github/
│   └── workflows/
│       └── quality.yml         # CI/CD quality checks
│
├── claudedocs/                 # Claude-specific documentation
│   ├── PROJECT_SETUP_SUMMARY.md
│   └── QUALITY_AUTOMATION_SETUP.md
│
├── docs/                       # Main project documentation
│   ├── REQUIREMENTS.md         # Product requirements & features
│   ├── ARCHITECTURE.md         # Tech stack & system design
│   ├── SECURITY.md            # Security strategy (CRITICAL - read this!)
│   └── TESTING_STRATEGY.md    # Testing approach & coverage
│
├── public/                     # Static assets (future)
│   ├── images/
│   └── favicon.ico
│
├── src/                        # Source code (to be created)
│   ├── app/                   # Next.js App Router
│   │   ├── api/
│   │   │   ├── keywords/      # Keyword search API route
│   │   │   │   └── route.ts
│   │   │   └── health/        # Health check endpoint
│   │   │       └── route.ts
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   └── search/            # Keyword search UI
│   │       └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   ├── forms/             # Form components
│   │   └── tables/            # Keyword results table
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── providers/     # API provider implementations
│   │   │   │   ├── google-ads.ts
│   │   │   │   └── dataforseo.ts
│   │   │   ├── factory.ts     # Provider factory pattern
│   │   │   └── types.ts       # Shared API types
│   │   │
│   │   ├── cache/
│   │   │   └── redis.ts       # Redis cache client
│   │   │
│   │   ├── validation/
│   │   │   └── schemas.ts     # Zod validation schemas
│   │   │
│   │   └── utils/
│   │       ├── rate-limit.ts
│   │       └── error-handler.ts
│   │
│   ├── hooks/                 # React custom hooks
│   ├── types/                 # TypeScript type definitions
│   └── config/
│       └── constants.ts       # App constants
│
├── tests/                     # Testing (to be created)
│   ├── unit/                  # Unit tests (60% coverage target)
│   ├── integration/           # Integration tests (30%)
│   └── e2e/                   # E2E tests (10%)
│
├── scripts/
│   └── setup-env.sh           # Environment setup helper
│
├── .env.example               # Environment variable template
├── .eslintignore              # ESLint ignore patterns
├── .gitignore                 # Git ignore patterns
├── .husky/                    # Git hooks
│   └── pre-commit            # Pre-commit hook
├── .lighthouserc.js          # Lighthouse CI config
├── .nvmrc                     # Node version (20)
├── .prettierrc               # Prettier config
├── .prettierignore           # Prettier ignore patterns
├── .stylelintrc.json         # Stylelint config
├── CONTRIBUTING.md           # Contribution guidelines
├── LICENSE                   # AGPL-3.0 license
├── README.md                 # Project overview
├── eslint.config.cjs         # ESLint flat config
├── package.json              # Dependencies & scripts
└── package-lock.json         # Locked dependencies
```

### Key Files to Understand

Before making changes, read these files in order:

1. **README.md** - High-level project overview
2. **docs/REQUIREMENTS.md** - Product requirements, features, out-of-scope items
3. **docs/ARCHITECTURE.md** - Tech stack rationale, system design, scaling strategy
4. **docs/SECURITY.md** - Security threats, controls, compliance (CRITICAL)
5. **docs/TESTING_STRATEGY.md** - Testing pyramid, coverage goals, frameworks
6. **CONTRIBUTING.md** - Code style, naming conventions, workflow

---

## Development Workflow

### Setting Up Development Environment

```bash
# Prerequisites
# - Node.js 20+
# - pnpm 8+ (or npm/yarn)
# - Git

# 1. Clone the repository
git clone https://github.com/brettstark73/keyflash.git
cd keyflash

# 2. Install dependencies
pnpm install  # or npm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Add your API keys to .env.local
# See docs/API_INTEGRATION.md (to be created) for setup

# 5. Run development server (when code is ready)
pnpm dev  # http://localhost:3000
```

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description

# 2. Make changes
# - Write code
# - Add tests
# - Update documentation

# 3. Pre-commit hook runs automatically on git commit
# - Prettier formatting
# - ESLint linting
# - Stylelint validation
# - Only checks staged files

# 4. Commit with Conventional Commits format
git commit -m "feat(api): add DataForSEO provider support"
git commit -m "fix(ui): correct keyword input validation"
git commit -m "docs(readme): update installation instructions"

# 5. Push to remote
git push origin feature/your-feature-name

# 6. Create Pull Request on GitHub
# - Fill in PR template
# - CI/CD quality checks run automatically
```

### Branch Naming Conventions

- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation only
- `refactor/*` - Code refactoring
- `test/*` - Adding tests
- `chore/*` - Maintenance tasks

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

Types:
- feat:     New feature
- fix:      Bug fix
- docs:     Documentation
- style:    Code style (formatting, no logic change)
- refactor: Code refactoring
- test:     Adding/updating tests
- chore:    Maintenance tasks

Examples:
feat(api): add keyword search endpoint
fix(validation): prevent injection attacks
docs(security): update API key management guide
test(api): add rate limiting tests
```

---

## Code Conventions

### TypeScript

**Always use TypeScript with strict type checking**

```typescript
// ✅ GOOD - Explicit types, clear interfaces
interface KeywordData {
  keyword: string
  searchVolume: number
  difficulty: number
  cpc: number
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational'
}

async function fetchKeywords(
  keywords: string[],
  options: SearchOptions
): Promise<KeywordData[]> {
  // Implementation
}

// ❌ AVOID - No types, unclear function signature
function getKeywords(kws, opts) {
  // No type safety
}
```

### React Components

```typescript
// ✅ GOOD - Function components with TypeScript
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({
  onClick,
  children,
  variant = 'primary',
  disabled = false
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  );
}

// ❌ AVOID - Class components, no types
export class Button extends React.Component {
  render() {
    return <button onClick={this.props.onClick}>{this.props.children}</button>
  }
}
```

### Naming Conventions

| Type             | Convention         | Example                   |
| ---------------- | ------------------ | ------------------------- |
| Files            | `kebab-case.tsx`   | `keyword-search-form.tsx` |
| Components       | `PascalCase`       | `KeywordSearchForm`       |
| Functions        | `camelCase`        | `fetchKeywordData`        |
| Constants        | `UPPER_SNAKE_CASE` | `MAX_KEYWORDS`            |
| Types/Interfaces | `PascalCase`       | `KeywordData`             |
| CSS Classes      | `kebab-case`       | `keyword-result-row`      |

### File Organization

```typescript
// Import order: React → Third-party → Internal → Types

// 1. React imports
import { useState, useEffect } from 'react'

// 2. Third-party libraries
import { z } from 'zod'

// 3. Internal imports (absolute paths)
import { fetchKeywords } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { KeywordTable } from '@/components/tables/KeywordTable'

// 4. Type imports
import type { KeywordData } from '@/types'

// Component code...
```

### Code Comments

```typescript
// ✅ GOOD - Explain WHY, not WHAT
// Cache for 7 days because keyword data rarely changes weekly
const CACHE_TTL = 7 * 24 * 60 * 60

// Sanitize input to prevent XSS attacks (OWASP Top 10)
function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[<>"'&]/g, '')
}

// ❌ AVOID - Stating the obvious
// Set cache TTL to 7 days
const CACHE_TTL = 7 * 24 * 60 * 60

// Remove characters
function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[<>"'&]/g, '')
}
```

---

## Testing Requirements

### Testing Pyramid

**Target Coverage**: 70% overall

- **60%** Unit tests
- **30%** Integration tests
- **10%** E2E tests

### Test Structure

```typescript
// ✅ GOOD - Clear, descriptive test with Arrange-Act-Assert
describe('KeywordSearchForm', () => {
  it('submits form with valid input', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<KeywordSearchForm onSubmit={onSubmit} />);

    // Act
    await user.type(screen.getByLabelText(/keywords/i), 'seo tools');
    await user.click(screen.getByRole('button', { name: /search/i }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({
      keywords: ['seo tools'],
      matchType: 'phrase',
    });
  });
});

// ❌ AVOID - Vague test, no structure
test('form works', () => {
  render(<Form />);
  // Some assertions
});
```

### What to Test

**DO Test** ✅:

- User interactions
- Edge cases (empty input, max length, special characters)
- Error states
- Critical business logic
- API integrations (with mocks)
- Input validation and sanitization

**DON'T Test** ❌:

- Third-party libraries
- Implementation details
- Styling/visual appearance
- Private methods

### Testing Commands

```bash
# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:coverage

# Watch mode (development)
pnpm test:watch
```

---

## Security Guidelines

⚠️ **CRITICAL**: Read `docs/SECURITY.md` in full before writing any code.

### Security Principles

1. **Never commit API keys or secrets**
   - Use `.env.local` only
   - Verify `.gitignore` includes `.env*.local`
   - Pre-commit hook checks for hardcoded secrets

2. **Always validate and sanitize user input**
   - Use Zod schemas for validation
   - Sanitize before processing
   - Never trust client-side data

3. **Prevent injection attacks**
   - No `eval()`, `Function()`, or `innerHTML` with user input
   - Use parameterized queries (when DB is added)
   - Escape output properly

4. **Rate limiting**
   - Implement per-IP rate limiting
   - Default: 10 requests/hour per IP
   - Configurable via environment variables

5. **Privacy by design**
   - Do NOT store user keyword searches
   - Minimal data collection
   - GDPR/CCPA compliant

### Security Patterns

```typescript
// ✅ GOOD - Proper input validation
import { z } from 'zod'

const KeywordSchema = z.object({
  keywords: z.array(z.string().min(1).max(100)).max(200),
  matchType: z.enum(['phrase', 'exact']),
  location: z.string().optional(),
})

export async function POST(request: Request) {
  const body = await request.json()
  const validated = KeywordSchema.parse(body) // Throws if invalid

  // Process validated data
}

// ❌ AVOID - No validation
export async function POST(request: Request) {
  const { keywords } = await request.json()
  // Directly using unvalidated user input - DANGEROUS!
}
```

### Security Checks in CI/CD

The GitHub Actions workflow automatically checks for:

- Hardcoded secrets
- XSS vulnerability patterns (`innerHTML`, `eval`, `document.write` with interpolation)
- Unvalidated user inputs
- npm security vulnerabilities
- Configuration security issues

---

## Quality Automation

### Pre-commit Hooks

**Automatic on `git commit`**:

- Prettier formatting (auto-fix)
- ESLint linting (auto-fix)
- Stylelint validation (auto-fix)
- Only checks staged files (fast!)

### Available Scripts

```bash
# Code Quality
pnpm format              # Format all files with Prettier
pnpm format:check        # Check if files are formatted (CI)
pnpm lint                # Lint JavaScript/TypeScript + CSS
pnpm lint:fix            # Lint with auto-fix

# Security
pnpm security:audit      # Check for vulnerabilities
pnpm security:secrets    # Scan for hardcoded secrets
pnpm security:config     # Check configuration security

# Performance & SEO
pnpm lighthouse:ci       # Run Lighthouse CI checks

# Validation
pnpm validate:docs       # Validate documentation accuracy
pnpm validate:comprehensive  # Run comprehensive validation
pnpm validate:all        # Full validation + security audit
```

### CI/CD Quality Checks

**GitHub Actions** runs on every push and PR:

- ✅ Prettier formatting validation
- ✅ ESLint (zero warnings policy)
- ✅ Stylelint validation
- ✅ Security audit (npm audit)
- ✅ Hardcoded secrets detection
- ✅ XSS vulnerability scanning
- ✅ Input validation analysis
- ✅ Lighthouse CI (SEO minimum 90%)

### Lighthouse CI Thresholds

```javascript
{
  performance: 80% minimum,
  seo: 90% minimum (blocks deployment if fails),
  accessibility: 80% minimum,
  'first-contentful-paint': 2000ms max,
  'largest-contentful-paint': 4000ms max
}
```

---

## API Integration Patterns

### API Abstraction Layer

KeyFlash uses a **provider pattern** to support multiple keyword APIs:

```typescript
// lib/api/types.ts
export interface KeywordAPIProvider {
  getKeywordData(
    keywords: string[],
    options: SearchOptions
  ): Promise<KeywordData[]>
  getBatchLimit(): number
  getRateLimit(): RateLimit
}

// lib/api/providers/google-ads.ts
export class GoogleAdsProvider implements KeywordAPIProvider {
  async getKeywordData(
    keywords: string[],
    options: SearchOptions
  ): Promise<KeywordData[]> {
    // Google Ads API implementation
  }

  getBatchLimit(): number {
    return 1000 // Google Ads allows up to 1000 keywords per request
  }

  getRateLimit(): RateLimit {
    return { requests: 1000, period: 'day' }
  }
}

// lib/api/providers/dataforseo.ts
export class DataForSEOProvider implements KeywordAPIProvider {
  async getKeywordData(
    keywords: string[],
    options: SearchOptions
  ): Promise<KeywordData[]> {
    // DataForSEO API implementation
  }

  getBatchLimit(): number {
    return 10000 // DataForSEO allows larger batches
  }

  getRateLimit(): RateLimit {
    return { requests: 2000, period: 'day' }
  }
}

// lib/api/factory.ts
export function createProvider(providerName: string): KeywordAPIProvider {
  switch (providerName) {
    case 'google-ads':
      return new GoogleAdsProvider()
    case 'dataforseo':
      return new DataForSEOProvider()
    default:
      throw new Error(`Unknown provider: ${providerName}`)
  }
}
```

### Caching Strategy

```typescript
// Cache key structure
const cacheKey = `kw:${location}:${language}:${matchType}:${hash(keywords)}`;

// Cache flow
1. Check Redis cache with key
2. If HIT: return cached data (instant)
3. If MISS: fetch from API, store in cache with 7-day TTL, return data

// Cache TTL: 7 days (keyword data rarely changes weekly)
const CACHE_TTL = 7 * 24 * 60 * 60; // 604800 seconds
```

### Environment Variables

```bash
# Choose ONE provider to start
KEYWORD_API_PROVIDER=google-ads  # or 'dataforseo'

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

---

## Documentation Standards

### When to Update Documentation

**Always update documentation when**:

- Adding new features
- Changing API behavior
- Modifying environment variables
- Updating dependencies with breaking changes
- Adding new testing patterns
- Changing security controls

### Documentation Files

| File                       | Purpose                       | Update When                   |
| -------------------------- | ----------------------------- | ----------------------------- |
| `README.md`                | Project overview, quick start | Major features, setup changes |
| `docs/REQUIREMENTS.md`     | Product requirements          | Feature scope changes         |
| `docs/ARCHITECTURE.md`     | Tech stack, system design     | Architecture changes          |
| `docs/SECURITY.md`         | Security measures             | Security controls change      |
| `docs/TESTING_STRATEGY.md` | Testing approach              | Test patterns change          |
| `CONTRIBUTING.md`          | Contribution guidelines       | Workflow changes              |
| `CLAUDE.md`                | This file                     | AI assistant guidance changes |

### Code Documentation (JSDoc)

Use JSDoc for complex functions:

````typescript
/**
 * Calculates keyword difficulty score (0-100) based on competition metrics
 *
 * @param competition - Competition level from API ('low' | 'medium' | 'high')
 * @param cpc - Cost per click in USD
 * @param searchVolume - Monthly search volume
 * @returns Difficulty score (0 = easy to rank, 100 = very hard)
 *
 * @example
 * ```typescript
 * const difficulty = calculateDifficulty('high', 5.50, 10000);
 * console.log(difficulty); // 85
 * ```
 */
function calculateDifficulty(
  competition: Competition,
  cpc: number,
  searchVolume: number
): number {
  // Implementation
}
````

---

## Common Tasks

### Adding a New Feature

1. **Check requirements** - Ensure feature aligns with `docs/REQUIREMENTS.md`
2. **Check out-of-scope** - Verify feature is not listed as out-of-scope for MVP
3. **Create feature branch** - `git checkout -b feature/feature-name`
4. **Write tests first** (TDD approach recommended)
5. **Implement feature**
6. **Update documentation**
7. **Run quality checks** - `pnpm lint && pnpm test`
8. **Commit with conventional format** - `git commit -m "feat(scope): description"`
9. **Push and create PR**

### Fixing a Bug

1. **Create bug fix branch** - `git checkout -b fix/bug-description`
2. **Write failing test** - Reproduce the bug in a test
3. **Fix the bug**
4. **Verify test passes**
5. **Run quality checks** - `pnpm lint && pnpm test`
6. **Commit** - `git commit -m "fix(scope): description"`
7. **Push and create PR**

### Adding a New API Provider

1. **Create provider class** - `lib/api/providers/provider-name.ts`
2. **Implement `KeywordAPIProvider` interface**
3. **Add provider to factory** - `lib/api/factory.ts`
4. **Write unit tests** - Mock API responses
5. **Write integration tests** - Test with real API (if possible)
6. **Update `.env.example`** - Add required environment variables
7. **Update `docs/ARCHITECTURE.md`** - Document new provider
8. **Update `README.md`** - Add setup instructions

### Adding a New Component

```bash
# 1. Create component file
# src/components/ui/ComponentName.tsx

# 2. Create component with TypeScript
interface ComponentNameProps {
  // Props definition
}

export function ComponentName({ /* props */ }: ComponentNameProps) {
  // Implementation
}

# 3. Create test file
# tests/unit/components/ComponentName.test.tsx

# 4. Write tests
# 5. Import and use component
# 6. Update Storybook (if added later)
```

### Updating Dependencies

```bash
# 1. Check for outdated packages
pnpm outdated

# 2. Update package.json
pnpm update

# 3. Test thoroughly
pnpm test

# 4. Run quality checks
pnpm lint

# 5. Check for security vulnerabilities
pnpm security:audit

# 6. Commit
git commit -m "chore(deps): update dependencies"
```

---

## AI Assistant Best Practices

### When Working on KeyFlash

1. **Always read documentation first**
   - Check `docs/REQUIREMENTS.md` for feature scope
   - Check `docs/SECURITY.md` for security requirements
   - Check `docs/ARCHITECTURE.md` for design decisions

2. **Follow existing patterns**
   - Use existing component structure
   - Follow established naming conventions
   - Maintain consistency with current code

3. **Security is paramount**
   - Never commit secrets
   - Always validate user input
   - Follow OWASP Top 10 guidelines
   - Check for XSS, injection attacks

4. **Test everything**
   - Write tests before or with code
   - Maintain 70% coverage minimum
   - Test edge cases and error states

5. **Document changes**
   - Update relevant documentation
   - Add code comments for complex logic
   - Use JSDoc for public APIs

6. **Run quality checks before committing**

   ```bash
   pnpm lint:fix
   pnpm test
   pnpm validate:all
   ```

7. **Ask for clarification**
   - If requirements are unclear, ask the user
   - Don't make assumptions about feature scope
   - Verify API usage patterns

### Questions to Ask Before Coding

- Is this feature in scope for MVP? (Check `docs/REQUIREMENTS.md`)
- Are there security implications? (Check `docs/SECURITY.md`)
- What tests are needed? (Check `docs/TESTING_STRATEGY.md`)
- Does this follow the existing architecture? (Check `docs/ARCHITECTURE.md`)
- Are there existing patterns I should follow?

---

## Quick Reference

### Important URLs

- **Repository**: https://github.com/brettstark73/keyflash
- **License**: AGPL-3.0
- **Issues**: https://github.com/brettstark73/keyflash/issues
- **Discussions**: https://github.com/brettstark73/keyflash/discussions

### Key Constraints

- **Node Version**: 20+ (enforced by `.nvmrc`, `package.json`, `.npmrc`)
- **Test Coverage**: 70% minimum overall
- **SEO Score**: 90% minimum (Lighthouse CI)
- **API Response Time**: <3 seconds (p95)
- **Bundle Size**: First Load JS <200KB

### Critical Security Rules

1. ❌ NEVER commit API keys, secrets, or credentials
2. ❌ NEVER use `eval()`, `Function()`, or `innerHTML` with user input
3. ❌ NEVER trust client-side data without validation
4. ✅ ALWAYS validate with Zod schemas
5. ✅ ALWAYS sanitize user input
6. ✅ ALWAYS implement rate limiting

### File Extensions

- TypeScript: `.ts`, `.tsx`
- Configuration: `.cjs` (ESLint), `.json`
- Styles: `.css` (Tailwind utility classes preferred)
- Tests: `.test.ts`, `.test.tsx`, `.spec.ts`

---

## Getting Help

### Documentation

1. **README.md** - Start here
2. **docs/REQUIREMENTS.md** - What to build
3. **docs/ARCHITECTURE.md** - How it's built
4. **docs/SECURITY.md** - Security requirements
5. **docs/TESTING_STRATEGY.md** - Testing approach
6. **CONTRIBUTING.md** - Contribution workflow

### Contact

- **GitHub Issues**: https://github.com/brettstark73/keyflash/issues
- **GitHub Discussions**: https://github.com/brettstark73/keyflash/discussions

---

**Version**: 1.0
**Last Updated**: 2025-11-19
**Maintained By**: KeyFlash Contributors

**Happy coding! Let's build something amazing together.** 🚀
