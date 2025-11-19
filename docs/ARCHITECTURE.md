# KeyFlash - Architecture & Technology Stack

## Architecture Overview

**Design Philosophy**: Simple, Fast, Scalable

- Stateless serverless architecture
- Edge-first for speed
- API-agnostic keyword data layer
- Progressive enhancement approach

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER BROWSER                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React/Next.js Frontend (SPA)              │ │
│  │  • TanStack Query (data fetching/caching)             │ │
│  │  • Tailwind CSS (styling)                             │ │
│  │  • React Hook Form (form validation)                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              EDGE NETWORK (Vercel/Cloudflare)               │
│  • Static asset CDN                                          │
│  • Edge caching (immutable keyword data)                     │
│  • Rate limiting middleware                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              API LAYER (Serverless Functions)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/keywords (POST)                                  │ │
│  │    - Input validation                                  │ │
│  │    - Rate limiting check                               │ │
│  │    - Cache lookup                                      │ │
│  │    - Keyword API abstraction                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐   ┌──────────────┐
     │  Redis   │    │ Google   │   │  DataForSEO  │
     │  Cache   │    │ Ads API  │   │  API (future)│
     │ (Upstash)│    │          │   │              │
     └──────────┘    └──────────┘   └──────────────┘
```

## Technology Stack

### Frontend

**Framework**: **Next.js 14+ (App Router)**

- **Why**:
  - Server-side rendering for SEO (important for marketing site)
  - API routes for serverless backend
  - Built-in optimizations (Image, Font, Script optimization)
  - Edge runtime support
  - Battle-tested, huge ecosystem
  - Vercel deployment integration (easiest hosting)

**UI Framework**: **React 18+**

- Industry standard
- Excellent TypeScript support
- Large component ecosystem

**Styling**: **Tailwind CSS 4+**

- Utility-first, fast development
- Tiny production bundle sizes
- Easy theming for dark mode
- No CSS-in-JS runtime cost

**State Management**: **TanStack Query v5** (React Query)

- Server state management
- Built-in caching, revalidation
- Optimistic updates
- Perfect for API-heavy apps
- No global state needed for MVP

**Form Handling**: **React Hook Form + Zod**

- Minimal re-renders
- Built-in validation
- Type-safe with Zod schemas
- Small bundle size (~9KB)

**Data Visualization**: **Recharts**

- React-native charts
- Responsive, accessible
- For future trend visualizations

### Backend/API

**Runtime**: **Node.js 20+ (LTS)**

- Serverless function support
- Native TypeScript support
- Excellent library ecosystem

**API Framework**: **Next.js API Routes / Route Handlers**

- No separate backend needed
- Automatic serverless deployment
- Edge runtime capable
- TypeScript end-to-end

**Validation**: **Zod**

- Runtime type validation
- Shared schemas between frontend/backend
- Excellent TypeScript inference
- Input sanitization

**API Client**: **Axios**

- HTTP client for Google Ads / DataForSEO
- Interceptors for auth, logging
- Request/response transformation
- Timeout handling

### Data Layer

**Caching**: **Upstash Redis**

- **Why**:
  - Serverless-friendly (connection pooling)
  - Free tier: 10K commands/day
  - Global replication
  - REST API (no persistent connections needed)
  - TTL support for cache expiration

**Cache Strategy**:

```typescript
// Keyword data cache key structure
cache_key = `kw:${location}:${language}:${match_type}:${hash(keywords)}`
TTL = 7 days (keyword data rarely changes weekly)

// Cache flow
1. Check cache with key
2. If HIT: return cached data (instant)
3. If MISS: fetch from API, store in cache, return data
```

**Future Database** (when user accounts needed): **PostgreSQL (Neon or Supabase)**

- Free tier available
- Serverless, autoscaling
- Full SQL capabilities
- Excellent TypeScript ORMs (Drizzle, Prisma)

### External APIs

**Phase 1: Google Ads API (Keyword Planner)**

```typescript
// API Integration
Library: google-ads-api (official Node.js client)
Authentication: OAuth2 + Service Account
Endpoints:
  - KeywordPlanIdeaService.generateKeywordIdeas()
  - KeywordPlanIdeaService.generateKeywordHistoricalMetrics()

Rate Limits: 1,000 operations/day (free tier)
Cost: $0 (with active Google Ads account)
```

**Phase 2: DataForSEO API**

```typescript
// Backup/Scale API
Library: @dataforseo/client
Authentication: API Key (Basic Auth)
Endpoints:
  - keywords_data/google_ads/search_volume/live
  - keywords_data/google_ads/keywords_for_keywords/live

Rate Limits: Based on credits purchased
Cost: ~$0.02-0.05 per keyword
```

**API Abstraction Layer**:

```typescript
// Single interface for both APIs
interface KeywordAPIProvider {
  getKeywordData(keywords: string[], options: SearchOptions): Promise<KeywordData[]>
  getBatchLimit(): number
  getRateLimit(): RateLimit
}

// Implementations
class GoogleAdsProvider implements KeywordAPIProvider {...}
class DataForSEOProvider implements KeywordAPIProvider {...}

// Factory pattern for easy switching
const provider = createProvider(process.env.KEYWORD_API_PROVIDER)
```

### DevOps & Infrastructure

**Hosting**: **Vercel**

- **Why**:
  - Next.js native support (made by same company)
  - Free tier: 100GB bandwidth, unlimited sites
  - Automatic HTTPS, CDN, edge functions
  - GitHub integration (auto-deploy on push)
  - Preview deployments for PRs
  - Built-in analytics

**Alternative**: Cloudflare Pages (if need lower costs at scale)

**CI/CD**: **GitHub Actions**

- Lint + type check on PR
- Run tests on PR
- Auto-deploy to Vercel on merge to main
- Dependency security scanning

**Monitoring**: **Vercel Analytics + Sentry**

- Vercel: Web vitals, page performance (free tier)
- Sentry: Error tracking (free: 5K events/month)

**Logging**: **Axiom or Logflare**

- Serverless-friendly log aggregation
- Free tier: 500MB/month
- Search and filter logs
- Alerts on error spikes

### Development Tools

**Language**: **TypeScript 5+**

- Type safety across stack
- Better developer experience
- Catch errors at compile time
- Self-documenting code

**Package Manager**: **pnpm**

- Faster than npm/yarn
- Efficient disk space usage
- Strict dependency resolution
- Monorepo support (future)

**Linting**: **ESLint + Prettier**

- eslint-config-next (Next.js recommended rules)
- prettier-plugin-tailwindcss (auto-sort classes)
- Consistent code style

**Testing**:

- **Vitest**: Unit tests (faster than Jest)
- **Playwright**: E2E tests
- **Testing Library**: React component tests
- (See TESTING_STRATEGY.md for details)

**Git Hooks**: **Husky + lint-staged**

- Pre-commit: Lint and format staged files
- Pre-push: Run tests
- Commit message linting (Conventional Commits)

## Folder Structure

```
keyflash/
├── .github/
│   └── workflows/
│       ├── ci.yml          # Lint, test, type-check
│       └── deploy.yml      # Deploy to Vercel
├── docs/
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── TESTING_STRATEGY.md
│   └── API_INTEGRATION.md
├── public/
│   ├── images/
│   └── favicon.ico
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── api/
│   │   │   ├── keywords/
│   │   │   │   └── route.ts
│   │   │   └── health/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx        # Landing page
│   │   └── search/
│   │       └── page.tsx    # Keyword search UI
│   ├── components/
│   │   ├── ui/             # Reusable UI components
│   │   ├── forms/          # Form components
│   │   └── tables/         # Keyword results table
│   ├── lib/
│   │   ├── api/
│   │   │   ├── providers/  # API provider implementations
│   │   │   │   ├── google-ads.ts
│   │   │   │   └── dataforseo.ts
│   │   │   ├── factory.ts  # Provider factory
│   │   │   └── types.ts    # Shared types
│   │   ├── cache/
│   │   │   └── redis.ts    # Redis cache client
│   │   ├── validation/
│   │   │   └── schemas.ts  # Zod schemas
│   │   └── utils/
│   │       ├── rate-limit.ts
│   │       └── error-handler.ts
│   ├── hooks/              # React hooks
│   ├── types/              # TypeScript types
│   └── config/
│       └── constants.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   └── setup-env.sh        # Environment setup helper
├── .env.example            # Example environment variables
├── .eslintrc.json
├── .prettierrc
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Security Architecture

(See SECURITY.md for full details)

**Key Security Measures**:

- API keys in environment variables only (never committed)
- Input validation with Zod schemas
- Rate limiting per IP/user
- HTTPS-only (enforced by Vercel)
- CORS configuration
- Content Security Policy headers
- No user data storage (privacy by design)

## Performance Optimization

### Caching Strategy

**Browser Cache**:

- Static assets: 1 year (immutable)
- API responses: No cache (always validate)
- Keyword results: Cache in TanStack Query (5 minutes)

**Edge Cache** (Vercel):

- Landing page: 1 hour, stale-while-revalidate
- API routes: No edge cache (dynamic)

**Redis Cache**:

- Keyword data: 7 days TTL
- Cache hit rate target: >70%
- Reduces API costs significantly

### Bundle Optimization

- Tree-shaking (automatic with Next.js)
- Code splitting by route
- Dynamic imports for heavy components
- Image optimization (next/image)
- Font optimization (next/font)

**Bundle Size Targets**:

- First Load JS: <200KB
- Total page size: <500KB
- Largest Contentful Paint: <2.5s

### API Optimization

- Batch keyword requests (up to 200)
- Parallel API calls where possible
- Request deduplication
- Timeout handling (10s max)

## Scalability Considerations

### Current Architecture (MVP)

- **Users**: 100-1000 concurrent
- **Requests**: 10K/day
- **Cost**: ~$0-50/month (mostly API costs)

### Scaling Path

**Phase 1** (1K-10K users):

- Current architecture sufficient
- Upgrade Upstash Redis tier if needed
- Add more Vercel bandwidth if needed

**Phase 2** (10K-100K users):

- Migrate to DataForSEO API (better rate limits)
- Add database for user accounts
- Implement user-based rate limiting
- Add Cloudflare in front of Vercel (DDoS protection)

**Phase 3** (100K+ users):

- Multi-region deployment
- Database read replicas
- Dedicated API caching layer
- CDN for API responses (Cloudflare Workers)

## Deployment Strategy

### Environments

**Development**:

- Local: `pnpm dev` (http://localhost:3000)
- Uses .env.local for API keys
- Hot reload enabled

**Preview** (Per PR):

- Auto-deployed by Vercel on PR creation
- Unique URL: `keyflash-pr-123.vercel.app`
- Uses staging API keys
- Deleted when PR merged/closed

**Production**:

- Domain: `keyflash.com` (or chosen domain)
- Auto-deployed on merge to `main` branch
- Uses production API keys
- Zero-downtime deployments

### Deployment Checklist

```bash
# Pre-deployment
✅ All tests passing
✅ No TypeScript errors
✅ No ESLint errors
✅ Environment variables configured
✅ Redis connection tested
✅ API credentials validated

# Post-deployment
✅ Health check endpoint returns 200
✅ Can complete a keyword search
✅ Cache is working (check Redis)
✅ Error tracking active (Sentry)
✅ Analytics tracking (Vercel)
```

## Monitoring & Observability

### Metrics to Track

**Application Metrics**:

- API response times (p50, p95, p99)
- Cache hit rate
- Error rate by endpoint
- Keyword searches per day
- API cost per search

**Business Metrics**:

- Daily active users
- Searches per user
- Conversion rate (free → paid)
- API provider usage split

**Infrastructure Metrics**:

- Vercel function execution time
- Redis memory usage
- Bandwidth consumption
- Error logs volume

### Alerts

**Critical**:

- Error rate >5%
- API response time >10s (p95)
- Cache hit rate <40%
- Redis unavailable

**Warning**:

- API cost spike (>2x average)
- Approaching rate limits (>80%)
- High Redis memory usage (>80%)

## Disaster Recovery

**Data Loss Prevention**:

- No user data stored (MVP) = no data to lose
- API provider is source of truth
- Cache can be rebuilt from API

**API Provider Failure**:

- Switch to backup provider (manual process initially)
- Error message to users with ETA
- Cache serves stale data temporarily

**Hosting Failure** (Vercel down):

- Deploy to Cloudflare Pages as backup
- Update DNS to point to backup
- Recovery time: ~30 minutes

**Backup Plan**:

- Code in GitHub (source of truth)
- Environment variables backed up securely (1Password/Bitwarden)
- Can redeploy from scratch in <1 hour

## Technology Alternatives Considered

### Why Not These Options?

**Backend Frameworks**:

- ❌ **Express/Fastify**: Requires separate deployment, no SSR
- ❌ **NestJS**: Too heavy for simple API, over-engineered
- ❌ **Remix**: Less mature ecosystem than Next.js

**Frontend Frameworks**:

- ❌ **SvelteKit**: Smaller ecosystem, team familiarity
- ❌ **Vue/Nuxt**: React has larger job market, more libraries
- ❌ **Solid**: Too new, risky for production

**Hosting Platforms**:

- ❌ **AWS/GCP/Azure**: Too complex, expensive, slow iteration
- ❌ **Heroku**: More expensive than Vercel, less features
- ❌ **Railway**: Less Next.js optimization

**Databases** (for future):

- ❌ **MongoDB**: No need for document flexibility
- ❌ **MySQL**: PostgreSQL has better features (JSONB, full-text search)
- ❌ **Firebase**: Vendor lock-in, less control

## Future Architecture Enhancements

**API Gateway** (if multi-API complexity grows):

- Kong or Tyk for API management
- Unified authentication
- Request transformation
- Analytics and monitoring

**Queueing System** (if async processing needed):

- Upstash QStash or BullMQ
- For bulk keyword processing
- Email notifications

**Search/Analytics** (if keyword history/trends):

- Elasticsearch or Algolia
- For user search history
- Keyword trend analysis

**CDN** (if global expansion):

- Cloudflare in front of Vercel
- Multi-region edge caching
- DDoS protection

---

**Document Version**: 1.0
**Last Updated**: 2025-11-19
**Status**: Draft - Pending Review
**Next Review**: After MVP development starts
