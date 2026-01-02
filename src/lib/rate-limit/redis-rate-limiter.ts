import { Redis } from '@upstash/redis'
import crypto from 'crypto'
import { logger } from '@/lib/utils/logger'

/**
 * Redis-based rate limiter with spoof-resistant client identification
 * Replaces the vulnerable in-memory implementation
 */

export interface RateLimitConfig {
  requestsPerHour: number
  enabled: boolean
  windowSizeMs?: number
  failSafe?: 'open' | 'closed' // How to handle Redis failures - defaults to 'closed' in production
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
  private isProduction = process.env.NODE_ENV === 'production'
  private trustProxy =
    process.env.RATE_LIMIT_TRUST_PROXY === 'true' ||
    (process.env.RATE_LIMIT_TRUST_PROXY !== 'false' && this.isProduction)
  // Keep a typed error helper for attaching HTTP-friendly metadata
  private createConfigError(
    message: string,
    status = 500
  ): Error & {
    status?: number
  } {
    const err: Error & { status?: number } = new Error(message)
    err.status = status
    return err
  }

  constructor() {
    // Fail-fast validation for production
    if (this.isProduction) {
      // Validate HMAC secret for spoof-resistant client identification
      const hmacSecret = process.env.RATE_LIMIT_HMAC_SECRET
      if (!hmacSecret) {
        throw this.createConfigError(
          'RATE_LIMIT_HMAC_SECRET is required in production for secure rate limiting',
          500
        )
      }
      if (hmacSecret.length < 32) {
        throw this.createConfigError(
          'RATE_LIMIT_HMAC_SECRET must be at least 32 characters for security',
          500
        )
      }
    }

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (redisUrl && redisToken) {
      try {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken,
        })
        this.isRedisAvailable = true
        logger.info('Redis configured for rate limiting', {
          module: 'RedisRateLimiter',
        })
      } catch (error) {
        logger.error('Failed to initialize Redis', error, {
          module: 'RedisRateLimiter',
        })
        this.isRedisAvailable = false

        // In production, Redis failure is critical for rate limiting
        if (this.isProduction) {
          throw this.createConfigError(
            'Failed to initialize Redis for rate limiting in production',
            500
          )
        }
      }
    } else {
      const message =
        'Redis not configured. Falling back to in-memory rate limiting. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.'

      logger.warn(message, { module: 'RedisRateLimiter' })

      // In production, require Redis for distributed rate limiting
      if (this.isProduction) {
        throw this.createConfigError(
          'Redis configuration required in production for distributed rate limiting. ' +
            'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
          500
        )
      }
    }
  }

  /**
   * Generate a spoof-resistant client identifier
   * Uses CF-Connecting-IP when available (Cloudflare), fallback to other headers
   * Includes HMAC of user-agent to make spoofing harder
   */
  private generateClientId(request: Request): string {
    const userAgent = request.headers.get('user-agent') || ''

    const clientIp = this.getTrustedClientIp(request) || 'unknown'

    // Create HMAC of user-agent to make spoofing more difficult
    const hmacKey = process.env.RATE_LIMIT_HMAC_SECRET

    // In production, require HMAC secret for security
    if (this.isProduction && !hmacKey) {
      throw this.createConfigError(
        'RATE_LIMIT_HMAC_SECRET missing in production; rate limiting cannot safely identify clients.'
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

  private getTrustedClientIp(request: Request): string | null {
    if (!this.trustProxy) {
      return null
    }

    const allowPrivate = !this.isProduction
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    const xRealIp = request.headers.get('x-real-ip')
    const xForwardedFor = request.headers.get('x-forwarded-for')

    const candidates = [
      cfConnectingIp?.trim(),
      xRealIp?.trim(),
      xForwardedFor?.split(',')[0]?.trim(),
    ].filter(Boolean) as string[]

    for (const ip of candidates) {
      if (allowPrivate ? this.isValidIP(ip) : this.isValidPublicIP(ip)) {
        return ip
      }
    }

    return null
  }

  private isValidIP(ip: string): boolean {
    if (!ip || ip.length === 0) return false

    const ipv4Parts = ip.split('.')
    if (ipv4Parts.length === 4) {
      const isValidIPv4 = ipv4Parts.every(part => {
        const num = parseInt(part, 10)
        return !isNaN(num) && num >= 0 && num <= 255 && part === String(num)
      })
      if (isValidIPv4) return true
    }

    const ipv6Parts = ip.split(':')
    if (ipv6Parts.length >= 2) {
      const isValidIPv6 = ipv6Parts.every(part => {
        if (part.length === 0) return true
        if (part.length > 4) return false
        return /^[0-9a-fA-F]+$/.test(part)
      })
      if (isValidIPv6) return true
    }

    return false
  }

  private isPrivateIP(ip: string): boolean {
    if (ip === '127.0.0.1' || ip === 'localhost') return true
    if (ip.startsWith('10.')) return true
    if (ip.startsWith('192.168.')) return true
    if (ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return true
    if (ip.startsWith('169.254.')) return true
    if (ip === '0.0.0.0') return true
    if (ip === '::1' || ip === '::') return true
    if (ip.startsWith('fc00:') || ip.startsWith('fd00:')) return true
    if (ip.startsWith('fe80:')) return true
    if (ip.startsWith('::ffff:')) return true
    return false
  }

  private isValidPublicIP(ip: string): boolean {
    if (!this.isValidIP(ip)) return false
    if (this.isPrivateIP(ip)) return false
    return true
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
      if (this.isRedisAvailable && this.redis) {
        // Use atomic Redis operations to prevent race conditions
        return await this.checkRateLimitAtomically(
          clientId,
          config,
          windowMs,
          now,
          resetTime
        )
      } else {
        // Fallback to in-memory for development (single-threaded, so no race condition)
        return await this.checkRateLimitInMemory(
          clientId,
          config,
          windowMs,
          now,
          resetTime
        )
      }
    } catch (error) {
      logger.error('Error checking rate limit', error, {
        module: 'RedisRateLimiter',
      })

      // Determine fail-safe behavior - default to closed in production for security
      const failOpen =
        config.failSafe === 'open' ||
        (config.failSafe === undefined &&
          process.env.NODE_ENV === 'development')

      if (failOpen) {
        // Fail open - allow request but log warning
        logger.warn('Rate limiter failed, allowing request (fail-open mode)', {
          module: 'RedisRateLimiter',
        })
        return {
          allowed: true,
          remaining: config.requestsPerHour,
          resetAt: new Date(resetTime),
        }
      } else {
        // Fail closed - deny request for security
        logger.error(
          'Rate limiter failed, denying request (fail-closed mode)',
          undefined,
          { module: 'RedisRateLimiter' }
        )
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(resetTime),
          retryAfter: 60, // Try again in 60 seconds
        }
      }
    }
  }

  private getFromMemory(clientId: string): RateLimitEntry | null {
    return this.fallbackStore.get(clientId) || null
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
   * Uses SCAN instead of KEYS to avoid blocking Redis with large keyspaces
   */
  async clear(): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        // Use SCAN iterator to avoid blocking Redis with KEYS command
        let cursor = '0'
        do {
          const result: [string, string[]] = await this.redis.scan(cursor, {
            match: 'rate:*',
            count: 100,
          })
          cursor = result[0]
          const keys = result[1]
          if (keys.length > 0) {
            await this.redis.del(...keys)
          }
        } while (cursor !== '0')
      } catch (error) {
        logger.error('Error clearing Redis entries', error, {
          module: 'RedisRateLimiter',
        })
      }
    }
    this.fallbackStore.clear()
  }

  /**
   * Atomic rate limiting using Redis INCR operations to prevent race conditions
   * Uses individual atomic operations since Upstash doesn't support pipeline()
   */
  private async checkRateLimitAtomically(
    clientId: string,
    config: RateLimitConfig,
    windowMs: number,
    now: number,
    resetTime: number
  ): Promise<RateLimitResult> {
    const key = `rate:${clientId}`

    // Get current TTL to check if key exists
    const ttl = await this.redis!.ttl(key)

    // If TTL is -2 (key doesn't exist) or -1 (no expiry), it's a new window
    if (ttl <= 0) {
      // First request in window - atomically increment and set expiration
      const newCount = await this.redis!.incr(key)
      if (newCount === 1) {
        // Only set expiration if this is truly the first increment
        await this.redis!.expire(key, Math.ceil(windowMs / 1000))
      }

      return {
        allowed: true,
        remaining: Math.max(0, config.requestsPerHour - newCount),
        resetAt: new Date(resetTime),
      }
    }

    // Key exists with TTL - atomically increment
    const newCount = await this.redis!.incr(key)

    // Check if limit exceeded after increment
    if (newCount > config.requestsPerHour) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(now + ttl * 1000),
        retryAfter: ttl,
      }
    }

    return {
      allowed: true,
      remaining: config.requestsPerHour - newCount,
      resetAt: new Date(now + ttl * 1000),
    }
  }

  /**
   * In-memory rate limiting (for development/fallback)
   */
  private async checkRateLimitInMemory(
    clientId: string,
    config: RateLimitConfig,
    _windowMs: number,
    now: number,
    resetTime: number
  ): Promise<RateLimitResult> {
    let entry = this.getFromMemory(clientId)

    // Clean up expired entry
    if (entry && now > entry.resetTime) {
      this.fallbackStore.delete(clientId)
      entry = null
    }

    if (!entry) {
      // First request from this client
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime,
      }
      this.fallbackStore.set(clientId, newEntry)

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
    this.fallbackStore.set(clientId, entry)

    return {
      allowed: true,
      remaining: config.requestsPerHour - entry.count,
      resetAt: new Date(entry.resetTime),
    }
  }
}

// Export singleton instance
export const rateLimiter = new RedisRateLimiter()
