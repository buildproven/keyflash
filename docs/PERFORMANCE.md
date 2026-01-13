# Performance Optimization Guide

## Overview

KeyFlash is optimized for maximum performance with Lighthouse scores >90 across all metrics.

## Core Web Vitals Targets

| Metric                          | Target | Description              |
| ------------------------------- | ------ | ------------------------ |
| LCP (Largest Contentful Paint)  | <2.5s  | Main content visible     |
| INP (Interaction to Next Paint) | <200ms | Page responsiveness      |
| CLS (Cumulative Layout Shift)   | <0.1   | Visual stability         |
| FCP (First Contentful Paint)    | <1.8s  | First content appears    |
| TBT (Total Blocking Time)       | <300ms | Main thread availability |

## Optimization Strategies

### 1. Bundle Size Optimization

**Current optimizations:**

- Package import optimization for `@clerk/nextjs`, `@upstash/redis`, `zod`
- Dynamic imports for auth components
- Lazy loading of authenticated-only features
- Tree-shaking enabled

**Run bundle analysis:**

```bash
npm run perf:analyze
```

**Targets:**

- Initial JS bundle: <100KB gzipped
- Total page weight: <500KB
- Individual chunks: <200KB

### 2. Static Generation

All static pages use `force-static` for optimal performance:

- Homepage (`/`): Fully static
- Error pages: Static generation

### 3. Image Optimization

**Configuration (next.config.js):**

- AVIF + WebP formats
- Aggressive caching (1 year TTL)
- Responsive device sizes

**Best practices:**

- Always use Next.js `<Image>` component
- Set explicit width/height
- Use `priority` for above-fold images
- Use `loading="lazy"` for below-fold images

### 4. Caching Strategy

**Static assets:**

- Images/fonts: 1 year cache, immutable
- CSS/JS: 1 year cache, immutable
- HTML: No cache or short revalidation

**API routes:**

- No caching for dynamic data
- Redis caching for keyword data (7 days)

### 5. Code Splitting

**Dynamic imports used for:**

- Auth header (client-only)
- Saved searches list (authenticated users only)
- Save search modal (on-demand)
- Content brief modal (on-demand)
- Related keywords modal (on-demand)

**Pattern:**

```typescript
const Component = dynamic(() => import('./component'), {
  ssr: false,
  loading: () => <LoadingState />
})
```

### 6. CSS Optimization

**Optimizations:**

- System font stack (no external fonts)
- Minimal custom CSS (rely on Tailwind)
- Removed complex gradients
- Only define colors actually used

### 7. Third-Party Scripts

**Optimization strategy:**

- Preconnect to critical origins (Clerk)
- DNS prefetch for non-critical origins (Stripe, DataForSEO)
- Removed unused preconnects (Google Fonts)

## Performance Testing

### Run Lighthouse CI

```bash
npm run perf:audit
```

This builds the production app and runs Lighthouse tests.

### Monitor Web Vitals

Web Vitals are automatically tracked via `/src/app/web-vitals.tsx`:

- Development: Console logging
- Production: Vercel Analytics integration

### Bundle Analysis

```bash
ANALYZE=true npm run build
```

Opens bundle analyzer in browser with visual breakdown.

## Performance Checklist

Before deploying:

- [ ] Lighthouse Performance score >90
- [ ] Lighthouse Accessibility score >90
- [ ] Lighthouse Best Practices score >90
- [ ] Lighthouse SEO score >90
- [ ] LCP <2.5s
- [ ] INP <200ms
- [ ] CLS <0.1
- [ ] No JavaScript chunks >200KB
- [ ] Total bundle size <2MB
- [ ] All images optimized (WebP/AVIF)
- [ ] No render-blocking resources
- [ ] Web Vitals monitoring enabled

## Common Performance Issues

### Issue: Large bundle size

**Symptoms:**

- Slow initial page load
- Large JavaScript chunks (>200KB)

**Solutions:**

1. Check `npm run perf:analyze` for large chunks
2. Add more dynamic imports
3. Review dependencies with `npm ls --depth=0`
4. Remove unused dependencies

### Issue: Poor LCP

**Symptoms:**

- LCP >2.5s
- Slow to display main content

**Solutions:**

1. Optimize hero images (use `priority`)
2. Remove render-blocking resources
3. Improve server response time
4. Add preconnect hints

### Issue: High CLS

**Symptoms:**

- CLS >0.1
- Content jumping during load

**Solutions:**

1. Set explicit dimensions on images
2. Reserve space for dynamic content
3. Avoid inserting content above existing content
4. Use CSS `aspect-ratio` for images

### Issue: Poor INP

**Symptoms:**

- INP >200ms
- Slow interaction response

**Solutions:**

1. Reduce JavaScript execution time
2. Use web workers for heavy computation
3. Debounce/throttle event handlers
4. Break up long tasks

## Monitoring

### Development

Web Vitals are logged to console with the format:

```
[Web Vitals] { name: 'LCP', value: 1234, rating: 'good' }
```

### Production

Metrics are automatically sent to Vercel Analytics. View in your project's analytics dashboard on Vercel.

### Alerts

Set up alerts in Vercel for:

- LCP >2.5s
- INP >200ms
- CLS >0.1

## Resources

- [Web.dev Core Web Vitals](https://web.dev/vitals/)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
