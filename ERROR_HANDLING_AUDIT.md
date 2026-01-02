# Error Handling Audit Report

**Date:** 2026-01-01
**Commits Reviewed:** HEAD~5..HEAD (6b669c8 to 506c496)
**Auditor:** Claude (Error Handling Review Agent)
**Severity Levels:** CRITICAL, HIGH, MEDIUM

---

## Executive Summary

Reviewed 9 files across 5 commits focusing on error handling, silent failures, and fallback behavior. Found **12 issues** ranging from silent failures to inappropriate error swallowing that could lead to hard-to-debug production incidents.

**Critical Issues:** 5
**High Severity:** 4
**Medium Severity:** 3

---

## CRITICAL ISSUES

### CRITICAL-001: Silent Webhook Idempotency Failures

**Location:** `/Users/brettstark/Projects/keyflash/src/app/api/webhooks/stripe/route.ts:71-77`

**Issue:**

```typescript
} catch (error) {
  logger.warn('Failed to mark webhook event as processed', {
    eventId,
    error,
  })
  // Continue even if marking fails - better to risk duplicate than fail
}
```

**Severity:** CRITICAL

**Problem:**

- The webhook proceeds successfully even when failing to mark the event as processed
- Redis failures are swallowed with only a warning
- This creates a hidden inconsistency where Stripe thinks the webhook succeeded, but the event isn't marked, leading to duplicate processing on retry
- Users could be double-charged or have duplicate subscription state changes

**Hidden Errors That Could Be Caught:**

- Redis connection failures
- Network timeouts
- Redis authentication errors
- Redis out of memory errors
- Rate limiting from Redis

**User Impact:**

- Duplicate subscription creations
- Double billing
- Inconsistent subscription states
- Hard-to-debug "phantom charges" that only appear in logs

**Recommendation:**

```typescript
} catch (error) {
  logger.error('Failed to mark webhook event as processed', error, {
    eventId,
    module: 'StripeWebhook',
  })
  // FIX: Return 503 to trigger Stripe retry instead of silently continuing
  throw new InfrastructureError('Failed to mark webhook event as processed')
}
```

This ensures Stripe retries the webhook until it can be successfully marked as processed.

---

### CRITICAL-002: Webhook Idempotency Check Failure Proceeds Silently

**Location:** `/Users/brettstark/Projects/keyflash/src/app/api/webhooks/stripe/route.ts:52-58`

**Issue:**

```typescript
try {
  const exists = await redis.exists(`${WEBHOOK_EVENT_PREFIX}${eventId}`)
  return exists === 1
} catch (error) {
  logger.warn('Failed to check webhook event idempotency', {
    eventId,
    error,
  })
  return false // Allow processing if check fails
}
```

**Severity:** CRITICAL

**Problem:**

- When Redis fails, the code returns `false` (event not processed), allowing duplicate processing
- This is the opposite of fail-safe behavior for financial transactions
- A Redis outage would cause ALL webhook events to be processed as duplicates
- Comment says "allow processing if check fails" but this creates duplicate billing risk

**Hidden Errors:**

- Redis connection failures
- Network partitions
- Redis cluster failover
- Authentication errors
- Timeouts

**User Impact:**

- During Redis outage, every webhook retry becomes a duplicate transaction
- Users could see multiple charges
- Subscription status could flip back and forth
- Customer support nightmare during infrastructure incidents

**Recommendation:**

```typescript
} catch (error) {
  logger.error('Failed to check webhook event idempotency', error, {
    eventId,
    module: 'StripeWebhook',
  })
  // FIX: Fail closed for financial operations - return true to prevent duplicates
  // Stripe will retry, giving Redis time to recover
  return true // Treat check failure as "already processed" to prevent duplicates
}
```

For financial operations, failing closed (assuming already processed) is safer than risking duplicates.

---

### CRITICAL-003: Cache Write Failures Silently Swallowed

**Location:** `/Users/brettstark/Projects/keyflash/src/app/api/keywords/route.ts:204-207`

**Issue:**

```typescript
await Promise.race([cacheWrite, timeout]).catch(error => {
  logger.error('Failed to cache data', error, { module: 'Cache' })
})
```

**Severity:** CRITICAL

**Problem:**

- Cache write failures are completely swallowed
- No indication to the user that their data wasn't cached
- No metrics tracking cache failure rate
- Could hide systematic Redis issues for weeks
- The `.catch()` prevents the error from propagating, making it impossible to detect in monitoring

**Hidden Errors:**

- Redis out of memory (could affect rate limiting too)
- Redis authentication expiration
- Network issues to Redis
- Data serialization errors
- Key name conflicts

**User Impact:**

- Users experience slow searches when cache is broken (but don't know why)
- Increased API costs from repeated external API calls
- Support teams can't explain why performance degraded
- No way to know cache is broken until API costs spike

**Recommendation:**

```typescript
try {
  await Promise.race([cacheWrite, timeout])
} catch (error) {
  logger.error('Failed to cache data', error, {
    module: 'Cache',
    errorId: 'CACHE_WRITE_FAILED', // For Sentry tracking
  })
  // Increment failure metric for monitoring
  // Consider fallback to in-memory cache or degraded mode
  // DO NOT silently continue - at minimum, set a flag in response
}

// In response:
const response: KeywordSearchResponse = {
  data: keywordData,
  cached: isCached,
  cacheHealthy: cacheWriteSucceeded, // Add this field
  timestamp: new Date().toISOString(),
  mockData: isMockData,
  provider: providerName,
}
```

At minimum, track and expose cache health so users understand degraded performance.

---

### CRITICAL-004: Related Keywords Cache Failure Silent

**Location:** `/Users/brettstark/Projects/keyflash/src/app/api/keywords/related/route.ts:141-145`

**Issue:**
Same pattern as CRITICAL-003:

```typescript
await Promise.race([cacheWrite, timeout]).catch(error => {
  logger.error('Failed to cache related keywords', error, {
    module: 'Cache',
  })
})
```

**Severity:** CRITICAL

**Problem:** Identical to CRITICAL-003 but for related keywords endpoint.

**Recommendation:** Same fix as CRITICAL-003 - track cache health and expose in response.

---

### CRITICAL-005: Webhook Redis Initialization Failure Returns Null

**Location:** `/Users/brettstark/Projects/keyflash/src/app/api/webhooks/stripe/route.ts:34-39`

**Issue:**

```typescript
try {
  webhookRedis = new Redis({ url, token })
  return webhookRedis
} catch (error) {
  logger.error('Failed to initialize webhook Redis client', error, {
    module: 'StripeWebhook',
  })
  return null
}
```

**Severity:** CRITICAL

**Problem:**

- Redis initialization failure returns `null` instead of throwing
- This allows webhooks to proceed without idempotency protection
- The error is logged but the webhook continues to process events
- All webhook events would be duplicated on every retry if Redis is misconfigured

**Hidden Errors:**

- Invalid Redis credentials
- Network configuration issues
- DNS resolution failures
- Redis server not running
- Invalid URL format

**User Impact:**

- Misconfigured Redis in production = duplicate billing for all users
- No fail-fast behavior means the problem isn't caught until money is involved
- Debugging nightmare because logs show "success" for webhook processing

**Recommendation:**

```typescript
try {
  webhookRedis = new Redis({ url, token })
  return webhookRedis
} catch (error) {
  logger.error('Failed to initialize webhook Redis client', error, {
    module: 'StripeWebhook',
    errorId: 'WEBHOOK_REDIS_INIT_FAILED',
  })
  // FIX: In production, Redis is required for webhook idempotency
  if (process.env.NODE_ENV === 'production') {
    throw error // Fail fast instead of silently continuing
  }
  return null // Only allow null in development
}
```

Financial operations should never proceed with broken infrastructure.

---

## HIGH SEVERITY ISSUES

### HIGH-001: Edge Rate Limit Fail-Open in Production

**Location:** `/Users/brettstark/Projects/keyflash/src/lib/edge-rate-limit.ts:255-266`

**Issue:**

```typescript
} catch (error) {
  logger.error('Edge rate limit check failed', error, {
    module: 'EdgeRateLimit',
  })

  if (process.env.NODE_ENV === 'production') {
    return { limited: true, remaining: 0, resetTime, retryAfter: 60 }
  }

  return { limited: false, remaining: limit - 1, resetTime, retryAfter: 0 }
}
```

**Severity:** HIGH

**Problem:**

- In production, ANY error causes rate limiting to return `limited: true`
- This catches ALL errors, including:
  - Type errors in the function logic
  - Invalid parameters
  - Null reference errors
  - Logic bugs in window calculation
- A bug in the rate limiting code would block ALL users
- Users receive generic "rate limited" error for bugs unrelated to actual rate limits

**Hidden Errors That Could Trigger False Rate Limiting:**

- `identifier` parameter is undefined
- `windowMs` is NaN or negative
- `storage.increment()` throws due to code bug (not Redis)
- Type coercion errors
- Math errors in window calculation

**User Impact:**

- Code bug in rate limiter → all users blocked from entire API
- Error message says "rate limited" but real problem is a software bug
- No way for users to resolve the issue (not actually rate limited)
- Support team confused because users aren't actually exceeding limits

**Recommendation:**

```typescript
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error'

  // Distinguish infrastructure errors from code errors
  const isInfraError = error instanceof Error && (
    errorMsg.includes('Redis') ||
    errorMsg.includes('ECONNREFUSED') ||
    errorMsg.includes('ETIMEDOUT')
  )

  if (isInfraError) {
    logger.error('Edge rate limit infrastructure failure', error, {
      module: 'EdgeRateLimit',
      errorId: 'RATE_LIMIT_INFRA_FAIL',
    })
    // Fail closed for infrastructure issues
    return { limited: true, remaining: 0, resetTime, retryAfter: 60 }
  } else {
    // Code bugs should throw, not silently block users
    logger.error('Edge rate limit code error - MUST FIX', error, {
      module: 'EdgeRateLimit',
      identifier,
      limit,
      windowMs,
      errorId: 'RATE_LIMIT_CODE_BUG',
    })

    if (process.env.NODE_ENV === 'production') {
      // Fail open for code bugs (but log loudly for alerting)
      return { limited: false, remaining: limit - 1, resetTime, retryAfter: 0 }
    }
    throw error // Fail fast in development
  }
}
```

Distinguish infrastructure failures (fail closed) from code bugs (fail open + alert).

---

### HIGH-002: Edge Rate Limit Status Check Same Issue

**Location:** `/Users/brettstark/Projects/keyflash/src/lib/edge-rate-limit.ts:294-305`

**Issue:**
Same broad catch pattern as HIGH-001 in `getEdgeRateLimitStatus()`.

**Severity:** HIGH

**Recommendation:** Same fix as HIGH-001.

---

### HIGH-003: Provider Factory Swallows Invalid Config in Production

**Location:** `/Users/brettstark/Projects/keyflash/src/lib/api/factory.ts:170-180`

**Issue:**

```typescript
if (!isValidProviderName(rawName)) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `Invalid KEYWORD_API_PROVIDER "${rawName}". ` +
        `Valid options: ${VALID_PROVIDER_NAMES.join(', ')}`
    )
  }
  logger.warn(
    `Unknown provider "${rawName}". Falling back to mock provider (dev only).`
  )
  return new MockProvider()
}
```

**Severity:** HIGH

**Problem:**

- Good: Production now throws on invalid provider (FIX-017)
- However, the error is thrown during factory creation, which might happen during request handling
- This could cause all API requests to fail with a 500 error
- Better to fail at startup than during first request

**Hidden Errors:**

- Typo in `KEYWORD_API_PROVIDER` environment variable
- Environment variable not set in deployment
- Variable set to wrong casing (e.g., "Mock" instead of "mock")

**User Impact:**

- Misconfigured provider → all searches return 500 error
- Error only appears after deployment when first user tries to search
- No pre-flight validation during deployment

**Recommendation:**

```typescript
// Add startup validation in a Next.js instrumentation file or API route
export async function validateProviderConfig() {
  try {
    const provider = createProvider()
    provider.validateConfiguration()
    logger.info('Provider validated successfully', {
      provider: provider.name,
    })
  } catch (error) {
    logger.error('FATAL: Provider configuration invalid', error, {
      errorId: 'PROVIDER_CONFIG_INVALID',
      env: process.env.KEYWORD_API_PROVIDER,
    })
    if (process.env.NODE_ENV === 'production') {
      // Fail fast on startup instead of on first request
      throw error
    }
  }
}
```

Validate provider configuration at startup, not on first request.

---

### HIGH-004: Checkout Session Error Hides Infrastructure vs Config Issues

**Location:** `/Users/brettstark/Projects/keyflash/src/app/api/checkout/route.ts:153-160`

**Issue:**

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  logger.error('Checkout session creation failed', { error: message })
  return NextResponse.json(
    { error: 'Failed to create checkout session' },
    { status: 500 }
  )
}
```

**Severity:** HIGH

**Problem:**

- Broad catch hides different error types requiring different responses
- Stripe API errors (503 from Stripe) should be retried
- Invalid configuration (missing API key) should fail fast
- Rate limit errors from Stripe should return 429, not 500
- User sees generic "Failed to create checkout session" for all errors

**Hidden Errors:**

- Stripe API downtime (should return 503, not 500)
- Invalid Stripe price ID (should return 500 with config error)
- Stripe rate limiting (should return 429)
- Network timeout to Stripe (should return 503)
- Invalid request parameters (should return 400)
- User service errors (already handled separately, but could be clearer)

**User Impact:**

- User clicks "Upgrade to Pro" → generic error
- Can't tell if problem is temporary (Stripe down) or permanent (config issue)
- Support team can't guide users ("try again" vs "contact support")
- Retry logic in client doesn't know if retry will help

**Recommendation:**

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error'

  // Stripe API errors
  if (err instanceof Stripe.errors.StripeError) {
    if (err.type === 'StripeConnectionError' || err.statusCode === 503) {
      logger.error('Stripe API unavailable', err, { module: 'Checkout' })
      return NextResponse.json(
        { error: 'Payment service temporarily unavailable. Please try again.' },
        { status: 503 }
      )
    }

    if (err.statusCode === 429) {
      logger.warn('Stripe rate limited', { module: 'Checkout' })
      return NextResponse.json(
        { error: 'Too many payment requests. Please wait a moment and try again.' },
        { status: 429 }
      )
    }
  }

  // Configuration errors
  if (message.includes('not configured')) {
    logger.error('Checkout misconfigured', err, {
      module: 'Checkout',
      errorId: 'CHECKOUT_CONFIG_ERROR'
    })
    return NextResponse.json(
      { error: 'Checkout not available. Please contact support.' },
      { status: 503 }
    )
  }

  // User service errors (already handled, but be explicit)
  if (err instanceof UserServiceUnavailableError) {
    logger.error('User service unavailable during checkout', err)
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again.' },
      { status: 503 }
    )
  }

  // Generic error as fallback
  logger.error('Unexpected checkout error', err, { module: 'Checkout' })
  return NextResponse.json(
    { error: 'Failed to create checkout session' },
    { status: 500 }
  )
}
```

---

## MEDIUM SEVERITY ISSUES

### MEDIUM-001: isProviderAvailable Swallows All Errors

**Location:** `/Users/brettstark/Projects/keyflash/src/lib/api/factory.ts:230-243`

**Issue:**

```typescript
export function isProviderAvailable(providerName: ProviderName): boolean {
  if (providerName === 'mock') return true

  try {
    const provider = createProvider()
    if (provider.name.toLowerCase().replace(/\s/g, '-') !== providerName) {
      return false
    }
    provider.validateConfiguration()
    return true
  } catch {
    return false
  }
}
```

**Severity:** MEDIUM

**Problem:**

- Empty catch block returns `false` for ALL errors
- Can't distinguish "provider not configured" from "code bug in provider.validateConfiguration()"
- Used for feature flags, but swallowing errors could hide bugs

**Hidden Errors:**

- Null reference errors in provider code
- Type errors in validation logic
- Network errors during config check
- File system errors reading credentials

**User Impact:**

- Low: This appears to be used for capability detection, not critical path
- However, a bug in provider validation code would be silently hidden
- Debugging would be difficult ("why does it think the provider isn't available?")

**Recommendation:**

```typescript
} catch (error) {
  logger.debug('Provider availability check failed', {
    provider: providerName,
    error: error instanceof Error ? error.message : 'Unknown',
  })
  return false
}
```

At minimum, log why the check failed for debugging.

---

### MEDIUM-002: Memory Storage Eviction Could Delete Active Entries

**Location:** `/Users/brettstark/Projects/keyflash/src/lib/edge-rate-limit.ts:155-164`

**Issue:**

```typescript
if (this.store.size >= MAX_MEMORY_ENTRIES && !this.store.has(key)) {
  // Evict ~10% of oldest entries based on expiresAt
  const entries = Array.from(this.store.entries())
    .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    .slice(0, Math.ceil(MAX_MEMORY_ENTRIES * 0.1))
  for (const [k] of entries) {
    this.store.delete(k)
  }
}
```

**Severity:** MEDIUM

**Problem:**

- Evicts entries based on `expiresAt`, but doesn't check if they're actually expired
- If MAX_MEMORY_ENTRIES is reached, evicts oldest entries even if they haven't expired yet
- Could evict active rate limit entries for users still within their window
- This would reset their rate limit counter, giving them more requests than allowed

**Hidden Errors:**

- Under high load with many unique IPs, legitimate rate limit tracking lost
- Attackers could exploit this by rotating IPs to trigger evictions

**User Impact:**

- Rate limiting becomes unreliable when server is under load
- Users could exceed their limits without being blocked
- Inconsistent rate limit enforcement

**Recommendation:**

```typescript
if (this.store.size >= MAX_MEMORY_ENTRIES && !this.store.has(key)) {
  // First try to evict EXPIRED entries
  const now = Date.now()
  const expiredKeys = Array.from(this.store.entries())
    .filter(([, entry]) => entry.expiresAt <= now)
    .map(([k]) => k)

  if (expiredKeys.length > 0) {
    expiredKeys.forEach(k => this.store.delete(k))
  } else {
    // Only if no expired entries, evict oldest by expiresAt
    logger.warn('Memory rate limit store full, evicting active entries', {
      module: 'EdgeRateLimit',
      size: this.store.size,
    })
    const entries = Array.from(this.store.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
      .slice(0, Math.ceil(MAX_MEMORY_ENTRIES * 0.1))
    for (const [k] of entries) {
      this.store.delete(k)
    }
  }
}
```

Prioritize evicting expired entries before active ones.

---

### MEDIUM-003: Redis Rate Limiter Health Check Swallows Error

**Location:** `/Users/brettstark/Projects/keyflash/src/lib/rate-limit/redis-rate-limiter.ts:264-275`

**Issue:**

```typescript
async isHealthy(): Promise<boolean> {
  if (!this.isRedisAvailable) {
    return true // Memory fallback is always "healthy"
  }

  try {
    const result = await this.redis!.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}
```

**Severity:** MEDIUM

**Problem:**

- Empty catch block, no logging
- Health check failure is silent
- Monitoring systems can't tell WHY health check failed
- Could be network issue, auth issue, Redis down, etc.

**Hidden Errors:**

- Redis connection timeout
- Redis authentication failure
- Network partition
- Redis server down
- DNS resolution failure

**User Impact:**

- Health checks fail silently in monitoring
- No alerting on what's wrong with Redis
- Debugging requires checking application logs elsewhere

**Recommendation:**

```typescript
} catch (error) {
  logger.warn('Redis health check failed', {
    module: 'RedisRateLimiter',
    error: error instanceof Error ? error.message : 'Unknown',
  })
  return false
}
```

Log health check failures for monitoring and debugging.

---

## Summary of Recommendations

### Immediate Actions (CRITICAL Issues)

1. **Webhook Idempotency (CRITICAL-001, CRITICAL-002, CRITICAL-005):**
   - Make Redis marking failures throw instead of silently continuing
   - Fail closed on idempotency check failures
   - Fail fast on Redis initialization in production

2. **Cache Failures (CRITICAL-003, CRITICAL-004):**
   - Track cache write failures
   - Expose cache health in API responses
   - Add metrics for monitoring

### High Priority (HIGH Issues)

3. **Rate Limit Error Handling (HIGH-001, HIGH-002):**
   - Distinguish infrastructure errors from code bugs
   - Fail open only for code bugs, fail closed for infra issues
   - Add specific error IDs for alerting

4. **Provider Configuration (HIGH-003):**
   - Validate provider config at startup
   - Add pre-flight checks in deployment

5. **Checkout Error Specificity (HIGH-004):**
   - Distinguish Stripe API errors from config errors
   - Return appropriate status codes (503 vs 429 vs 500)
   - Provide actionable user feedback

### Medium Priority (MEDIUM Issues)

6. **Provider Availability (MEDIUM-001):** Add debug logging
7. **Memory Eviction (MEDIUM-002):** Evict expired entries first
8. **Health Checks (MEDIUM-003):** Log failure reasons

---

## Testing Recommendations

For each CRITICAL and HIGH issue, add integration tests:

```typescript
// Test webhook idempotency with Redis failure
test('webhook fails when cannot mark event processed', async () => {
  // Mock Redis to throw
  const response = await POST(mockWebhookRequest)
  expect(response.status).toBe(503) // Should retry, not succeed
})

// Test cache failure doesn't break request
test('search succeeds even when cache write fails', async () => {
  // Mock Redis cache write to throw
  const response = await POST(mockSearchRequest)
  expect(response.status).toBe(200)
  expect(response.json().cacheHealthy).toBe(false)
})
```

---

## Monitoring & Alerting Additions

Add error IDs to Sentry for tracking:

```typescript
// constants/errorIds.ts
export const ERROR_IDS = {
  WEBHOOK_IDEMPOTENCY_FAIL: 'ERR_WEBHOOK_001',
  CACHE_WRITE_FAILED: 'ERR_CACHE_001',
  RATE_LIMIT_CODE_BUG: 'ERR_RATELIMIT_001',
  PROVIDER_CONFIG_INVALID: 'ERR_PROVIDER_001',
  CHECKOUT_CONFIG_ERROR: 'ERR_CHECKOUT_001',
} as const
```

Use in all logger.error() calls for better Sentry grouping and alerting.

---

**End of Audit Report**
