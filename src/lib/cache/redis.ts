import { Redis } from '@upstash/redis'
import * as https from 'https'
import type { KeywordData } from '@/types/keyword'
import { logger } from '@/lib/utils/logger'
import {
  RedisConnectionError,
  RedisOperationError,
  RedisConfigurationError,
} from './errors'
import * as crypto from 'crypto'

/**
 * Redis Cache Client
 *
 * Environment variables required:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 *
 * If not configured, cache operations will gracefully fail and fall through to API.
 */

export interface CacheConfig {
  url?: string
  token?: string
  ttl?: number // Default TTL in seconds
}

export interface CacheMetadata {
  cachedAt: string
  ttl: number
  provider: string
}

export interface CachedKeywordData {
  data: KeywordData[]
  metadata: CacheMetadata
}

class RedisCache {
  private client: Redis | null = null
  private isConfigured = false
  private privacyMode = false // Default to caching unless explicitly disabled
  private defaultTTL = 7 * 24 * 60 * 60 // 7 days in seconds

  constructor(config?: CacheConfig) {
    const url = config?.url || process.env.UPSTASH_REDIS_REST_URL
    const token = config?.token || process.env.UPSTASH_REDIS_REST_TOKEN
    const ttl = config?.ttl || this.defaultTTL

    // Check privacy mode - defaults to false; set PRIVACY_MODE=true to disable caching
    const privacyEnv = process.env.PRIVACY_MODE
    this.privacyMode = privacyEnv === 'true'

    if (this.privacyMode) {
      logger.info(
        'Privacy mode enabled. Keyword caching is disabled to honor privacy promise.',
        { module: 'RedisCache' }
      )
      return
    }

    if (url && token) {
      try {
        // CODE-001: Enable HTTP keepAlive for connection pooling
        // Improves performance by reusing TCP connections
        this.client = new Redis({
          url,
          token,
          agent: new https.Agent({
            keepAlive: true,
            maxSockets: 50, // Allow up to 50 concurrent connections
          }),
        })
        this.isConfigured = true
        this.defaultTTL = ttl
      } catch (error) {
        const connectionError = new RedisConnectionError(
          'Failed to initialize Redis client'
        )
        logger.error('Failed to initialize Redis client', connectionError, {
          module: 'RedisCache',
          originalError: error,
        })
        this.isConfigured = false
      }
    } else {
      const configError = new RedisConfigurationError(
        'Redis credentials not provided. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
      )
      logger.warn(
        'Redis not configured. Cache operations will be skipped. ' +
          'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable caching.',
        { module: 'RedisCache', error: configError }
      )
    }
  }

  /**
   * Check if Redis cache is properly configured and available
   * Returns false if privacy mode is enabled to disable caching
   */
  isAvailable(): boolean {
    if (this.privacyMode) {
      return false
    }
    return this.isConfigured && this.client !== null
  }

  /**
   * Get Redis client, throwing if unavailable
   * Assumes isAvailable() has already been checked
   * @private
   */
  private getClient(): Redis {
    // This should only be called after isAvailable() check
    return this.client!
  }

  /**
   * Generate cache key for keyword search
   * Format: kw:{location}:{language}:{matchType}:{hash}
   */
  generateKey(
    keywords: string[],
    location: string = 'default',
    language: string = 'en',
    matchType: 'phrase' | 'exact' = 'phrase'
  ): string {
    // Sort keywords for consistent caching regardless of input order
    const sortedKeywords = [...keywords].sort()
    const keywordHash = this.simpleHash(sortedKeywords.join(','))

    return `kw:${location}:${language}:${matchType}:${keywordHash}`
  }

  /**
   * SEC-014 FIX: Cryptographically secure hash for cache keys
   * Prevents collision-based cache poisoning attacks
   * Uses SHA-256 instead of weak 32-bit hash
   */
  private simpleHash(str: string): string {
    return crypto
      .createHash('sha256')
      .update(str)
      .digest('hex')
      .substring(0, 16) // 64 bits of entropy (vs 25 bits from old hash)
  }

  /**
   * Get cached keyword data
   * @returns Cached data or null if not found/cache unavailable
   */
  async get(key: string): Promise<CachedKeywordData | null> {
    if (!this.isAvailable()) {
      return null
    }

    try {
      const client = this.getClient()
      const cached = await client.get<CachedKeywordData>(key)
      return cached
    } catch (error) {
      const opError = new RedisOperationError('Failed to get from cache', 'get')
      logger.error('Failed to get from cache', opError, {
        module: 'RedisCache',
        key,
        originalError: error,
      })
      return null
    }
  }

  /**
   * Set cached keyword data
   * @param key - Cache key
   * @param data - Keyword data to cache
   * @param provider - Provider name for metadata
   * @param ttl - Time to live in seconds (optional, defaults to 7 days)
   */
  async set(
    key: string,
    data: KeywordData[],
    provider: string,
    ttl?: number
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    const cacheTTL = ttl || this.defaultTTL

    const cacheData: CachedKeywordData = {
      data,
      metadata: {
        cachedAt: new Date().toISOString(),
        ttl: cacheTTL,
        provider,
      },
    }

    try {
      const client = this.getClient()
      await client.set(key, cacheData, { ex: cacheTTL })
      return true
    } catch (error) {
      const opError = new RedisOperationError('Failed to set cache', 'set')
      logger.error('Failed to set cache', opError, {
        module: 'RedisCache',
        key,
        originalError: error,
      })
      return false
    }
  }

  /**
   * Get raw cached data (for non-KeywordData types)
   * @param key - Cache key
   * @param validate - Optional validation function to ensure type safety
   */
  async getRaw<T>(
    key: string,
    validate?: (data: unknown) => T
  ): Promise<T | null> {
    if (!this.isAvailable()) {
      return null
    }

    try {
      const client = this.getClient()
      const cached = await client.get<unknown>(key)

      if (!cached) {
        return null
      }

      // If validation function provided, use it to ensure type safety
      if (validate) {
        return validate(cached)
      }

      return cached as T
    } catch (error) {
      const opError = new RedisOperationError(
        'Failed to get raw from cache',
        'getRaw'
      )
      logger.error('Failed to get raw from cache', opError, {
        module: 'RedisCache',
        key,
        originalError: error,
      })
      return null
    }
  }

  /**
   * Set raw cached data (for non-KeywordData types)
   */
  async setRaw<T>(key: string, data: T, ttl?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    const cacheTTL = ttl || this.defaultTTL

    try {
      const client = this.getClient()
      await client.set(key, data, { ex: cacheTTL })
      return true
    } catch (error) {
      const opError = new RedisOperationError(
        'Failed to set raw cache',
        'setRaw'
      )
      logger.error('Failed to set raw cache', opError, {
        module: 'RedisCache',
        key,
        originalError: error,
      })
      return false
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    try {
      const client = this.getClient()
      await client.del(key)
      return true
    } catch (error) {
      const opError = new RedisOperationError(
        'Failed to delete from cache',
        'delete'
      )
      logger.error('Failed to delete from cache', opError, {
        module: 'RedisCache',
        key,
        originalError: error,
      })
      return false
    }
  }

  /**
   * Flush all cached data (use with caution!)
   */
  async flush(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    try {
      const client = this.getClient()
      await client.flushdb()
      return true
    } catch (error) {
      const opError = new RedisOperationError('Failed to flush cache', 'flush')
      logger.error('Failed to flush cache', opError, {
        module: 'RedisCache',
        originalError: error,
      })
      return false
    }
  }

  /**
   * Purge expired cache entries and optionally all keyword cache entries
   * Useful for privacy compliance and maintenance
   * Uses SCAN instead of KEYS to avoid blocking Redis
   */
  async purgeKeywordCache(): Promise<number> {
    if (!this.isAvailable()) {
      return 0
    }

    try {
      const client = this.getClient()
      let cursor = '0'
      let totalDeleted = 0

      // Scan and delete in streaming fashion to avoid OOM with millions of keys
      do {
        const result = await client.scan(cursor, {
          match: 'kw:*',
          count: 100, // Process 100 keys at a time
        })

        cursor = result[0]
        const keys = result[1]

        // Delete keys immediately in this scan iteration (streaming delete)
        if (keys.length > 0) {
          await client.del(...keys)
          totalDeleted += keys.length
        }
      } while (cursor !== '0')

      logger.info(`Purged ${totalDeleted} keyword cache entries`, {
        module: 'RedisCache',
      })
      return totalDeleted
    } catch (error) {
      const opError = new RedisOperationError(
        'Failed to purge keyword cache',
        'purgeKeywordCache'
      )
      logger.error('Failed to purge keyword cache', opError, {
        module: 'RedisCache',
        originalError: error,
      })
      return 0
    }
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    try {
      const client = this.getClient()
      const result = await client.ping()
      return result === 'PONG'
    } catch (error) {
      const opError = new RedisOperationError('Ping failed', 'ping')
      logger.error('Ping failed', opError, {
        module: 'RedisCache',
        originalError: error,
      })
      return false
    }
  }
}

// Export singleton instance
export const cache = new RedisCache()

// Export class for testing with custom config
export { RedisCache }
