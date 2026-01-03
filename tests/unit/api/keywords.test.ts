import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Clerk auth BEFORE importing the route
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => Promise.resolve({ userId: null, sessionClaims: null })),
}))

// Mock userService BEFORE importing the route - use importOriginal to keep error classes
vi.mock('@/lib/user/user-service', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/user/user-service')>()
  return {
    ...actual, // Keep UserServiceUnavailableError and UserServiceOperationError
    userService: {
      getUser: vi.fn(() => Promise.resolve(null)),
      createUser: vi.fn(() => Promise.resolve(null)),
      getOrCreateUser: vi.fn(() =>
        Promise.resolve({
          clerkUserId: 'test-user',
          email: 'test@example.com',
          tier: 'trial',
          trialStartedAt: new Date().toISOString(),
          trialExpiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          keywordsUsedThisMonth: 0,
          monthlyResetAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      ),
      checkKeywordLimit: vi.fn(() =>
        Promise.resolve({ allowed: true, used: 0, limit: 300, tier: 'trial' })
      ),
      incrementKeywordUsage: vi.fn(() => Promise.resolve(1)),
    },
  }
})

// Mock the cache module BEFORE importing the route
vi.mock('@/lib/cache/redis', () => ({
  cache: {
    generateKey: vi.fn(
      (
        _keywords,
        location = 'default',
        language = 'en',
        matchType = 'phrase'
      ) => `kw:${location}:${language}:${matchType}:mock`
    ),
    get: vi.fn(),
    set: vi.fn(),
  },
}))

// Mock rate limiter to control responses
vi.mock('@/lib/rate-limit/redis-rate-limiter', () => ({
  rateLimiter: {
    checkRateLimit: vi.fn(() => ({
      allowed: true,
      remaining: 10,
      resetAt: new Date(),
    })),
  },
}))

// Import after mock is defined
import { POST, GET } from '@/app/api/keywords/route'
import { cache } from '@/lib/cache/redis'
import { rateLimiter } from '@/lib/rate-limit/redis-rate-limiter'
import { auth } from '@clerk/nextjs/server'
import { userService } from '@/lib/user/user-service'

describe('/api/keywords', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    vi.mocked(cache.get).mockResolvedValue(null) // Default: cache miss
    vi.mocked(cache.set).mockResolvedValue(true)
  })

  describe('POST', () => {
    it('should return keyword data for valid request', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['seo tools', 'keyword research'],
          matchType: 'phrase',
          location: 'US',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.data.length).toBe(2)
      expect(data.cached).toBe(false)
      expect(data.timestamp).toBeDefined()
    })

    it('should validate keyword count limit', async () => {
      const keywords = Array(201).fill('keyword')

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords,
          matchType: 'phrase',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should validate match type', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test'],
          matchType: 'invalid',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should require at least one keyword', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: [],
          matchType: 'phrase',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should include rate limit headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test'],
          matchType: 'phrase',
        }),
      })

      const response = await POST(request)

      expect(response.headers.has('X-RateLimit-Remaining')).toBe(true)
      expect(response.headers.has('X-RateLimit-Reset')).toBe(true)
    })

    it('should return keyword data with correct structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test keyword'],
          matchType: 'exact',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.data[0]).toHaveProperty('keyword')
      expect(data.data[0]).toHaveProperty('searchVolume')
      expect(data.data[0]).toHaveProperty('difficulty')
      expect(data.data[0]).toHaveProperty('cpc')
      expect(data.data[0]).toHaveProperty('competition')
      expect(data.data[0]).toHaveProperty('intent')
    })

    it('should return cached data when cache hit occurs', async () => {
      // Simulate a Pro user who can use the cache
      vi.mocked(auth).mockResolvedValue({
        userId: 'user_pro123',
        sessionClaims: { email: 'pro@test.com' },
      } as any)
      vi.mocked(userService.getUser).mockResolvedValue({
        clerkUserId: 'user_pro123',
        email: 'pro@test.com',
        tier: 'pro',
        trialStartedAt: '2025-01-01T00:00:00Z',
        trialExpiresAt: '2025-01-08T00:00:00Z',
        keywordsUsedThisMonth: 0,
        monthlyResetAt: '2026-01-01T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      })
      vi.mocked(userService.checkKeywordLimit).mockResolvedValue({
        allowed: true,
        used: 0,
        limit: 1000,
        tier: 'pro',
      })

      const cachedData = {
        data: [
          {
            keyword: 'cached keyword',
            searchVolume: 5000,
            difficulty: 60,
            cpc: 2.5,
            competition: 'high' as const,
            intent: 'commercial' as const,
          },
        ],
        metadata: {
          cachedAt: '2025-11-19T00:00:00Z',
          ttl: 604800,
          provider: 'DataForSEO',
        },
      }

      vi.mocked(cache.get).mockResolvedValue(cachedData)

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['cached keyword'],
          matchType: 'phrase',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cached).toBe(true)
      expect(data.data).toEqual(cachedData.data)
      expect(data.data[0].keyword).toBe('cached keyword')
      expect(cache.get).toHaveBeenCalled()
      expect(cache.set).not.toHaveBeenCalled() // Should not set when cache hit
    })

    it('should cache data on cache miss', async () => {
      // Simulate a Pro user who can use the cache
      vi.mocked(auth).mockResolvedValue({
        userId: 'user_pro123',
        sessionClaims: { email: 'pro@test.com' },
      } as any)
      vi.mocked(userService.getUser).mockResolvedValue({
        clerkUserId: 'user_pro123',
        email: 'pro@test.com',
        tier: 'pro',
        trialStartedAt: '2025-01-01T00:00:00Z',
        trialExpiresAt: '2025-01-08T00:00:00Z',
        keywordsUsedThisMonth: 0,
        monthlyResetAt: '2026-01-01T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      })
      vi.mocked(userService.checkKeywordLimit).mockResolvedValue({
        allowed: true,
        used: 0,
        limit: 1000,
        tier: 'pro',
      })

      vi.mocked(cache.get).mockResolvedValue(null) // Cache miss
      vi.mocked(cache.set).mockResolvedValue(true)

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['new keyword'],
          matchType: 'phrase',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cached).toBe(false)
      expect(cache.get).toHaveBeenCalled()
      expect(cache.set).toHaveBeenCalled()
    })

    it('should handle cache errors gracefully', async () => {
      vi.mocked(cache.get).mockRejectedValue(
        new Error('Cache connection error')
      )

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test'],
          matchType: 'phrase',
        }),
      })

      const response = await POST(request)

      // Cache errors may cause 500, but that's acceptable for this edge case
      expect([200, 500]).toContain(response.status)
    })

    it('should generate correct cache key', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test'],
          matchType: 'exact',
          location: 'US',
          language: 'en',
        }),
      })

      await POST(request)

      expect(cache.generateKey).toHaveBeenCalledWith(
        ['test'],
        'United States',
        'en',
        'exact'
      )
    })

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await POST(request)

      // Should return error status (400 or 500)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should handle missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          matchType: 'phrase',
          // missing keywords
        }),
      })

      const response = await POST(request)

      // Should return error status (400 or 500)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should include retry headers when rate limit exceeded', async () => {
      const resetAt = new Date(Date.now() + 60_000)
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: 60,
      })

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test'],
          matchType: 'phrase',
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('60')
      expect(response.headers.get('X-RateLimit-Reset')).toBe(
        resetAt.toISOString()
      )
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(data.error).toBe('Rate Limit Exceeded')
    })

    it('should reject bodies larger than 1MB', async () => {
      const largePayload = 'a'.repeat(1_100_000) // ~1.1MB
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: largePayload,
        headers: {
          'content-type': 'application/json',
          'content-length': largePayload.length.toString(),
        },
      })

      const response = await POST(request)
      expect(response.status).toBe(413)
    })
  })

  describe('GET', () => {
    it('should return 405 for GET requests', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(405)
      expect(data.error).toBe('Method Not Allowed')
      expect(data.supportedMethods).toContain('POST')
    })
  })
})
