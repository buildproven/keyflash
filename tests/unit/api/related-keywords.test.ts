import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the cache module BEFORE importing the route
vi.mock('@/lib/cache/redis', () => ({
  cache: {
    getRaw: vi.fn(),
    setRaw: vi.fn(),
  },
}))

// Mock rate limiter
vi.mock('@/lib/rate-limit/redis-rate-limiter', () => ({
  rateLimiter: {
    checkRateLimit: vi.fn(() => ({
      allowed: true,
      remaining: 30,
      resetAt: new Date(),
    })),
  },
}))

// Mock the provider factory
vi.mock('@/lib/api/factory', () => ({
  getProvider: vi.fn(() => ({
    name: 'Mock',
    getRelatedKeywords: vi.fn().mockResolvedValue([
      {
        keyword: 'seo tools guide',
        searchVolume: 5000,
        difficulty: 45,
        cpc: 2.5,
        competition: 'medium',
        intent: 'informational',
        relevance: 95,
      },
      {
        keyword: 'best seo tools',
        searchVolume: 8000,
        difficulty: 60,
        cpc: 3.2,
        competition: 'high',
        intent: 'commercial',
        relevance: 90,
      },
    ]),
  })),
}))

// Import after mocks are defined
import { POST, GET } from '@/app/api/keywords/related/route'
import { cache } from '@/lib/cache/redis'
import { rateLimiter } from '@/lib/rate-limit/redis-rate-limiter'
import { getProvider } from '@/lib/api/factory'

describe('/api/keywords/related', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(cache.getRaw).mockResolvedValue(null) // Default: cache miss
    vi.mocked(cache.setRaw).mockResolvedValue(true)
    // Reset rate limiter to allow requests by default
    vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 30,
      resetAt: new Date(),
    })
  })

  describe('POST', () => {
    it('should return related keywords for valid request', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'seo tools',
            location: 'US',
          }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.seedKeyword).toBe('seo tools')
      expect(data.relatedKeywords).toBeDefined()
      expect(Array.isArray(data.relatedKeywords)).toBe(true)
      expect(data.relatedKeywords.length).toBe(2)
      expect(data.cached).toBe(false)
      expect(data.timestamp).toBeDefined()
    })

    it('should return related keywords with correct structure', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'keyword research',
          }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)

      // Check structure of related keywords
      const firstKeyword = data.relatedKeywords[0]
      expect(firstKeyword).toHaveProperty('keyword')
      expect(firstKeyword).toHaveProperty('searchVolume')
      expect(firstKeyword).toHaveProperty('relevance')
      expect(typeof firstKeyword.relevance).toBe('number')
      expect(firstKeyword.relevance).toBeGreaterThanOrEqual(0)
      expect(firstKeyword.relevance).toBeLessThanOrEqual(100)
    })

    it('should use cached data when available', async () => {
      const cachedData = {
        data: [
          {
            keyword: 'cached keyword',
            searchVolume: 1000,
            relevance: 85,
          },
        ],
        metadata: {
          cachedAt: new Date().toISOString(),
          provider: 'Mock',
        },
      }
      vi.mocked(cache.getRaw).mockResolvedValue(cachedData)

      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'seo tools',
          }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cached).toBe(true)
      expect(data.relatedKeywords).toEqual(cachedData.data)
      // Provider should not be called when cache hit
      expect(getProvider).not.toHaveBeenCalled()
    })

    it('should cache results after fetching from provider', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'test keyword',
          }),
        }
      )

      await POST(request)

      expect(cache.setRaw).toHaveBeenCalled()
      const setCall = vi.mocked(cache.setRaw).mock.calls[0]
      expect(setCall[0]).toContain('related:test keyword')
    })

    it('should include rate limit headers', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'seo',
          }),
        }
      )

      const response = await POST(request)

      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined()
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('should return 429 when rate limited', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 3600000),
        retryAfter: 3600,
      })

      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'test',
          }),
        }
      )

      const response = await POST(request)

      expect(response.status).toBe(429)
    })

    it('should validate keyword is required', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      )

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should validate keyword is not empty', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: '',
          }),
        }
      )

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should validate keyword length', async () => {
      const longKeyword = 'a'.repeat(101)

      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: longKeyword,
          }),
        }
      )

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should validate keyword characters', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'test<script>alert(1)</script>',
          }),
        }
      )

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should validate location format', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'test',
            location: 'invalid',
          }),
        }
      )

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should accept valid location codes', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'test',
            location: 'GB',
          }),
        }
      )

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should apply limit when specified', async () => {
      // Mock provider to return many keywords
      vi.mocked(getProvider).mockReturnValue({
        name: 'Mock',
        getKeywordData: vi.fn(),
        getBatchLimit: vi.fn().mockReturnValue(100),
        getRateLimit: vi.fn().mockReturnValue({ requests: 10, window: 3600 }),
        validateConfiguration: vi.fn(),
        getRelatedKeywords: vi.fn().mockResolvedValue(
          Array(20)
            .fill(null)
            .map((_, i) => ({
              keyword: `keyword ${i}`,
              searchVolume: 1000 - i * 50,
              relevance: 100 - i * 5,
            }))
        ),
      } as ReturnType<typeof getProvider>)

      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'test',
            limit: 5,
          }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.relatedKeywords.length).toBe(5)
    })

    it('should cache full results even when limit is applied', async () => {
      const fullResults = Array(10)
        .fill(null)
        .map((_, i) => ({
          keyword: `keyword ${i}`,
          searchVolume: 1000 - i * 10,
          relevance: 100 - i,
        }))

      vi.mocked(getProvider).mockReturnValue({
        name: 'Mock',
        getKeywordData: vi.fn(),
        getBatchLimit: vi.fn().mockReturnValue(100),
        getRateLimit: vi.fn().mockReturnValue({ requests: 10, window: 3600 }),
        validateConfiguration: vi.fn(),
        getRelatedKeywords: vi.fn().mockResolvedValue(fullResults),
      } as ReturnType<typeof getProvider>)

      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: JSON.stringify({
            keyword: 'test',
            limit: 3,
          }),
          headers: {
            'content-type': 'application/json',
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.relatedKeywords.length).toBe(3)
      const cacheCall = vi.mocked(cache.setRaw).mock.calls[0]
      expect((cacheCall[1] as { data: unknown[] }).data.length).toBe(10)
    })

    it('should reject bodies larger than 1MB', async () => {
      const largePayload = 'a'.repeat(1_100_000)
      const request = new NextRequest(
        'http://localhost:3000/api/keywords/related',
        {
          method: 'POST',
          body: largePayload,
          headers: {
            'content-type': 'application/json',
            'content-length': largePayload.length.toString(),
          },
        }
      )

      const response = await POST(request)
      expect(response.status).toBe(413)
    })
  })

  describe('GET', () => {
    it('should return 405 Method Not Allowed', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(405)
      expect(data.error).toBe('Method Not Allowed')
      expect(data.supportedMethods).toContain('POST')
    })
  })
})
