import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RedisCache } from '@/lib/cache/redis'

// Mock the Redis client
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function MockRedis() {
    return {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      keys: vi.fn(),
      flushdb: vi.fn(),
    }
  }),
}))

describe('RedisCache Privacy Mode', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('disables caching when PRIVACY_MODE=true', () => {
    // Set privacy mode to true
    process.env.PRIVACY_MODE = 'true'
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

    const cache = new RedisCache()

    // Cache should not be available when privacy mode is enabled
    expect(cache.isAvailable()).toBe(false)
  })

  it('enables caching when PRIVACY_MODE=false', () => {
    // Set privacy mode to false
    process.env.PRIVACY_MODE = 'false'
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

    const cache = new RedisCache()

    // Cache should be available when privacy mode is disabled
    expect(cache.isAvailable()).toBe(true)
  })

  it('enables caching when PRIVACY_MODE is not set (default caches)', () => {
    // Don't set PRIVACY_MODE (test default behavior)
    delete process.env.PRIVACY_MODE
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

    const cache = new RedisCache()

    // Cache should be available when privacy mode is not set (default is caching on)
    expect(cache.isAvailable()).toBe(true)
  })

  it('returns null for get() when privacy mode is enabled', async () => {
    process.env.PRIVACY_MODE = 'true'
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

    const cache = new RedisCache()
    const result = await cache.get('test-key')

    // Should return null since caching is disabled
    expect(result).toBeNull()
  })

  it('returns false for set() when privacy mode is enabled', async () => {
    process.env.PRIVACY_MODE = 'true'
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

    const cache = new RedisCache()
    const mockKeywordData = [
      {
        keyword: 'test keyword',
        searchVolume: 1000,
        difficulty: 50,
        cpc: 1.25,
        competition: 'medium' as const,
        intent: 'informational' as const,
      },
    ]

    const result = await cache.set('test-key', mockKeywordData, 'test-provider')

    // Should return false since caching is disabled
    expect(result).toBe(false)
  })

  it('initializes with privacy mode when PRIVACY_MODE=true', () => {
    process.env.PRIVACY_MODE = 'true'
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

    const cache = new RedisCache()

    // Privacy mode should disable the cache even with valid credentials
    expect(cache.isAvailable()).toBe(false)
  })
})
