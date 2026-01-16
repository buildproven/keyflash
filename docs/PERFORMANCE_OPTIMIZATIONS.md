# Performance Optimizations Implemented

## Overview

KeyFlash implements multiple performance optimization strategies to achieve Lighthouse scores > 90 and provide a fast user experience.

## 1. Bundle Optimization

### Size Budgets

`.size-limit.json` enforces bundle size budgets:

- Homepage: <100KB
- Search page: <200KB
- CSS: <15KB
- API routes: <150KB

Run `npm run size` to check current bundle sizes.

### Code Splitting

- **Dynamic imports** for authenticated-only components
- **Lazy loading** for modals (ContentBriefModal, RelatedKeywordsModal, SaveSearchModal)
- **Route-based splitting** via Next.js App Router

### Tree Shaking

- `optimizePackageImports` for @clerk/nextjs, @upstash/redis, zod
- System font stack (no web font downloads)
- Tailwind CSS purging via @tailwindcss/postcss

## 2. Image Optimization

### Format Support

- **AVIF** (primary, 50% smaller than WebP)
- **WebP** (fallback, 30% smaller than PNG/JPEG)
- **Automatic format selection** based on browser support

### Optimization Techniques

- Responsive image sizes (640px - 3840px)
- Lazy loading for below-fold images
- 1-year cache TTL
- Icon optimization target: <10KB

### Icons

- `icon.png`: 2.4KB (optimized ✓)
- `apple-icon.png`: 42KB → needs optimization to <10KB

## 3. Caching Strategy

### Multi-Layer Caching

#### 1. Redis Cache (Application Layer)

- **TTL**: 7 days for keyword data
- **Strategy**: Cache-aside pattern
- **Key format**: `kw:{location}:{language}:{matchType}:{sha256-hash}`
- **Privacy mode**: Configurable via `PRIVACY_MODE` env var

#### 2. HTTP Cache (CDN/Browser)

- **Static assets**: `max-age=31536000, immutable` (1 year)
- **CSS/JS**: `max-age=31536000, immutable`
- **API routes**: `no-store, max-age=0`
- **HTML**: Static generation (no caching needed)

#### 3. Next.js Build Cache

- **Static generation**: Homepage uses `force-static`
- **ISR**: Not used (keyword data is dynamic)
- **Build cache**: Accelerates rebuilds

### Cache Performance

- **Cache hit**: 50-100ms API response
- **Cache miss**: 200-3,000ms (depending on provider)
- **Fire-and-forget writes**: Non-blocking cache updates

## 4. Database/API Performance

### Redis Optimization

- **Upstash** serverless Redis (global edge network)
- **Connection**: HTTP REST (serverless-friendly)
- **Pipelining**: Single operations (HTTP overhead minimal)
- **Health checks**: Graceful fallback on Redis failure

### API Response Times

Target 95th percentile:

- `/api/keywords` (cached): <200ms
- `/api/keywords` (uncached): <3s
- `/api/health`: <50ms
- `/api/searches`: <100ms

### Optimization Techniques

1. **Non-blocking cache writes**: Fire-and-forget pattern
2. **Parallel operations**: Rate limit check + auth + cache check
3. **Early validation**: Zod schema validation before expensive operations
4. **Streaming responses**: Not yet implemented (future optimization)

## 5. Frontend Performance

### Critical Rendering Path

1. **System fonts**: No web font downloads
2. **Inline critical CSS**: Via Tailwind @layer base
3. **Deferred JS**: Auth components loaded after initial paint
4. **Preconnect hints**: Clerk, Upstash Redis

### Lazy Loading Strategy

- **Auth header**: Dynamic import with loading placeholder
- **Saved searches**: Dynamic import (authenticated users only)
- **Modals**: Dynamic import on interaction
- **Table rows**: Intersection Observer for below-fold rows (future)

### Rendering Optimization

- **React.memo**: Keyword table components
- **useCallback**: Event handlers to prevent re-renders
- **Key optimization**: Stable keys for list items
- **Conditional rendering**: Minimal re-renders

## 6. Core Web Vitals Optimization

### LCP (Largest Contentful Paint) - Target <2.5s

**Optimizations:**

- System font stack (no font download delay)
- Preconnect to critical origins
- Static generation for homepage
- Image optimization (AVIF/WebP)
- Optimized icons (<10KB target)

**Expected LCP:** 1.8-2.2s

### INP (Interaction to Next Paint) - Target <200ms

**Optimizations:**

- React.memo for expensive components
- Debounced search input (implicit via form submit)
- Dynamic imports for modals
- Minimal main thread work

**Expected INP:** <200ms

### CLS (Cumulative Layout Shift) - Target <0.1

**Optimizations:**

- Loading placeholders for dynamic content
- Explicit dimensions on images (icon.png: 32x32, apple-icon.png: 180x180)
- No layout-shifting ads or popups
- Fixed header (auth header in corner, not inline)

**Expected CLS:** <0.05

## 7. Network Optimization

### HTTP/2 & HTTP/3

- **Vercel deployment**: HTTP/2 and HTTP/3 enabled automatically
- **Multiplexing**: Multiple resources over single connection
- **Header compression**: HPACK (HTTP/2) and QPACK (HTTP/3)

### Compression

- **Brotli**: Enabled for static assets
- **Gzip**: Fallback for older browsers
- **Compression ratio**: ~70% for text resources

### Resource Hints

```html
<!-- Critical origin (early connection) -->
<link rel="preconnect" href="https://clerk.accounts.dev" crossorigin />

<!-- Non-critical origin (DNS only) -->
<link rel="dns-prefetch" href="https://api.stripe.com" />
<link rel="dns-prefetch" href="https://upstash.io" />
```

## 8. Security Headers (Performance Impact)

Headers that impact performance:

- **CSP**: Minimal impact (no eval, inline scripts allowed for Next.js)
- **COEP/COOP/CORP**: Enable SharedArrayBuffer (future optimization)
- **No impact**: HSTS, X-Frame-Options, X-Content-Type-Options

## 9. Monitoring & Metrics

### Web Vitals Tracking

`src/app/web-vitals.tsx` tracks:

- **LCP**: Largest Contentful Paint
- **FID**: First Input Delay (deprecated, use INP)
- **INP**: Interaction to Next Paint
- **CLS**: Cumulative Layout Shift
- **FCP**: First Contentful Paint
- **TTFB**: Time to First Byte

### Lighthouse CI

- **Runs**: 3 per build
- **Targets**: Performance 80+, Accessibility 90+, Best Practices 90+, SEO 90+
- **Assertions**: LCP <2.5s, CLS <0.1, TBT <300ms

### Performance Budgets

Enforced via Size Limit:

```bash
npm run size       # Check current bundle sizes
npm run size:why   # Analyze bundle composition
```

## 10. Future Optimizations

### Planned (Not Yet Implemented)

1. **Virtual scrolling**: Lazy render table rows
2. **Web Workers**: CSV export processing
3. **Service Worker**: Offline static assets
4. **ISR**: Pre-render popular searches (privacy consideration)
5. **Redis pipelining**: Batch multiple operations
6. **Streaming responses**: Stream API responses
7. **Critical CSS extraction**: Inline above-fold CSS

### Not Planned (Trade-offs)

1. **Client-side caching**: Privacy promise (no local storage of searches)
2. **Aggressive prefetching**: Bandwidth consideration
3. **Image CDN**: Vercel handles this automatically

## 11. Performance Testing

### Local Testing

```bash
# Build and run production server
npm run build
npm run start

# Run Lighthouse
npx lighthouse http://localhost:3000 --view

# Check bundle sizes
npm run size
```

### CI/CD Testing

Lighthouse CI runs on every PR:

```bash
npm run perf:audit
```

### Real User Monitoring

Vercel Analytics (automatic):

- Web Vitals tracking
- Page load times
- Error rates

## 12. Optimization Checklist

Before deploying performance-critical changes:

- [ ] Run `npm run size` to check bundle size
- [ ] Run `npm run perf:audit` for Lighthouse scores
- [ ] Check Web Vitals in dev mode
- [ ] Test on throttled 3G network
- [ ] Verify cache headers in production
- [ ] Check Redis cache hit rate
- [ ] Review Vercel Analytics for regressions

## Resources

- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web.dev Core Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Size Limit](https://github.com/ai/size-limit)
