import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock the cache module - must be before any imports that use it
vi.mock('@/lib/cache/redis', () => ({
  cache: {
    isAvailable: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    ping: vi.fn(),
  },
}))

import { GET } from '@/app/api/health/route'
import { cache } from '@/lib/cache/redis'

// Get the mocked cache for type safety
const mockCache = cache as any

describe('/api/health', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment to clean state
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Redis health check', () => {
    it('returns healthy when Redis is available and responsive', async () => {
      // Setup: Mock Redis as available and responsive
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
      process.env.KEYWORD_API_PROVIDER = 'mock'
      mockCache.ping.mockResolvedValue('PONG')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.checks.redis.healthy).toBe(true)
      expect(data.checks.redis.responseTime).toBeTypeOf('number')
    })

    it('returns healthy when privacy mode is enabled', async () => {
      // Setup: Privacy mode enabled (Redis caching disabled by design)
      process.env.KEYWORD_API_PROVIDER = 'mock'
      process.env.PRIVACY_MODE = 'true'

      const response = await GET()
      const data = await response.json()

      // Privacy mode is expected behavior, so Redis check is healthy
      expect(data.checks.redis.healthy).toBe(true)
      expect(data.checks.redis.details.privacyMode).toBe(true)
      expect(data.checks.redis.details.status).toBe(
        'disabled for privacy compliance'
      )
    })

    it('handles Redis connection errors gracefully', async () => {
      // Setup: Mock Redis connection failure
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
      process.env.KEYWORD_API_PROVIDER = 'mock'
      mockCache.ping.mockRejectedValue(new Error('Connection timeout'))

      const response = await GET()
      const data = await response.json()

      expect(data.checks.redis.healthy).toBe(false)
      expect(data.checks.redis.error).toBe('Connection timeout')
    })
  })

  describe('Provider health check', () => {
    it('returns healthy for mock provider', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
      process.env.KEYWORD_API_PROVIDER = 'mock'
      mockCache.ping.mockResolvedValue('PONG')

      const response = await GET()
      const data = await response.json()

      expect(data.checks.provider.healthy).toBe(true)
      expect(data.checks.provider.details.provider).toBe('mock')
      expect(data.checks.provider.details.note).toContain(
        'Mock provider active'
      )
    })

    it('returns healthy with mock provider when no provider is configured', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
      mockCache.ping.mockResolvedValue('PONG')
      delete process.env.KEYWORD_API_PROVIDER

      const response = await GET()
      const data = await response.json()

      expect(data.checks.provider.healthy).toBe(true)
      expect(data.checks.provider.details.note).toBe(
        'Mock provider active - for development/testing only'
      )
      expect(data.checks.provider.details.provider).toBe('mock')
    })

    it('validates Google Ads provider configuration', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
      mockCache.ping.mockResolvedValue('PONG')
      process.env.KEYWORD_API_PROVIDER = 'google-ads'
      // Missing required environment variables

      const response = await GET()
      const data = await response.json()

      expect(data.checks.provider.healthy).toBe(false)
      expect(data.checks.provider.error).toContain('not properly configured')
      expect(data.checks.provider.details.configError).toContain(
        'missing configuration'
      )
      expect(data.checks.provider.details.provider).toBe('google-ads')
    })

    it('validates DataForSEO provider configuration', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
      mockCache.ping.mockResolvedValue('PONG')
      process.env.KEYWORD_API_PROVIDER = 'dataforseo'
      // Missing required environment variables

      const response = await GET()
      const data = await response.json()

      expect(data.checks.provider.healthy).toBe(false)
      expect(data.checks.provider.details.configError).toContain(
        'missing configuration'
      )
      expect(data.checks.provider.details.provider).toBe('dataforseo')
    })
  })

  describe('Overall health status', () => {
    it('returns healthy when all services are working', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
      process.env.KEYWORD_API_PROVIDER = 'mock'
      mockCache.ping.mockResolvedValue('PONG')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.checks.redis.healthy).toBe(true)
      expect(data.checks.provider.healthy).toBe(true)
    })

    it('returns degraded when some services are working', async () => {
      // Redis not configured, but provider OK
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      process.env.KEYWORD_API_PROVIDER = 'mock'

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(207) // Multi-Status
      expect(data.status).toBe('degraded')
      expect(data.checks.redis.healthy).toBe(false)
      expect(data.checks.provider.healthy).toBe(true)
    })

    it('returns partial health when only redis is down', async () => {
      // Redis not configured but mock provider is available
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      delete process.env.KEYWORD_API_PROVIDER // Defaults to mock

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(207) // Multi-status (partial health)
      expect(data.status).toBe('degraded')
      expect(data.checks.redis.healthy).toBe(false)
      expect(data.checks.provider.healthy).toBe(true) // Mock provider
    })

    it('includes response metadata', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
      process.env.KEYWORD_API_PROVIDER = 'mock'
      mockCache.ping.mockResolvedValue('PONG')

      const response = await GET()
      const data = await response.json()

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(data.version).toBeDefined()
      expect(data.environment).toBeDefined()
      expect(data.responseTime).toBeTypeOf('number')
      expect(data.responseTime).toBeGreaterThanOrEqual(0)
    })
  })
})
