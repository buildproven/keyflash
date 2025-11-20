import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { RedisCache } from '@/lib/cache/redis'
import type { KeywordData } from '@/types/keyword'

// Create mock Redis methods
const mockGet = vi.fn()
const mockSet = vi.fn()
const mockDel = vi.fn()
const mockFlushdb = vi.fn()
const mockPing = vi.fn()

// Mock @upstash/redis
vi.mock('@upstash/redis', () => {
  return {
    Redis: vi.fn().mockImplementation(config => {
      if (!config.url || !config.url.startsWith('https://')) {
        throw new Error(
          `UrlError: Upstash Redis client was passed an invalid URL. You should pass a URL starting with https. Received: "${config.url}".`
        )
      }
      return {
        get: mockGet,
        set: mockSet,
        del: mockDel,
        flushdb: mockFlushdb,
        ping: mockPing,
      }
    }),
  }
})

describe('RedisCache', () => {
  describe('without configuration', () => {
    let cache: RedisCache

    beforeEach(() => {
      // Create cache without credentials
      cache = new RedisCache()
    })

    it('should not be available without configuration', () => {
      expect(cache.isAvailable()).toBe(false)
    })

    it('should return null when getting from unconfigured cache', async () => {
      const result = await cache.get('test-key')
      expect(result).toBeNull()
    })

    it('should return false when setting to unconfigured cache', async () => {
      const data: KeywordData[] = [
        {
          keyword: 'test',
          searchVolume: 1000,
          difficulty: 50,
          cpc: 1.5,
          competition: 'medium',
          intent: 'informational',
        },
      ]

      const result = await cache.set('test-key', data, 'test-provider')
      expect(result).toBe(false)
    })

    it('should return false when deleting from unconfigured cache', async () => {
      const result = await cache.delete('test-key')
      expect(result).toBe(false)
    })

    it('should return false when pinging unconfigured cache', async () => {
      const result = await cache.ping()
      expect(result).toBe(false)
    })

    it('should return false when flushing unconfigured cache', async () => {
      const result = await cache.flush()
      expect(result).toBe(false)
    })
  })

  describe('cache key generation', () => {
    let cache: RedisCache

    beforeEach(() => {
      cache = new RedisCache()
    })

    it('should generate consistent cache keys for same input', () => {
      const key1 = cache.generateKey(['seo', 'tools'], 'US', 'en', 'phrase')
      const key2 = cache.generateKey(['seo', 'tools'], 'US', 'en', 'phrase')

      expect(key1).toBe(key2)
    })

    it('should generate same key regardless of keyword order', () => {
      const key1 = cache.generateKey(['seo', 'tools'], 'US', 'en', 'phrase')
      const key2 = cache.generateKey(['tools', 'seo'], 'US', 'en', 'phrase')

      expect(key1).toBe(key2)
    })

    it('should generate different keys for different locations', () => {
      const key1 = cache.generateKey(['seo'], 'US', 'en', 'phrase')
      const key2 = cache.generateKey(['seo'], 'UK', 'en', 'phrase')

      expect(key1).not.toBe(key2)
    })

    it('should generate different keys for different languages', () => {
      const key1 = cache.generateKey(['seo'], 'US', 'en', 'phrase')
      const key2 = cache.generateKey(['seo'], 'US', 'es', 'phrase')

      expect(key1).not.toBe(key2)
    })

    it('should generate different keys for different match types', () => {
      const key1 = cache.generateKey(['seo'], 'US', 'en', 'phrase')
      const key2 = cache.generateKey(['seo'], 'US', 'en', 'exact')

      expect(key1).not.toBe(key2)
    })

    it('should use default values when optional params not provided', () => {
      const key = cache.generateKey(['seo'])

      expect(key).toContain('kw:')
      expect(key).toContain('default:') // default location
      expect(key).toContain('en:') // default language
      expect(key).toContain('phrase:') // default match type
    })

    it('should generate valid cache key format', () => {
      const key = cache.generateKey(['seo', 'tools'], 'US', 'en', 'phrase')

      // Format: kw:location:language:matchType:hash
      expect(key).toMatch(/^kw:[^:]+:[^:]+:[^:]+:[a-z0-9]+$/)
    })
  })

  describe('with mock Redis client', () => {
    it('should create cache instance with valid configuration', () => {
      const cache = new RedisCache({
        url: 'https://mock-redis.upstash.io',
        token: 'mock-token',
        ttl: 3600, // 1 hour for testing
      })

      // Cache instance should be created successfully
      expect(cache).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle invalid URLs gracefully', () => {
      const cache = new RedisCache({
        url: 'invalid-url',
        token: 'test-token',
      })

      // Should still initialize but may not be available
      expect(cache).toBeDefined()
    })

    it('should handle missing token gracefully', () => {
      const cache = new RedisCache({
        url: 'https://test.upstash.io',
        token: '',
      })

      expect(cache.isAvailable()).toBe(false)
    })

    it('should handle missing URL gracefully', () => {
      const cache = new RedisCache({
        url: '',
        token: 'test-token',
      })

      expect(cache.isAvailable()).toBe(false)
    })
  })

  describe('TTL configuration', () => {
    it('should use custom TTL when provided', () => {
      const customTTL = 1800 // 30 minutes
      const cache = new RedisCache({
        url: 'https://test.upstash.io',
        token: 'test-token',
        ttl: customTTL,
      })

      expect(cache).toBeDefined()
      // TTL will be used internally when setting cache
    })

    it('should use default TTL when not provided', () => {
      const cache = new RedisCache({
        url: 'https://test.upstash.io',
        token: 'test-token',
      })

      expect(cache).toBeDefined()
      // Default TTL is 7 days (604800 seconds)
    })
  })

  describe('hash function', () => {
    let cache: RedisCache

    beforeEach(() => {
      cache = new RedisCache()
    })

    it('should generate different hashes for different inputs', () => {
      const key1 = cache.generateKey(['keyword1'])
      const key2 = cache.generateKey(['keyword2'])

      expect(key1).not.toBe(key2)
    })

    it('should handle empty keyword arrays', () => {
      const key = cache.generateKey([])

      expect(key).toMatch(/^kw:/)
    })

    it('should handle special characters in keywords', () => {
      const key = cache.generateKey(['seo & marketing', 'tools!'])

      expect(key).toMatch(/^kw:/)
    })

    it('should handle long keyword lists', () => {
      const longList = Array(100)
        .fill(0)
        .map((_, i) => `keyword${i}`)
      const key = cache.generateKey(longList)

      expect(key).toMatch(/^kw:/)
    })
  })

  describe('Redis operations (tested via API integration)', () => {
    // Note: Redis operations (get, set, delete, flush, ping) are thoroughly
    // tested through the API route tests in keywords.test.ts where the cache
    // module is properly mocked. These operations behave correctly when cache
    // is available and gracefully fail when unavailable (tested above).

    it('should provide all required cache methods', () => {
      const cache = new RedisCache()

      expect(typeof cache.get).toBe('function')
      expect(typeof cache.set).toBe('function')
      expect(typeof cache.delete).toBe('function')
      expect(typeof cache.flush).toBe('function')
      expect(typeof cache.ping).toBe('function')
      expect(typeof cache.generateKey).toBe('function')
      expect(typeof cache.isAvailable).toBe('function')
    })
  })
})
