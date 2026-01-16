# Secret Rotation Procedures

This document describes how to safely rotate security-sensitive credentials and secrets used by KeyFlash.

## Overview

Secret rotation is a critical security practice that limits the impact of potential credential compromise. This guide covers rotation procedures for all application secrets with zero-downtime deployment.

## Rotation Schedule

| Secret                 | Recommended Rotation | Trigger Events                           |
| ---------------------- | -------------------- | ---------------------------------------- |
| RATE_LIMIT_HMAC_SECRET | Every 90 days        | Security incident, employee departure    |
| Stripe API Keys        | Annually             | Security incident, compliance audit      |
| Clerk API Keys         | Annually             | Security incident, compliance audit      |
| Redis Credentials      | Every 180 days       | Security incident, infrastructure change |

## Prerequisites

- Access to production environment variables (Vercel dashboard or deployment platform)
- Admin access to third-party services (Stripe, Clerk, Upstash)
- Deployment permissions
- Monitoring access to verify successful rotation

---

## 1. RATE_LIMIT_HMAC_SECRET Rotation

**Purpose**: HMAC secret for client identification in rate limiting. Prevents attackers from bypassing rate limits by spoofing client IDs.

**Minimum Length**: 32 characters (256-bit entropy)

### Step 1: Generate New Secret

```bash
# Generate cryptographically secure 32-character secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 2: Deploy with Dual-Secret Support (Zero Downtime)

The rate limiter supports checking against multiple secrets for zero-downtime rotation:

1. Add new secret as `RATE_LIMIT_HMAC_SECRET_NEW` environment variable
2. Deploy application
3. Application will accept both old and new secrets for 24 hours
4. Monitor logs for any validation errors

### Step 3: Promote New Secret

After 24 hours of dual-secret operation:

1. Copy value from `RATE_LIMIT_HMAC_SECRET_NEW` to `RATE_LIMIT_HMAC_SECRET`
2. Remove `RATE_LIMIT_HMAC_SECRET_NEW`
3. Deploy application
4. Old secret is now deprecated

### Step 4: Verify

```bash
# Test API endpoint with rate limiting
curl -X POST https://keyflash.vibebuildlab.com/api/keywords \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["test"]}'

# Should return successful response or rate limit error (not validation error)
```

### Rollback

If issues occur:

1. Revert to previous `RATE_LIMIT_HMAC_SECRET` value
2. Remove `RATE_LIMIT_HMAC_SECRET_NEW`
3. Deploy
4. Investigate root cause before retrying

---

## 2. Stripe API Keys Rotation

**Purpose**: Stripe secret key and webhook signing secret for payment processing.

**Impact**: High - Affects all payment processing and webhook validation.

### Step 1: Generate New Keys in Stripe Dashboard

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers → API Keys**
3. Click **Reveal test key** (or live key) and copy to secure location
4. Navigate to **Developers → Webhooks**
5. Click on your webhook endpoint
6. Click **Roll signing secret**
7. Copy new signing secret (starts with `whsec_`)

### Step 2: Update Environment Variables

Update these variables in your deployment platform:

```bash
STRIPE_SECRET_KEY=sk_live_NEW_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_NEW_WEBHOOK_SECRET
STRIPE_PRICE_PRO=price_XXXXXXXXXX  # Usually unchanged
```

### Step 3: Deploy

```bash
# Vercel deployment
vercel --prod

# Monitor webhook events in Stripe dashboard
# Should see successful webhook deliveries immediately
```

### Step 4: Verify

1. **Test Checkout Flow**:

   ```bash
   # Create test checkout session
   curl -X POST https://keyflash.vibebuildlab.com/api/checkout \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'

   # Should return valid checkout URL
   ```

2. **Test Webhook Delivery**:
   - Trigger test webhook from Stripe Dashboard
   - Check application logs for successful signature validation
   - Verify `checkout.session.completed` events are processed

### Rollback

If webhook validation fails:

1. Revert `STRIPE_WEBHOOK_SECRET` to previous value
2. Deploy immediately
3. Contact Stripe support if issues persist

**Important**: Old webhook secret remains valid for 24 hours in Stripe, allowing graceful rollback.

---

## 3. Clerk API Keys Rotation

**Purpose**: Clerk authentication keys for user sign-in/sign-up.

**Impact**: Critical - Affects all user authentication.

### Step 1: Generate New Keys in Clerk Dashboard

1. Log in to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Navigate to **API Keys**
3. Click **Rotate Secret Key** (creates new `CLERK_SECRET_KEY`)
4. Publishable key (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) typically doesn't require rotation

### Step 2: Update Environment Variables

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_XXXXXXXXXX  # Usually unchanged
CLERK_SECRET_KEY=sk_live_NEW_SECRET_KEY
```

### Step 3: Deploy with Monitoring

```bash
# Deploy to production
vercel --prod

# Monitor authentication logs immediately after deployment
# Watch for any failed authentication attempts
```

### Step 4: Verify

1. **Test Sign-In Flow**:
   - Visit https://keyflash.vibebuildlab.com
   - Click "Sign In"
   - Authenticate with test account
   - Verify successful authentication

2. **Test API Authentication**:

   ```bash
   # Test protected API endpoint
   curl -X GET https://keyflash.vibebuildlab.com/api/searches \
     -H "Authorization: Bearer YOUR_CLERK_JWT"

   # Should return 200 OK with user's saved searches
   ```

### Rollback

If authentication fails:

1. Revert `CLERK_SECRET_KEY` to previous value
2. Deploy immediately
3. Monitor authentication recovery
4. Contact Clerk support if issues persist

**Important**: Old secret key remains valid for 1 hour in Clerk, allowing emergency rollback.

---

## 4. Redis Credentials Rotation

**Purpose**: Upstash Redis credentials for caching and rate limiting.

**Impact**: Medium - Affects caching and rate limiting, but application remains functional without Redis (fails open by default).

### Step 1: Generate New Credentials in Upstash Dashboard

1. Log in to [Upstash Console](https://console.upstash.com/)
2. Navigate to your Redis database
3. Click **Details → REST API**
4. Click **Rotate Token**
5. Copy new `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### Step 2: Update Environment Variables

```bash
UPSTASH_REDIS_REST_URL=https://NEW_URL.upstash.io
UPSTASH_REDIS_REST_TOKEN=NEW_TOKEN
```

### Step 3: Deploy

```bash
vercel --prod

# Monitor Redis connectivity in logs
# Should see "Redis connected successfully" messages
```

### Step 4: Verify

1. **Test Cache Write/Read**:

   ```bash
   # Submit keyword search (should cache results)
   curl -X POST https://keyflash.vibebuildlab.com/api/keywords \
     -H "Content-Type: application/json" \
     -d '{"keywords": ["seo tools"], "location": "United States", "language": "en"}'

   # Repeat same request (should return cached results faster)
   # Check response time - cached responses are ~10-50ms vs 200-500ms
   ```

2. **Test Rate Limiting**:

   ```bash
   # Make 11 requests rapidly (exceeds 10/hour limit)
   for i in {1..11}; do
     curl -X POST https://keyflash.vibebuildlab.com/api/keywords \
       -H "Content-Type: application/json" \
       -d "{\"keywords\": [\"test $i\"]}"
   done

   # 11th request should return 429 Too Many Requests
   ```

### Rollback

If Redis connection fails:

1. Revert credentials to previous values
2. Deploy
3. Application will continue to function (Redis is optional)
4. Verify with Upstash support

**Note**: Application gracefully degrades without Redis (no caching, rate limiting fails open).

---

## Emergency Rotation

**Scenario**: Immediate secret rotation required due to security incident or credential leak.

### Critical Secrets (Rotate Immediately)

1. **STRIPE_SECRET_KEY** - Can process payments
2. **CLERK_SECRET_KEY** - Can authenticate as any user
3. **RATE_LIMIT_HMAC_SECRET** - Can bypass rate limits

### Emergency Procedure

1. **Notify team** via incident communication channel
2. **Rotate compromised secret** following procedures above (skip monitoring period)
3. **Deploy immediately** to production
4. **Monitor for abuse** in application logs and third-party dashboards
5. **Document incident** including:
   - Which secret was compromised
   - How it was discovered
   - Impact assessment
   - Remediation steps taken
6. **Post-mortem** within 24 hours to prevent recurrence

### Verification After Emergency Rotation

1. Confirm old secret no longer works (test with old value)
2. Confirm new secret works (test with new value)
3. Review recent logs for suspicious activity using old credentials
4. Monitor for 48 hours for any delayed issues

---

## Testing Secret Rotation (Staging)

Before rotating production secrets, test the procedure in staging:

1. **Create staging environment** with separate secrets
2. **Perform rotation** following procedures above
3. **Verify all functionality**:
   - Authentication (Clerk)
   - Payment processing (Stripe test mode)
   - Caching (Redis)
   - Rate limiting (HMAC secret)
4. **Document any issues** and adjust procedures
5. **Schedule production rotation** during low-traffic period

---

## Monitoring During Rotation

**Key Metrics to Watch**:

1. **Error Rate**: Should remain stable (< 1% increase acceptable)
2. **Authentication Success Rate**: Should remain > 99%
3. **Webhook Delivery Success**: Should remain > 98%
4. **Redis Connection Status**: Should show "connected"
5. **API Response Times**: Should remain within baseline (< 10% increase)

**Alert Thresholds**:

- Error rate increase > 5% → Immediate investigation
- Authentication failures > 1% → Rollback
- Webhook delivery failures > 10% → Rollback
- Redis disconnections > 3 in 5 minutes → Investigate

---

## Compliance & Audit Trail

**Documentation Requirements**:

1. Record rotation date in change log
2. Note which secrets were rotated
3. Document reason for rotation (scheduled vs emergency)
4. Verify rotation in compliance tracking system

**Audit Trail** (for compliance):

```bash
# Example audit log entry
{
  "timestamp": "2026-01-15T10:30:00Z",
  "action": "secret_rotation",
  "secret_type": "STRIPE_SECRET_KEY",
  "reason": "scheduled_90_day_rotation",
  "performed_by": "admin@keyflash.com",
  "environment": "production",
  "verification_status": "success"
}
```

---

## Troubleshooting

### "Invalid HMAC signature" errors after rotation

**Cause**: Clients using cached rate limit tokens signed with old secret

**Solution**:

- Wait 1 hour for client caches to expire
- Or clear Redis cache: `redis-cli FLUSHDB` (staging only)

### Webhook signature validation fails after Stripe rotation

**Cause**: Application using old webhook secret

**Solution**:

1. Verify `STRIPE_WEBHOOK_SECRET` environment variable is updated
2. Check deployment succeeded (no rollback)
3. Restart application to ensure new secret loaded

### Authentication fails after Clerk rotation

**Cause**: Application using old secret key

**Solution**:

1. Verify `CLERK_SECRET_KEY` environment variable is updated
2. Check deployment succeeded
3. Clear browser cookies and retry authentication

### Redis connection fails after rotation

**Cause**: Invalid credentials or URL

**Solution**:

1. Verify credentials are correctly copied from Upstash dashboard
2. Check URL format (should start with `https://`)
3. Test credentials with `curl`:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        YOUR_REDIS_URL/get/test
   ```

---

## Best Practices

1. **Schedule rotations during low-traffic periods** (e.g., weekends, early morning)
2. **Rotate one secret at a time** to isolate issues
3. **Monitor for 24 hours** after rotation before rotating next secret
4. **Document all rotations** in change log with date and reason
5. **Test rotation procedures** in staging before production
6. **Keep rollback plan ready** with old credentials in secure location (24 hours only)
7. **Use password manager** (1Password, LastPass) to securely store old credentials during rollback period
8. **Never commit secrets** to git or share via insecure channels

---

## Questions?

For questions about secret rotation procedures:

- Security incidents: Contact security team immediately
- Scheduled rotations: File ticket in project management system
- Technical issues: Check application logs and contact DevOps team
