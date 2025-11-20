import { Redis } from '@upstash/redis';
import type { KeywordData } from '@/types/keyword';

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
  url?: string;
  token?: string;
  ttl?: number; // Default TTL in seconds
}

export interface CacheMetadata {
  cachedAt: string;
  ttl: number;
  provider: string;
}

export interface CachedKeywordData {
  data: KeywordData[];
  metadata: CacheMetadata;
}

class RedisCache {
  private client: Redis | null = null;
  private isConfigured = false;
  private defaultTTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(config?: CacheConfig) {
    const url = config?.url || process.env.UPSTASH_REDIS_REST_URL;
    const token = config?.token || process.env.UPSTASH_REDIS_REST_TOKEN;
    const ttl = config?.ttl || this.defaultTTL;

    if (url && token) {
      try {
        this.client = new Redis({
          url,
          token,
        });
        this.isConfigured = true;
        this.defaultTTL = ttl;
      } catch (error) {
        console.error('[RedisCache] Failed to initialize Redis client:', error);
        this.isConfigured = false;
      }
    } else {
      console.warn(
        '[RedisCache] Redis not configured. Cache operations will be skipped. ' +
          'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable caching.'
      );
    }
  }

  /**
   * Check if Redis cache is properly configured and available
   */
  isAvailable(): boolean {
    return this.isConfigured && this.client !== null;
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
    const sortedKeywords = [...keywords].sort();
    const keywordHash = this.simpleHash(sortedKeywords.join(','));

    return `kw:${location}:${language}:${matchType}:${keywordHash}`;
  }

  /**
   * Simple hash function for generating consistent cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached keyword data
   * @returns Cached data or null if not found/cache unavailable
   */
  async get(key: string): Promise<CachedKeywordData | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const cached = await this.client!.get<CachedKeywordData>(key);
      return cached;
    } catch (error) {
      console.error('[RedisCache] Failed to get from cache:', error);
      return null;
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
      return false;
    }

    const cacheTTL = ttl || this.defaultTTL;

    const cacheData: CachedKeywordData = {
      data,
      metadata: {
        cachedAt: new Date().toISOString(),
        ttl: cacheTTL,
        provider,
      },
    };

    try {
      await this.client!.set(key, cacheData, { ex: cacheTTL });
      return true;
    } catch (error) {
      console.error('[RedisCache] Failed to set cache:', error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      console.error('[RedisCache] Failed to delete from cache:', error);
      return false;
    }
  }

  /**
   * Flush all cached data (use with caution!)
   */
  async flush(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.flushdb();
      return true;
    } catch (error) {
      console.error('[RedisCache] Failed to flush cache:', error);
      return false;
    }
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('[RedisCache] Ping failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cache = new RedisCache();

// Export class for testing with custom config
export { RedisCache };
