import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock the cache module - must be before any imports that use it
vi.mock('@/lib/cache/redis', () => ({
  cache: {
    isAvailable: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
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
      mockCache.isAvailable.mockReturnValue(true)
      mockCache.set.mockResolvedValue(true)
      mockCache.get.mockResolvedValue('ping')
      process.env.KEYWORD_API_PROVIDER = 'mock'

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.checks.redis.healthy).toBe(true)
      expect(data.checks.redis.responseTime).toBeTypeOf('number')
    })

    it('returns unhealthy when Redis is not available', async () => {
      // Setup: Mock Redis as not available
      mockCache.isAvailable.mockReturnValue(false)
      process.env.KEYWORD_API_PROVIDER = 'mock'
      process.env.PRIVACY_MODE = 'true'

      const response = await GET()
      const data = await response.json()

      expect(data.checks.redis.healthy).toBe(false)
      expect(data.checks.redis.error).toContain(
        'Redis not configured or privacy mode enabled'
      )
      expect(data.checks.redis.details.privacyMode).toBe(true)
    })

    it('handles Redis connection errors gracefully', async () => {
      // Setup: Mock Redis connection failure
      mockCache.isAvailable.mockReturnValue(true)
      mockCache.set.mockRejectedValue(new Error('Connection timeout'))
      process.env.KEYWORD_API_PROVIDER = 'mock'

      const response = await GET()
      const data = await response.json()

      expect(data.checks.redis.healthy).toBe(false)
      expect(data.checks.redis.error).toBe('Connection timeout')
    })
  })

  describe('Provider health check', () => {
    it('returns healthy for mock provider', async () => {
      mockCache.isAvailable.mockReturnValue(true)
      mockCache.set.mockResolvedValue(true)
      mockCache.get.mockResolvedValue('ping')
      process.env.KEYWORD_API_PROVIDER = 'mock'

      const response = await GET()
      const data = await response.json()

      expect(data.checks.provider.healthy).toBe(true)
      expect(data.checks.provider.details.provider).toBe('mock')
      expect(data.checks.provider.details.note).toContain(
        'Mock provider active'
      )
    })

    it('returns unhealthy when no provider is configured', async () => {
      mockCache.isAvailable.mockReturnValue(true)
      mockCache.set.mockResolvedValue(true)
      mockCache.get.mockResolvedValue('ping')
      delete process.env.KEYWORD_API_PROVIDER

      const response = await GET()
      const data = await response.json()

      expect(data.checks.provider.healthy).toBe(false)
      expect(data.checks.provider.error).toBe('No provider configured')
    })

    it('validates Google Ads provider configuration', async () => {
      mockCache.isAvailable.mockReturnValue(true)
      mockCache.set.mockResolvedValue(true)
      mockCache.get.mockResolvedValue('ping')
      process.env.KEYWORD_API_PROVIDER = 'google-ads'
      // Missing required environment variables

      const response = await GET()
      const data = await response.json()

      expect(data.checks.provider.healthy).toBe(false)
      expect(data.checks.provider.error).toContain('not properly configured')
      expect(data.checks.provider.details.requiredVars).toEqual([
        'GOOGLE_ADS_CLIENT_ID',
        'GOOGLE_ADS_CLIENT_SECRET',
        'GOOGLE_ADS_DEVELOPER_TOKEN',
        'GOOGLE_ADS_REFRESH_TOKEN',
        'GOOGLE_ADS_CUSTOMER_ID',
      ])
    })

    it('validates DataForSEO provider configuration', async () => {
      mockCache.isAvailable.mockReturnValue(true)
      mockCache.set.mockResolvedValue(true)
      mockCache.get.mockResolvedValue('ping')
      process.env.KEYWORD_API_PROVIDER = 'dataforseo'
      // Missing required environment variables

      const response = await GET()
      const data = await response.json()

      expect(data.checks.provider.healthy).toBe(false)
      expect(data.checks.provider.details.requiredVars).toEqual([
        'DATAFORSEO_API_LOGIN',
        'DATAFORSEO_API_PASSWORD',
      ])
    })
  })

  describe('Overall health status', () => {
    it('returns healthy when all services are working', async () => {
      mockCache.isAvailable.mockReturnValue(true)
      mockCache.set.mockResolvedValue(true)
      mockCache.get.mockResolvedValue('ping')
      process.env.KEYWORD_API_PROVIDER = 'mock'

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.checks.redis.healthy).toBe(true)
      expect(data.checks.provider.healthy).toBe(true)
    })

    it('returns degraded when some services are working', async () => {
      mockCache.isAvailable.mockReturnValue(false) // Redis down
      process.env.KEYWORD_API_PROVIDER = 'mock' // Provider OK

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(207) // Multi-Status
      expect(data.status).toBe('degraded')
      expect(data.checks.redis.healthy).toBe(false)
      expect(data.checks.provider.healthy).toBe(true)
    })

    it('returns unhealthy when all services are down', async () => {
      mockCache.isAvailable.mockReturnValue(false) // Redis down
      delete process.env.KEYWORD_API_PROVIDER // No provider

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503) // Service Unavailable
      expect(data.status).toBe('unhealthy')
      expect(data.checks.redis.healthy).toBe(false)
      expect(data.checks.provider.healthy).toBe(false)
    })

    it('includes response metadata', async () => {
      mockCache.isAvailable.mockReturnValue(true)
      mockCache.set.mockResolvedValue(true)
      mockCache.get.mockResolvedValue('ping')
      process.env.KEYWORD_API_PROVIDER = 'mock'

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
