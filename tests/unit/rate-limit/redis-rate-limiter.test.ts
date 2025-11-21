import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RedisRateLimiter } from '@/lib/rate-limit/redis-rate-limiter'

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
  keys: vi.fn().mockResolvedValue([]),
}

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(function MockRedis() {
    return mockRedis
  }),
}))

// Mock crypto for consistent testing
vi.mock('crypto', () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'mockedhash'),
      })),
    })),
  },
}))

describe('RedisRateLimiter', () => {
  let rateLimiter: RedisRateLimiter
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()

    // Set up Redis environment
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    process.env.RATE_LIMIT_HMAC_SECRET = 'test-secret'

    rateLimiter = new RedisRateLimiter()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Client ID Generation', () => {
    it('uses CF-Connecting-IP when available', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'x-forwarded-for': '5.6.7.8',
          'x-real-ip': '9.10.11.12',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      // Mock Redis to return null (new client)
      mockRedis.get.mockResolvedValueOnce(null)

      await rateLimiter.checkRateLimit(request, config)

      // Should use CF-Connecting-IP in the key (hash truncated to 8 chars)
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^rate:1\.2\.3\.4:mockedha$/),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('falls back to x-forwarded-for when CF-Connecting-IP not available', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '5.6.7.8, 192.168.1.1',
          'x-real-ip': '9.10.11.12',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }
      mockRedis.get.mockResolvedValueOnce(null)

      await rateLimiter.checkRateLimit(request, config)

      // Should use first IP from x-forwarded-for (hash truncated to 8 chars)
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^rate:5\.6\.7\.8:mockedha$/),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('includes user-agent hash to prevent simple spoofing', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'Chrome/120.0.0.0',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }
      mockRedis.get.mockResolvedValueOnce(null)

      await rateLimiter.checkRateLimit(request, config)

      // Should include HMAC hash of user-agent (truncated to 8 chars)
      expect(mockRedis.set).toHaveBeenCalledWith(
        'rate:1.2.3.4:mockedha',
        expect.any(Object),
        expect.any(Object)
      )
    })
  })

  describe('Rate Limiting Logic', () => {
    it('allows first request from new client', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }
      mockRedis.get.mockResolvedValueOnce(null)

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('tracks subsequent requests correctly', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      // Mock existing entry with 3 requests
      mockRedis.get.mockResolvedValueOnce({
        count: 3,
        resetTime: Date.now() + 60 * 60 * 1000,
      })

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(6) // 10 - 4 (3 existing + 1 current)
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ count: 4 }),
        expect.any(Object)
      )
    })

    it('blocks requests when limit exceeded', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 5, enabled: true }
      const futureTime = Date.now() + 60 * 60 * 1000

      // Mock existing entry at limit
      mockRedis.get.mockResolvedValueOnce({
        count: 5,
        resetTime: futureTime,
      })

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
      expect(mockRedis.set).not.toHaveBeenCalled()
    })

    it('cleans up expired entries', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      // Mock expired entry
      mockRedis.get.mockResolvedValueOnce({
        count: 5,
        resetTime: Date.now() - 1000, // Expired 1 second ago
      })

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9) // Should be treated as new client
      expect(mockRedis.del).toHaveBeenCalled()
    })

    it('bypasses rate limiting when disabled', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: false }

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(10)
      expect(mockRedis.get).not.toHaveBeenCalled()
      expect(mockRedis.set).not.toHaveBeenCalled()
    })
  })

  describe('Redis Persistence', () => {
    it('falls back to memory when Redis fails', async () => {
      // Make Redis fail
      mockRedis.get.mockRejectedValueOnce(new Error('Redis connection failed'))

      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      const result = await rateLimiter.checkRateLimit(request, config)

      // Should still work with fallback
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
    })

    it('survives Redis set failures', async () => {
      mockRedis.get.mockResolvedValueOnce(null)
      mockRedis.set.mockRejectedValueOnce(new Error('Redis set failed'))

      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      const result = await rateLimiter.checkRateLimit(request, config)

      // Should still work despite Redis failure
      expect(result.allowed).toBe(true)
    })
  })

  describe('Health Check', () => {
    it('reports healthy when Redis is working', async () => {
      const isHealthy = await rateLimiter.isHealthy()
      expect(isHealthy).toBe(true)
      expect(mockRedis.ping).toHaveBeenCalled()
    })

    it('reports unhealthy when Redis fails', async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error('Connection failed'))

      const isHealthy = await rateLimiter.isHealthy()
      expect(isHealthy).toBe(false)
    })
  })

  describe('Security Improvements', () => {
    it('prevents header spoofing by including user-agent hash', async () => {
      // Two requests with same IP but different user agents
      const request1 = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'Chrome/120.0.0.0',
        },
      })

      const request2 = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'Firefox/120.0',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      // Mock different responses for different keys
      mockRedis.get.mockResolvedValueOnce(null) // First request
      mockRedis.get.mockResolvedValueOnce(null) // Second request

      await rateLimiter.checkRateLimit(request1, config)
      await rateLimiter.checkRateLimit(request2, config)

      // Both should be treated as separate clients due to different user-agent hashes
      expect(mockRedis.set).toHaveBeenCalledTimes(2)
    })
  })
})
