# Lighthouse Performance Audits

This directory contains Lighthouse audit results for performance tracking.

## Running Audits

### Local Development

```bash
# Audit local build
npm run perf:audit
```

### Production Site

```bash
# Audit live production site
npm run perf:audit:live
```

### Custom URL

```bash
# Audit any URL
bash scripts/lighthouse-audit.sh https://example.com
```

## Targets

All Lighthouse scores must be >90:

- Performance: >90
- Accessibility: >90
- Best Practices: >90
- SEO: >90

Core Web Vitals targets:

- LCP: <2.5s
- INP: <200ms
- CLS: <0.1

## CI/CD Integration

Lighthouse CI is configured via `lighthouserc.json` and runs automatically on:

- Pull requests
- Merges to main branch
- Production deployments

Failed audits will block the build if scores fall below thresholds.

## Troubleshooting

### Low Performance Score

1. Check bundle size: `npm run perf:analyze`
2. Review Web Vitals in Vercel Analytics
3. Profile with Chrome DevTools
4. Check for render-blocking resources

### Low Accessibility Score

1. Run axe: `npx @axe-core/cli https://keyflash.buildproven.ai`
2. Check color contrast
3. Verify ARIA labels
4. Test keyboard navigation

### Low Best Practices Score

1. Review CSP headers
2. Check for mixed content
3. Verify HTTPS configuration
4. Review third-party scripts

### Low SEO Score

1. Verify meta tags
2. Check robots.txt
3. Validate sitemap.xml
4. Review structured data

## History

Lighthouse reports are saved with timestamps for historical comparison:

- `lighthouse-report-YYYY-MM-DD-HH-MM.html`
- `lighthouse-report-YYYY-MM-DD-HH-MM.json`

Use the JSON reports to track performance trends over time.
