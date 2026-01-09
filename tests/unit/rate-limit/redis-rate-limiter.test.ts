import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RedisRateLimiter } from '@/lib/rate-limit/redis-rate-limiter'

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
  keys: vi.fn().mockResolvedValue([]),
  scan: vi.fn().mockResolvedValue(['0', []]), // [cursor, keys]
  // PERF-013: Lua script for atomic rate limiting
  // Returns: [newCount, ttlSeconds]
  eval: vi.fn(),
  // Legacy methods (kept for backwards compatibility in other tests)
  ttl: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
}

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function MockRedis() {
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
    process.env.RATE_LIMIT_TRUST_PROXY = 'true'

    // Set up default mock behaviors for atomic operations
    // PERF-013: Lua script returns [newCount, ttlSeconds]
    // Default: first request in new window
    mockRedis.eval.mockResolvedValue([1, 3600]) // New window, count=1, TTL=1 hour

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

      await rateLimiter.checkRateLimit(request, config)

      // PERF-013: Lua script is called with key via eval
      expect(mockRedis.eval).toHaveBeenCalled()
      const evalCall = mockRedis.eval.mock.calls[0]
      // evalCall[1] is the keys array, evalCall[1][0] is the first key
      expect(evalCall[1][0]).toMatch(/^rate:1\.2\.3\.4:mockedha$/)
    })

    it('falls back to x-forwarded-for when CF-Connecting-IP not available', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '5.6.7.8, 192.168.1.1',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      await rateLimiter.checkRateLimit(request, config)

      // PERF-013: Lua script is called with key via eval
      expect(mockRedis.eval).toHaveBeenCalled()
      const evalCall = mockRedis.eval.mock.calls[0]
      expect(evalCall[1][0]).toMatch(/^rate:5\.6\.7\.8:mockedha$/)
    })

    it('includes user-agent hash to prevent simple spoofing', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'Chrome/120.0.0.0',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      await rateLimiter.checkRateLimit(request, config)

      // PERF-013: Lua script is called with key via eval
      expect(mockRedis.eval).toHaveBeenCalled()
      const evalCall = mockRedis.eval.mock.calls[0]
      expect(evalCall[1][0]).toBe('rate:1.2.3.4:mockedha')
    })

    it('falls back to unknown when proxy trust is disabled', async () => {
      process.env.RATE_LIMIT_TRUST_PROXY = 'false'
      const untrustedLimiter = new RedisRateLimiter()
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      await untrustedLimiter.checkRateLimit(request, config)

      // PERF-013: Lua script is called with key via eval
      expect(mockRedis.eval).toHaveBeenCalled()
      const evalCall = mockRedis.eval.mock.calls[0]
      expect(evalCall[1][0]).toBe('rate:unknown:mockedha')
    })

    it('defaults to trusting proxy headers in production when unset', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      delete process.env.RATE_LIMIT_TRUST_PROXY
      // Production requires 32+ character HMAC secret
      process.env.RATE_LIMIT_HMAC_SECRET =
        'test-production-hmac-secret-at-least-32-characters-long'
      const productionLimiter = new RedisRateLimiter()

      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      await productionLimiter.checkRateLimit(request, config)

      // PERF-013: Lua script is called with key via eval
      expect(mockRedis.eval).toHaveBeenCalled()
      const evalCall = mockRedis.eval.mock.calls[0]
      expect(evalCall[1][0]).toBe('rate:1.2.3.4:mockedha')
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
      // PERF-013: Lua script returns [newCount, ttlSeconds]
      // For first request, count=1, TTL=3600 (1 hour)
      mockRedis.eval.mockResolvedValueOnce([1, 3600])

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
      expect(mockRedis.eval).toHaveBeenCalled()
    })

    it('tracks subsequent requests correctly', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      // PERF-013: Lua script returns [newCount, ttlSeconds]
      // 4th request in window, 3500s TTL remaining
      mockRedis.eval.mockResolvedValueOnce([4, 3500])

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(6) // 10 - 4
      expect(mockRedis.eval).toHaveBeenCalled()
    })

    it('blocks requests when limit exceeded', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 5, enabled: true }

      // PERF-013: Lua script returns [newCount, ttlSeconds]
      // 6th request exceeds limit of 5
      mockRedis.eval.mockResolvedValueOnce([6, 3500])

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
      expect(mockRedis.eval).toHaveBeenCalled()
    })

    it('handles expired entries automatically via TTL', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      // PERF-013: Lua script handles expiry internally
      // Returns count=1 (first in new window), TTL=3600 (freshly set)
      mockRedis.eval.mockResolvedValueOnce([1, 3600])

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9) // Should be treated as new client
      expect(mockRedis.eval).toHaveBeenCalled()
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

      // PERF-013: Lua script returns [newCount, ttlSeconds]
      mockRedis.eval.mockResolvedValue([1, 3600])

      await rateLimiter.checkRateLimit(request1, config)
      await rateLimiter.checkRateLimit(request2, config)

      // Both should be treated as separate clients due to different user-agent hashes
      expect(mockRedis.eval).toHaveBeenCalledTimes(2)
    })
  })

  describe('Clear Method', () => {
    it('clears all rate limit entries from Redis using SCAN', async () => {
      // First scan returns keys, second scan returns cursor '0' to end
      mockRedis.scan
        .mockResolvedValueOnce(['1', ['rate:1.2.3.4:abc', 'rate:5.6.7.8:def']])
        .mockResolvedValueOnce(['0', []])
      mockRedis.del.mockResolvedValueOnce(2)

      await rateLimiter.clear()

      expect(mockRedis.scan).toHaveBeenCalledWith('0', {
        match: 'rate:*',
        count: 100,
      })
      expect(mockRedis.del).toHaveBeenCalledWith(
        'rate:1.2.3.4:abc',
        'rate:5.6.7.8:def'
      )
    })

    it('handles empty key list gracefully', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []])

      await rateLimiter.clear()

      expect(mockRedis.scan).toHaveBeenCalledWith('0', {
        match: 'rate:*',
        count: 100,
      })
      expect(mockRedis.del).not.toHaveBeenCalled()
    })

    it('handles Redis clear errors gracefully', async () => {
      mockRedis.scan.mockRejectedValueOnce(new Error('Redis error'))

      // Should not throw
      await expect(rateLimiter.clear()).resolves.toBeUndefined()
    })
  })

  describe('Fail-safe Behavior', () => {
    it('allows requests when fail-safe is open and Redis fails', async () => {
      // PERF-013: Make Redis eval fail
      mockRedis.eval.mockRejectedValueOnce(new Error('Redis error'))

      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = {
        requestsPerHour: 10,
        enabled: true,
        failSafe: 'open' as const,
      }

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(10)
    })

    it('blocks requests when fail-safe is closed and Redis fails', async () => {
      // PERF-013: Make Redis eval fail
      mockRedis.eval.mockRejectedValueOnce(new Error('Redis error'))

      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = {
        requestsPerHour: 10,
        enabled: true,
        failSafe: 'closed' as const,
      }

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBe(60)
    })
  })

  describe('Health Check without Redis', () => {
    it('returns true for memory fallback mode', async () => {
      // Create limiter without Redis
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      const memoryLimiter = new RedisRateLimiter()

      const isHealthy = await memoryLimiter.isHealthy()
      expect(isHealthy).toBe(true)
    })

    it('returns false when Redis ping does not return PONG', async () => {
      mockRedis.ping.mockResolvedValueOnce('ERROR')

      const isHealthy = await rateLimiter.isHealthy()
      expect(isHealthy).toBe(false)
    })
  })

  describe('In-Memory Fallback', () => {
    let memoryLimiter: RedisRateLimiter

    beforeEach(() => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      memoryLimiter = new RedisRateLimiter()
    })

    it('allows first request from new client', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      const result = await memoryLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
    })

    it('tracks multiple requests from same client', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 3, enabled: true }

      // First request
      let result = await memoryLimiter.checkRateLimit(request, config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)

      // Second request
      result = await memoryLimiter.checkRateLimit(request, config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1)

      // Third request
      result = await memoryLimiter.checkRateLimit(request, config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(0)

      // Fourth request - should be blocked
      result = await memoryLimiter.checkRateLimit(request, config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('clears memory store', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 1, enabled: true }

      // Make a request to populate memory store
      await memoryLimiter.checkRateLimit(request, config)

      // Clear the store
      await memoryLimiter.clear()

      // Next request should be allowed as if new client
      const result = await memoryLimiter.checkRateLimit(request, config)
      expect(result.allowed).toBe(true)
    })
  })
})
