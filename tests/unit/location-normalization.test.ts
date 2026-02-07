/**
 * Location Normalization Test
 *
 * Tests that Global (GL) location code is properly normalized
 * for cache keys and provider calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Clerk auth BEFORE importing the route
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      userId: 'test-user-123',
      sessionClaims: { email: 'test@example.com' },
    })
  ),
}))

// Mock billing module - enable billing for these tests
vi.mock('@/lib/billing', () => ({
  isBillingEnabled: vi.fn(() => true),
  isStripeConfigured: vi.fn(() => true),
  isBillingOperational: vi.fn(() => true),
}))

// Mock userService BEFORE importing the route
vi.mock('@/lib/user/user-service', () => ({
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
}))

// Mock the cache and provider modules
vi.mock('@/lib/cache/redis', () => ({
  cache: {
    generateKey: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}))

vi.mock('@/lib/api/factory', () => ({
  getProvider: vi.fn(() => ({
    name: 'Mock',
    getKeywordData: vi.fn(),
  })),
  getMockProvider: vi.fn(() => ({
    name: 'Mock',
    getKeywordData: vi.fn().mockResolvedValue([
      {
        keyword: 'test keyword',
        searchVolume: 1000,
        difficulty: 50,
        cpc: 1.5,
        intent: 'informational',
      },
    ]),
  })),
}))

vi.mock('@/lib/rate-limit/redis-rate-limiter', () => ({
  rateLimiter: {
    checkRateLimit: vi.fn(() => ({
      allowed: true,
      remaining: 10,
      resetAt: new Date(),
    })),
  },
}))

describe('Location Normalization', () => {
  let mockCache: any

  let mockProvider: any

  beforeEach(async () => {
    // Import mocked modules
    const cacheModule = await import('@/lib/cache/redis')
    const providerModule = await import('@/lib/api/factory')

    mockCache = cacheModule.cache
    mockProvider = providerModule.getProvider()

    // Reset mocks
    vi.clearAllMocks()

    // Setup cache mock return values
    mockCache.generateKey.mockReturnValue('test-cache-key')
    mockCache.get.mockResolvedValue(null) // Cache miss
    mockCache.set.mockResolvedValue(true)

    // Setup provider mock
    mockProvider.getKeywordData.mockResolvedValue([
      {
        keyword: 'test keyword',
        searchVolume: 1000,
        difficulty: 50,
        cpc: 1.5,
        intent: 'informational',
      },
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should normalize GL to Worldwide in cache keys', async () => {
    const { POST } = await import('../../src/app/api/keywords/route')

    const request = new NextRequest('http://localhost:3000/api/keywords', {
      method: 'POST',
      body: JSON.stringify({
        keywords: ['test keyword'],
        matchType: 'phrase',
        location: 'GL', // Global location code
        language: 'en',
      }),
      headers: {
        'content-type': 'application/json',
      },
    })

    await POST(request)

    // Check that cache.generateKey was called with normalized location
    expect(mockCache.generateKey).toHaveBeenCalledWith(
      ['test keyword'],
      'Worldwide', // Should be normalized, not 'GL'
      'en',
      'phrase'
    )
  })

  it('should verify GL normalization works in isolation', async () => {
    const { normalizeLocationForProvider } = await import(
      '../../src/app/api/keywords/route'
    )

    // Test all location mappings
    const testCases = [
      { input: 'GL', expected: 'Worldwide' },
      { input: 'US', expected: 'United States' },
      { input: 'GB', expected: 'United Kingdom' },
      { input: 'CA', expected: 'Canada' },
      { input: undefined, expected: 'United States' }, // Default fallback
      { input: 'XYZ', expected: 'United States' }, // Unknown codes default
    ]

    for (const { input, expected } of testCases) {
      const result = normalizeLocationForProvider(input)
      expect(result).toBe(expected)
    }
  })

  it('should handle other location codes correctly', async () => {
    const { POST } = await import('../../src/app/api/keywords/route')

    const request = new NextRequest('http://localhost:3000/api/keywords', {
      method: 'POST',
      body: JSON.stringify({
        keywords: ['test keyword'],
        matchType: 'phrase',
        location: 'US', // United States code
        language: 'en',
      }),
      headers: {
        'content-type': 'application/json',
      },
    })

    await POST(request)

    // Check that cache.generateKey was called with normalized location
    expect(mockCache.generateKey).toHaveBeenCalledWith(
      ['test keyword'],
      'United States', // Should be normalized from 'US'
      'en',
      'phrase'
    )
  })

  it('should generate consistent cache keys for same normalized location', async () => {
    // Test the normalization function directly
    const { normalizeLocationForProvider } = await import(
      '../../src/app/api/keywords/route'
    )

    const normalized1 = normalizeLocationForProvider('GL')
    const normalized2 = normalizeLocationForProvider('GL')

    expect(normalized1).toBe('Worldwide')
    expect(normalized2).toBe('Worldwide')
    expect(normalized1).toBe(normalized2)
  })
})
