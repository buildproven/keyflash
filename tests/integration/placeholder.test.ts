import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Integration Tests - API Routes with Caching and Validation
 *
 * These tests verify that multiple components work together correctly:
 * - API route handlers with validation and caching
 * - Rate limiting middleware with API routes
 * - Error handling across multiple layers
 * - Provider integration with mock data detection
 *
 * Target: 20% of total test coverage (per TESTING_STRATEGY.md)
 */

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

// Mock the rate limiter for integration tests
vi.mock('@/lib/rate-limit/redis-rate-limiter', () => ({
  rateLimiter: {
    checkRateLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: new Date(Date.now() + 3600000),
    }),
  },
}))

// Mock the cache for integration tests
vi.mock('@/lib/cache/redis', () => ({
  cache: {
    generateKey: vi.fn(() => 'test-cache-key'),
    get: vi.fn().mockResolvedValue(null), // Always cache miss for consistent testing
    set: vi.fn().mockResolvedValue(true),
  },
}))

// Import AFTER mocks are defined
import { POST } from '@/app/api/keywords/route'

describe('Keywords API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set mock provider for consistent testing
    process.env.KEYWORD_API_PROVIDER = 'mock'
  })

  describe('POST /api/keywords', () => {
    it('handles complete keyword search flow with validation, provider, and response formatting', async () => {
      const requestBody = {
        keywords: ['SEO tools', 'keyword-research', 'content_marketing'],
        matchType: 'phrase',
        location: 'US',
        language: 'en',
      }

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '192.168.1.100',
          'user-agent': 'Mozilla/5.0 (Test Browser)',
        },
        body: JSON.stringify(requestBody),
      })

      const response = await POST(request)

      // Verify response structure
      expect(response.status).toBe(200)

      const data = await response.json()

      // Verify response contains all required fields
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('cached')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('mockData')
      expect(data).toHaveProperty('provider')

      // Verify data structure
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.data).toHaveLength(3)

      // Verify each keyword result has correct structure
      data.data.forEach((result: any) => {
        expect(result).toHaveProperty('keyword')
        expect(result).toHaveProperty('searchVolume')
        expect(result).toHaveProperty('difficulty')
        expect(result).toHaveProperty('cpc')
        expect(result).toHaveProperty('competition')
        expect(result).toHaveProperty('intent')

        // Verify data types
        expect(typeof result.keyword).toBe('string')
        expect(typeof result.searchVolume).toBe('number')
        expect(typeof result.difficulty).toBe('number')
        expect(typeof result.cpc).toBe('number')
        expect(typeof result.competition).toBe('string')
        expect(typeof result.intent).toBe('string')

        // Verify value ranges
        expect(result.difficulty).toBeGreaterThanOrEqual(0)
        expect(result.difficulty).toBeLessThanOrEqual(100)
        expect(result.cpc).toBeGreaterThanOrEqual(0)
        expect(['low', 'medium', 'high']).toContain(result.competition)
        expect([
          'informational',
          'commercial',
          'transactional',
          'navigational',
        ]).toContain(result.intent)
      })

      // Verify mock data detection
      expect(data.mockData).toBe(true)
      expect(data.provider).toBe('Mock')
      expect(data.cached).toBe(false) // First request should not be cached

      // Verify rate limiting headers
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('9')
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('handles validation errors properly', async () => {
      const invalidRequestBody = {
        keywords: [
          'valid keyword',
          '=DANGEROUS_FORMULA()',
          '<script>alert("xss")</script>',
        ],
        matchType: 'phrase',
        location: 'INVALID', // Should be 2-letter code
        language: 'INVALID', // Should be valid language code
      }

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidRequestBody),
      })

      const response = await POST(request)

      // Should return validation error
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Validation Error')
      expect(data).toHaveProperty('message')
      expect(typeof data.message).toBe('string')

      // Should contain specific validation errors
      expect(data.message).toContain(
        'must contain only letters, numbers, spaces, hyphens'
      )
      expect(data.message).toContain('Location must be one of')
      expect(data.message).toContain('valid language code')
    })

    it('handles malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json{',
      })

      const response = await POST(request)

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.message).toContain('Invalid JSON')
    })

    it('rejects requests with no keywords', async () => {
      const requestBody = {
        keywords: [],
        matchType: 'phrase',
      }

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('Validation Error')
      expect(data.message).toContain('At least one keyword is required')
    })

    it('rejects requests with too many keywords', async () => {
      const tooManyKeywords = Array(201).fill('valid keyword')
      const requestBody = {
        keywords: tooManyKeywords,
        matchType: 'phrase',
      }

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('Validation Error')
      expect(data.message).toContain('Maximum 200 keywords')
    })
  })

  describe('Provider Integration', () => {
    it('correctly identifies mock provider and sets appropriate flags', async () => {
      const requestBody = {
        keywords: ['test keyword'],
        matchType: 'phrase',
      }

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const response = await POST(request)
      const data = await response.json()

      // When using mock provider
      expect(data.mockData).toBe(true)
      expect(data.provider).toBe('Mock')
      expect(data.data[0].keyword).toBe('test keyword')
    })
  })
})
