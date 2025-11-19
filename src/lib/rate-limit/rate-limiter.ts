/**
 * Simple in-memory rate limiter
 * For production, use Redis-based rate limiting (Phase 5)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  requestsPerHour: number;
  enabled: boolean;
}

/**
 * Gets the client identifier from request headers
 */
export function getClientId(request: Request): string {
  // Try to get real IP from headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // Fallback to a hash of headers (for local development)
  return 'local-dev';
}

/**
 * Checks if the client has exceeded the rate limit
 * @param clientId - Unique client identifier
 * @param config - Rate limit configuration
 * @returns True if rate limit exceeded, false otherwise
 * @throws Error if rate limit is exceeded
 */
export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): void {
  if (!config.enabled) {
    return; // Rate limiting disabled
  }

  const now = Date.now();
  const entry = rateLimitStore.get(clientId);

  // Clean up expired entries (older than 1 hour)
  if (entry && now > entry.resetTime) {
    rateLimitStore.delete(clientId);
  }

  const currentEntry = rateLimitStore.get(clientId);

  if (!currentEntry) {
    // First request from this client
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + 60 * 60 * 1000, // 1 hour from now
    });
    return;
  }

  // Check if limit exceeded
  if (currentEntry.count >= config.requestsPerHour) {
    const resetIn = Math.ceil((currentEntry.resetTime - now) / 1000 / 60);
    throw new Error(
      `Rate limit exceeded. Try again in ${resetIn} minutes. Limit: ${config.requestsPerHour} requests/hour.`
    );
  }

  // Increment count
  currentEntry.count += 1;
  rateLimitStore.set(clientId, currentEntry);
}

/**
 * Gets rate limit info for a client
 */
export function getRateLimitInfo(clientId: string, config: RateLimitConfig) {
  const entry = rateLimitStore.get(clientId);

  if (!entry) {
    return {
      remaining: config.requestsPerHour,
      resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  return {
    remaining: Math.max(0, config.requestsPerHour - entry.count),
    resetAt: new Date(entry.resetTime).toISOString(),
  };
}
