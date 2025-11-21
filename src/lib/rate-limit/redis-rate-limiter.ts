import { Redis } from '@upstash/redis'
import crypto from 'crypto'

/**
 * Redis-based rate limiter with spoof-resistant client identification
 * Replaces the vulnerable in-memory implementation
 */

export interface RateLimitConfig {
  requestsPerHour: number
  enabled: boolean
  windowSizeMs?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfter?: number
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

export class RedisRateLimiter {
  private redis: Redis | null = null
  private fallbackStore = new Map<string, RateLimitEntry>()
  private isRedisAvailable = false

  constructor() {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (redisUrl && redisToken) {
      try {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken,
        })
        this.isRedisAvailable = true
        // eslint-disable-next-line no-console -- Important operational info about Redis configuration
        console.info('[RedisRateLimiter] Redis configured for rate limiting')
      } catch (error) {
        console.error('[RedisRateLimiter] Failed to initialize Redis:', error)
        this.isRedisAvailable = false
      }
    } else {
      console.warn(
        '[RedisRateLimiter] Redis not configured. Falling back to in-memory rate limiting. ' +
          'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.'
      )
    }
  }

  /**
   * Generate a spoof-resistant client identifier
   * Uses CF-Connecting-IP when available (Cloudflare), fallback to other headers
   * Includes HMAC of user-agent to make spoofing harder
   */
  private generateClientId(request: Request): string {
    // Prefer CF-Connecting-IP (Cloudflare) as it's harder to spoof
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    const xForwardedFor = request.headers.get('x-forwarded-for')
    const xRealIp = request.headers.get('x-real-ip')
    const userAgent = request.headers.get('user-agent') || ''

    // Get the most reliable IP address
    let clientIp =
      cfConnectingIp ||
      xForwardedFor?.split(',')[0].trim() ||
      xRealIp ||
      'unknown'

    // Create HMAC of user-agent to make spoofing more difficult
    const hmacKey = process.env.RATE_LIMIT_HMAC_SECRET

    // In production, require HMAC secret for security
    if (process.env.NODE_ENV === 'production' && !hmacKey) {
      throw new Error(
        'RATE_LIMIT_HMAC_SECRET is required in production for secure rate limiting. ' +
          'Set a random string (minimum 16 characters) to prevent bypass attacks.'
      )
    }

    // Use fallback only in development
    const effectiveKey = hmacKey || 'dev-only-insecure-fallback'
    const userAgentHash = crypto
      .createHmac('sha256', effectiveKey)
      .update(userAgent)
      .digest('hex')
      .substring(0, 8) // First 8 chars for brevity

    return `${clientIp}:${userAgentHash}`
  }

  /**
   * Check if request is within rate limit
   */
  async checkRateLimit(
    request: Request,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    if (!config.enabled) {
      return {
        allowed: true,
        remaining: config.requestsPerHour,
        resetAt: new Date(Date.now() + 60 * 60 * 1000),
      }
    }

    const clientId = this.generateClientId(request)
    const now = Date.now()
    const windowMs = config.windowSizeMs || 60 * 60 * 1000 // 1 hour default
    const resetTime = now + windowMs

    try {
      let entry: RateLimitEntry | null

      if (this.isRedisAvailable && this.redis) {
        // Use Redis for persistent rate limiting
        entry = await this.getFromRedis(clientId)
      } else {
        // Fallback to in-memory for development
        entry = this.getFromMemory(clientId)
      }

      // Clean up expired entry
      if (entry && now > entry.resetTime) {
        await this.deleteEntry(clientId)
        entry = null
      }

      if (!entry) {
        // First request from this client
        const newEntry: RateLimitEntry = {
          count: 1,
          resetTime,
        }
        await this.setEntry(clientId, newEntry, windowMs)

        return {
          allowed: true,
          remaining: config.requestsPerHour - 1,
          resetAt: new Date(resetTime),
        }
      }

      // Check if limit exceeded
      if (entry.count >= config.requestsPerHour) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(entry.resetTime),
          retryAfter,
        }
      }

      // Increment count
      entry.count += 1
      await this.setEntry(clientId, entry, windowMs)

      return {
        allowed: true,
        remaining: config.requestsPerHour - entry.count,
        resetAt: new Date(entry.resetTime),
      }
    } catch (error) {
      console.error('[RedisRateLimiter] Error checking rate limit:', error)

      // On error, allow the request but log for monitoring
      return {
        allowed: true,
        remaining: config.requestsPerHour,
        resetAt: new Date(resetTime),
      }
    }
  }

  private async getFromRedis(clientId: string): Promise<RateLimitEntry | null> {
    if (!this.redis) return null

    try {
      const data = await this.redis.get<RateLimitEntry>(`rate:${clientId}`)
      return data
    } catch (error) {
      console.error('[RedisRateLimiter] Error getting from Redis:', error)
      return null
    }
  }

  private getFromMemory(clientId: string): RateLimitEntry | null {
    return this.fallbackStore.get(clientId) || null
  }

  private async setEntry(
    clientId: string,
    entry: RateLimitEntry,
    ttlMs: number
  ): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.set(`rate:${clientId}`, entry, {
          ex: Math.ceil(ttlMs / 1000),
        })
      } catch (error) {
        console.error('[RedisRateLimiter] Error setting in Redis:', error)
        // Fallback to memory
        this.fallbackStore.set(clientId, entry)
      }
    } else {
      this.fallbackStore.set(clientId, entry)
    }
  }

  private async deleteEntry(clientId: string): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.del(`rate:${clientId}`)
      } catch (error) {
        console.error('[RedisRateLimiter] Error deleting from Redis:', error)
      }
    }
    this.fallbackStore.delete(clientId)
  }

  /**
   * Health check for rate limiter
   */
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

  /**
   * Clear all rate limit entries (for testing/maintenance)
   */
  async clear(): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const keys = await this.redis.keys('rate:*')
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      } catch (error) {
        console.error('[RedisRateLimiter] Error clearing Redis entries:', error)
      }
    }
    this.fallbackStore.clear()
  }
}

// Export singleton instance
export const rateLimiter = new RedisRateLimiter()
