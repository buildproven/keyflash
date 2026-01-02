import { Redis } from '@upstash/redis'
import type { KeywordData } from '@/types/keyword'
import { logger } from '@/lib/utils/logger'
import {
  RedisConnectionError,
  RedisOperationError,
  RedisConfigurationError,
} from './errors'

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
        this.client = new Redis({
          url,
          token,
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
   * Simple hash function for generating consistent cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
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
      const cached = await this.client!.get<CachedKeywordData>(key)
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
      await this.client!.set(key, cacheData, { ex: cacheTTL })
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
   */
  async getRaw<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null
    }

    try {
      const cached = await this.client!.get<T>(key)
      return cached
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
      await this.client!.set(key, data, { ex: cacheTTL })
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
      await this.client!.del(key)
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
      await this.client!.flushdb()
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
      let cursor = '0'
      let totalDeleted = 0
      const keysToDelete: string[] = []

      // Scan in batches to avoid blocking Redis
      do {
        const result = await this.client!.scan(cursor, {
          match: 'kw:*',
          count: 100, // Process 100 keys at a time
        })

        cursor = result[0]
        const keys = result[1]

        if (keys.length > 0) {
          keysToDelete.push(...keys)
        }
      } while (cursor !== '0')

      if (keysToDelete.length === 0) {
        return 0
      }

      // Delete in batches to avoid command size limits
      const batchSize = 100
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize)
        await this.client!.del(...batch)
        totalDeleted += batch.length
      }

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
      const result = await this.client!.ping()
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
