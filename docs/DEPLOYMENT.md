# Deployment Guide

## Overview

KeyFlash is deployed on Vercel, a Next.js-optimized cloud platform. This document outlines deployment procedures, environment configuration, and production best practices.

## Deployment Platforms

### Production (Vercel)

- **URL**: https://keyflash.vibebuildlab.com
- **Automatic deploys**: Triggered on `main` branch push
- **Preview deploys**: Created for each pull request
- **Rollback**: Available via Vercel dashboard

### Preview Deployments

- **Staging**: Automatic on pull request creation
- **Branch previews**: Each branch gets a unique preview URL
- **Cleanup**: Deleted after PR merge

## Environment Variables

### Production Secrets

The following environment variables must be configured in Vercel:

```
KEYWORD_API_PROVIDER
GOOGLE_ADS_CLIENT_ID
GOOGLE_ADS_CLIENT_SECRET
GOOGLE_ADS_DEVELOPER_TOKEN
GOOGLE_ADS_REFRESH_TOKEN
GOOGLE_ADS_CUSTOMER_ID
DATAFORSEO_API_LOGIN
DATAFORSEO_API_PASSWORD
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
RATE_LIMIT_ENABLED
RATE_LIMIT_REQUESTS_PER_HOUR
RATE_LIMIT_HMAC_SECRET
RATE_LIMIT_FAIL_SAFE
RELATED_KEYWORDS_RATE_LIMIT_PER_HOUR
PRIVACY_MODE
SENTRY_DSN
```

**Management**: Configure in Vercel dashboard → Settings → Environment Variables

## Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Environment variables configured
- [ ] Security audit passed (`npm run security:audit`)
- [ ] Lighthouse CI score ≥90% (SEO)
- [ ] PR approved and merged to `main`

## Pre-deployment

```bash
# Run full validation
npm run validate:all

# Build locally to verify
npm run build

# Test production build
npm start
```

## Monitoring

- **Vercel Analytics**: https://vercel.com/dashboard
- **Error tracking**: Configure Sentry (if needed)
- **Performance**: Monitor Core Web Vitals via Vercel

## Rollback Procedure

1. Go to Vercel dashboard
2. Select KeyFlash project
3. Navigate to "Deployments"
4. Click previous stable deployment
5. Click "Redeploy"

## Domain Management

- **Custom domain**: keyflash.vibebuildlab.com
- **DNS**: Managed by vibebuildlab.com registrar
- **SSL**: Automatic via Vercel

## Post-Deployment

1. Verify custom domain loads correctly
2. Check canonical URLs in page source
3. Verify Open Graph tags
4. Test critical user flows

---

> **Vibe Build Lab LLC** · [vibebuildlab.com](https://vibebuildlab.com)
