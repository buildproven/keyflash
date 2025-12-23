/**
 * Simple In-Memory Rate Limiter
 *
 * This is a synchronous rate limiter for simple use cases.
 * For production with Redis, use redis-rate-limiter.ts instead.
 */

export interface SimpleRateLimitConfig {
  requestsPerHour: number
  enabled: boolean
  windowSizeMs?: number
}

// Alias for backwards compatibility
export type RateLimitConfig = SimpleRateLimitConfig

export interface RateLimitInfo {
  remaining: number
  resetAt: Date
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limit entries
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Extract client identifier from request headers
 */
export function getClientId(request: Request): string {
  // Try x-forwarded-for first (standard proxy header)
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  // Try x-real-ip (nginx default)
  const xRealIp = request.headers.get('x-real-ip')
  if (xRealIp) {
    return xRealIp.trim()
  }

  // Fallback for local development
  return 'local-dev'
}

/**
 * Clean up expired entries from the store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [clientId, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(clientId)
    }
  }
}

/**
 * Check if client is within rate limit, throws if exceeded
 */
export function checkRateLimit(
  clientId: string,
  config: SimpleRateLimitConfig
): void {
  if (!config.enabled) {
    return // Rate limiting disabled
  }

  // Clean up old entries periodically
  cleanupExpiredEntries()

  const now = Date.now()
  const windowMs = config.windowSizeMs || 60 * 60 * 1000 // 1 hour default
  const resetTime = now + windowMs

  let entry = rateLimitStore.get(clientId)

  // Check if entry exists and is still valid
  if (entry && now > entry.resetTime) {
    // Entry expired, remove it
    rateLimitStore.delete(clientId)
    entry = undefined
  }

  if (!entry) {
    // First request from this client
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime,
    })
    return
  }

  // Check if limit exceeded
  if (entry.count >= config.requestsPerHour) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000)
    throw new Error(
      `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds. ` +
        `Limit: ${config.requestsPerHour} requests/hour.`
    )
  }

  // Increment count
  entry.count += 1
  rateLimitStore.set(clientId, entry)
}

/**
 * Get rate limit info for a client without consuming a request
 */
export function getRateLimitInfo(
  clientId: string,
  config: SimpleRateLimitConfig
): RateLimitInfo {
  const now = Date.now()
  const windowMs = config.windowSizeMs || 60 * 60 * 1000
  const resetTime = now + windowMs

  const entry = rateLimitStore.get(clientId)

  if (!entry || now > entry.resetTime) {
    // No entry or expired
    return {
      remaining: config.requestsPerHour,
      resetAt: new Date(resetTime),
    }
  }

  return {
    remaining: Math.max(0, config.requestsPerHour - entry.count),
    resetAt: new Date(entry.resetTime),
  }
}

/**
 * Clear all rate limit entries (for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear()
}
