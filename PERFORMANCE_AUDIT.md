# Performance Audit: KeyFlash

**Date:** 2026-01-08
**Auditor:** Claude Code (Performance Optimization Specialist)

## Executive Summary

KeyFlash has a strong performance foundation with Next.js 16, Tailwind CSS v4, Redis caching, and lazy loading patterns already implemented. This audit identifies **12 optimization opportunities** to achieve Lighthouse scores > 90 across all metrics.

**Current Status:**

- Static generation: ✓ (Homepage force-static)
- Dynamic imports: ✓ (Auth components, saved searches)
- Redis caching: ✓ (7-day TTL for keyword data)
- Image optimization: ✓ (AVIF/WebP enabled)
- HTTP caching: ✓ (Aggressive static asset caching)
- Compression: ✓ (Brotli enabled)

**Estimated Impact:**

- Current projected Lighthouse Performance: ~75-85
- Target after optimizations: >90
- Improvement: 10-20 points

---

## Critical Issues (Fix Immediately)

### 1. Large Apple Touch Icon (42KB)

**Impact:** Blocks initial page load, contributes to LCP
**Current:** 42KB PNG at `/src/app/apple-icon.png`
**Target:** <10KB
**Fix:**

```bash
# Optimize with ImageMagick or online tool
convert apple-icon.png -strip -quality 85 -define png:compression-level=9 apple-icon-optimized.png
```

**Estimated gain:** 200-300ms on 3G, 0.5 LCP improvement

---

### 2. Missing Size Limit Configuration

**Impact:** No bundle size budget enforcement
**Current:** No `.size-limit.json`
**Target:** Enforce bundle budgets
**Fix:** Create `.size-limit.json` (see implementation below)
**Estimated gain:** Prevents future regressions

---

### 3. Clerk Bundle Size Not Tree-Shaken

**Impact:** Large auth bundle loaded on all pages
**Current:** `@clerk/nextjs` loaded in root layout
**Optimization:** Already using dynamic imports ✓, but can be improved
**Fix:** Ensure Clerk is only loaded when needed (auth pages)
**Estimated gain:** 50-100KB bundle reduction for anonymous users

---

## Medium Priority Optimizations

### 4. Add Resource Hints for Critical Origins

**Impact:** Faster DNS resolution and connection setup
**Current:** Only preconnecting to Clerk
**Target:** Add dns-prefetch for all critical origins
**Status:** Partially implemented ✓ (Clerk preconnect exists)
**Improvement:** Add for Upstash Redis in production

---

### 5. Implement Font Subsetting

**Impact:** Smaller font downloads
**Current:** Using system font stack ✓ (excellent!)
**Status:** Already optimized - no custom fonts loaded
**Estimated savings:** 0KB (already optimal)

---

### 6. Add Critical CSS Inlining

**Impact:** Faster First Contentful Paint
**Current:** Tailwind CSS loaded as external stylesheet
**Target:** Inline critical above-the-fold CSS
**Complexity:** Medium (requires build-time extraction)
**Estimated gain:** 100-200ms FCP improvement

---

### 7. Optimize Search Page Bundle

**Impact:** Reduce JS bundle for authenticated features
**Current:** Dynamic imports for SavedSearchesList ✓ and SaveSearchModal ✓
**Status:** Already optimized
**Improvement opportunity:** Split table components by feature

---

### 8. Add Intersection Observer for Tables

**Impact:** Lazy render table rows below fold
**Current:** Full table rendered immediately
**Target:** Virtual scrolling or lazy rendering
**Estimated gain:** 50-100ms INP improvement for large result sets

---

### 9. Optimize Redis Connection Pooling

**Impact:** Faster API responses
**Current:** Upstash HTTP REST (connection per request)
**Status:** Upstash handles pooling automatically ✓
**Improvement:** Consider Redis connection reuse with pipelining

---

### 10. Add API Response Compression

**Impact:** Faster API responses
**Current:** Next.js compression enabled ✓
**Status:** Already optimized
**Verification needed:** Confirm Brotli/Gzip enabled in production

---

## Low Priority (Nice to Have)

### 11. Service Worker for Offline Support

**Impact:** Better reliability, faster repeat visits
**Current:** None
**Target:** Cache static assets offline
**Complexity:** High
**ROI:** Low (keyword research requires network)

---

### 12. Implement ISR for Search Page

**Impact:** Faster loads for common searches
**Current:** Client-side only
**Target:** Pre-render popular searches
**Complexity:** High
**Privacy concern:** May conflict with "no storage" promise

---

## Core Web Vitals Analysis

### LCP (Largest Contentful Paint) - Target <2.5s

**Current Bottlenecks:**

1. Large apple-icon.png (42KB)
2. Clerk auth bundle load
3. No font preloading (N/A - using system fonts ✓)

**Optimizations:**

- [x] System font stack (already done)
- [x] Preconnect to Clerk origin (already done)
- [ ] Optimize apple-icon.png (42KB → 8KB)
- [ ] Add resource hints for critical origins
- [ ] Inline critical CSS

**Projected LCP:** 1.8-2.2s (currently likely 2.5-3.0s)

---

### INP (Interaction to Next Paint) - Target <200ms

**Current Bottlenecks:**

1. Large table rendering (200 keywords)
2. CSV export processing
3. Search form validation

**Optimizations:**

- [x] Dynamic imports for modals (already done)
- [ ] Implement virtual scrolling for tables
- [ ] Debounce search input
- [ ] Web Worker for CSV export

**Projected INP:** <200ms (currently likely 200-300ms)

---

### CLS (Cumulative Layout Shift) - Target <0.1

**Current Risk Areas:**

1. Auth header dynamic load
2. Saved searches list
3. Dynamic modals

**Mitigations:**

- [x] Loading placeholders for auth header (already done)
- [x] Skeleton states for loading (already done)
- [ ] Reserve space for dynamic content
- [ ] Add explicit dimensions to all images

**Projected CLS:** <0.05 (likely already good due to placeholders)

---

## Bundle Size Analysis

**Current Bundle (estimated):**

- Next.js runtime: ~80KB
- Clerk SDK: ~50-70KB
- Upstash Redis client: ~10KB
- Tailwind CSS: ~8-12KB (with purging)
- Application code: ~30-50KB

**Total estimated:** ~180-220KB initial bundle

**Optimization targets:**

- Homepage: <100KB (anonymous users, no Clerk)
- Search page: <200KB (authenticated users)

**Size Limit Budgets:**

```json
{
  "path": ".next/static/chunks/pages/index.js",
  "limit": "100 KB"
},
{
  "path": ".next/static/chunks/pages/search.js",
  "limit": "200 KB"
}
```

---

## Caching Strategy Analysis

### Redis Cache ✓

- **Status:** Implemented
- **TTL:** 7 days
- **Key strategy:** SHA-256 hashed (secure ✓)
- **Privacy mode:** Configurable via env var ✓

### HTTP Cache ✓

- **Static assets:** 1 year immutable ✓
- **API routes:** no-store ✓
- **HTML:** Needs verification

**Improvements:**

- Add stale-while-revalidate for API responses
- Implement ISR for homepage (already force-static ✓)

---

## Database/API Performance

### Redis Operations

**Current:**

- GET/SET operations: <10ms (Upstash global)
- Rate limiting: Redis-based ✓
- Connection: HTTP REST (appropriate for serverless)

**Optimizations:**

- [x] Fire-and-forget cache writes (already done)
- [x] Non-blocking usage tracking (already done)
- [ ] Pipeline multiple Redis operations
- [ ] Add Redis health monitoring

### API Response Times

**Estimated:**

- Cache hit: 50-100ms
- Cache miss (mock): 200-500ms
- Cache miss (real API): 1,000-3,000ms

**Target:** <200ms (95th percentile for cached)

---

## Implementation Priority

### Phase 1 (Immediate - 1-2 hours)

1. ✓ Optimize apple-icon.png (42KB → 8KB)
2. ✓ Create .size-limit.json
3. ✓ Add resource hints for production origins
4. ✓ Add explicit image dimensions

### Phase 2 (This Week - 4-6 hours)

5. ✓ Implement virtual scrolling for keyword table
6. ✓ Add critical CSS inlining
7. ✓ Optimize dynamic imports further
8. ✓ Add performance monitoring

### Phase 3 (Next Sprint - Optional)

9. Service worker for static assets
10. ISR for common searches (if privacy allows)
11. Web Worker for heavy computations

---

## Success Metrics

**Lighthouse Targets (All Pages):**
| Metric | Target | Current (Est.) | After Optimization |
|--------|--------|----------------|-------------------|
| Performance | 90+ | 75-85 | 90-95 |
| Accessibility | 90+ | 95+ | 95+ |
| Best Practices | 90+ | 90+ | 95+ |
| SEO | 90+ | 95+ | 95+ |

**Core Web Vitals Targets:**
| Metric | Target | Current (Est.) | After Optimization |
|--------|--------|----------------|-------------------|
| LCP | <2.5s | 2.5-3.0s | 1.8-2.2s |
| INP | <200ms | 200-300ms | <200ms |
| CLS | <0.1 | <0.05 | <0.05 |

**Bundle Size Targets:**
| Page | Target | Current (Est.) | After Optimization |
|------|--------|----------------|-------------------|
| Homepage | <100KB | ~120KB | ~90KB |
| Search | <200KB | ~220KB | ~180KB |

---

## Monitoring & Verification

**Tools:**

- [x] Lighthouse CI (configured)
- [x] Web Vitals tracking (implemented)
- [ ] Sentry performance monitoring
- [ ] Bundle analyzer (installed, needs regular use)

**CI/CD Integration:**

- [x] Lighthouse CI on PRs
- [ ] Bundle size checks on PRs (needs .size-limit.json)
- [ ] Performance regression detection

---

## Estimated ROI

**Developer Time:** 8-12 hours total
**Performance Gain:** 10-20 Lighthouse points
**User Impact:**

- 500-800ms faster page loads
- Better mobile experience
- Improved SEO rankings

**Business Impact:**

- Higher conversion (100ms = 1% conversion lift)
- Better user retention
- Lower bounce rate
- Higher search rankings

---

## Files to Modify

1. `/src/app/apple-icon.png` - Optimize image
2. `.size-limit.json` - Create bundle budgets
3. `/src/app/layout.tsx` - Add resource hints
4. `/src/components/tables/keyword-results-table.tsx` - Virtual scrolling
5. `/next.config.js` - Critical CSS extraction (optional)
6. `/src/app/web-vitals.tsx` - Enhanced monitoring

---

## Automated Fixes Available

The following optimizations can be applied immediately:

- Image optimization (apple-icon.png)
- Size limit configuration
- Resource hints enhancement
- Virtual scrolling implementation

**Next Steps:**

1. Review this audit
2. Approve Phase 1 optimizations
3. Run implementation
4. Verify with Lighthouse
5. Deploy to production
