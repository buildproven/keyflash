import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RedisRateLimiter } from '@/lib/rate-limit/redis-rate-limiter'

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
  keys: vi.fn().mockResolvedValue([]),
  // New atomic operations for race-condition-free rate limiting
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
    // Default: key doesn't exist (new rate limit window)
    mockRedis.ttl.mockResolvedValue(-2) // Key doesn't exist
    mockRedis.incr.mockResolvedValue(1) // First increment returns 1
    mockRedis.expire.mockResolvedValue(true) // Expiry set successfully

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
      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/^rate:1\.2\.3\.4:mockedha$/)
      )
    })

    it('falls back to x-forwarded-for when CF-Connecting-IP not available', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '5.6.7.8, 192.168.1.1',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }
      mockRedis.get.mockResolvedValueOnce(null)

      await rateLimiter.checkRateLimit(request, config)

      // Should use first IP from x-forwarded-for (hash truncated to 8 chars)
      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/^rate:5\.6\.7\.8:mockedha$/)
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
      expect(mockRedis.incr).toHaveBeenCalledWith('rate:1.2.3.4:mockedha')
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
      mockRedis.ttl.mockResolvedValueOnce(-2)
      mockRedis.incr.mockResolvedValueOnce(1)
      mockRedis.expire.mockResolvedValueOnce(true)

      await untrustedLimiter.checkRateLimit(request, config)

      expect(mockRedis.incr).toHaveBeenCalledWith('rate:unknown:mockedha')
    })

    it('defaults to trusting proxy headers in production when unset', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      delete process.env.RATE_LIMIT_TRUST_PROXY
      const productionLimiter = new RedisRateLimiter()

      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }
      mockRedis.ttl.mockResolvedValueOnce(-2)
      mockRedis.incr.mockResolvedValueOnce(1)
      mockRedis.expire.mockResolvedValueOnce(true)

      await productionLimiter.checkRateLimit(request, config)

      expect(mockRedis.incr).toHaveBeenCalledWith('rate:1.2.3.4:mockedha')
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
      expect(mockRedis.incr).toHaveBeenCalled()
    })

    it('tracks subsequent requests correctly', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      // Mock existing entry with TTL and 4th request
      mockRedis.ttl.mockResolvedValueOnce(3500) // Key exists with TTL
      mockRedis.incr.mockResolvedValueOnce(4) // 3 existing + 1 current = 4

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(6) // 10 - 4
      expect(mockRedis.incr).toHaveBeenCalled()
    })

    it('blocks requests when limit exceeded', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 5, enabled: true }

      // Mock existing entry with TTL, increment exceeds limit
      mockRedis.ttl.mockResolvedValueOnce(3500) // Key exists with TTL
      mockRedis.incr.mockResolvedValueOnce(6) // Exceeds limit of 5

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
      expect(mockRedis.incr).toHaveBeenCalled()
    })

    it('handles expired entries automatically via TTL', async () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'user-agent': 'test-browser',
        },
      })

      const config = { requestsPerHour: 10, enabled: true }

      // Mock expired key - TTL returns -2 (key doesn't exist)
      mockRedis.ttl.mockResolvedValueOnce(-2) // Key expired/doesn't exist
      mockRedis.incr.mockResolvedValueOnce(1) // First request in new window

      const result = await rateLimiter.checkRateLimit(request, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9) // Should be treated as new client
      expect(mockRedis.incr).toHaveBeenCalled()
      expect(mockRedis.expire).toHaveBeenCalled() // Set new TTL
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

      // Mock new keys for both requests (different user agents = different hashes)
      mockRedis.ttl.mockResolvedValue(-2) // Key doesn't exist for both
      mockRedis.incr.mockResolvedValue(1) // First request for each key

      await rateLimiter.checkRateLimit(request1, config)
      await rateLimiter.checkRateLimit(request2, config)

      // Both should be treated as separate clients due to different user-agent hashes
      expect(mockRedis.incr).toHaveBeenCalledTimes(2)
    })
  })

  describe('Clear Method', () => {
    it('clears all rate limit entries from Redis', async () => {
      mockRedis.keys.mockResolvedValueOnce([
        'rate:1.2.3.4:abc',
        'rate:5.6.7.8:def',
      ])
      mockRedis.del.mockResolvedValueOnce(2)

      await rateLimiter.clear()

      expect(mockRedis.keys).toHaveBeenCalledWith('rate:*')
      expect(mockRedis.del).toHaveBeenCalledWith(
        'rate:1.2.3.4:abc',
        'rate:5.6.7.8:def'
      )
    })

    it('handles empty key list gracefully', async () => {
      mockRedis.keys.mockResolvedValueOnce([])

      await rateLimiter.clear()

      expect(mockRedis.keys).toHaveBeenCalledWith('rate:*')
      expect(mockRedis.del).not.toHaveBeenCalled()
    })

    it('handles Redis clear errors gracefully', async () => {
      mockRedis.keys.mockRejectedValueOnce(new Error('Redis error'))

      // Should not throw
      await expect(rateLimiter.clear()).resolves.toBeUndefined()
    })
  })

  describe('Fail-safe Behavior', () => {
    it('allows requests when fail-safe is open and Redis fails', async () => {
      // Make Redis fail
      mockRedis.ttl.mockRejectedValueOnce(new Error('Redis error'))

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
      // Make Redis fail
      mockRedis.ttl.mockRejectedValueOnce(new Error('Redis error'))

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
