import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/rate-limit/redis-rate-limiter', () => ({
  rateLimiter: {
    checkRateLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 19,
      retryAfter: 0,
      resetAt: new Date(),
    }),
  },
}))

vi.mock('@/lib/cache/redis', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    isAvailable: vi.fn().mockReturnValue(false),
  },
}))

vi.mock('@/lib/api/serp-service', () => ({
  serpService: {
    isConfigured: vi.fn().mockReturnValue(false),
    generateContentBrief: vi.fn().mockResolvedValue({
      keyword: 'test keyword',
      location: 'US',
      generatedAt: new Date().toISOString(),
      serpResults: [
        {
          position: 1,
          title: 'Test Result 1',
          url: 'https://example.com/1',
          domain: 'example.com',
          description: 'Test description 1',
          wordCount: 2000,
        },
      ],
      totalResults: 1000000,
      recommendedWordCount: {
        min: 1600,
        max: 2600,
        average: 2000,
      },
      topics: [{ topic: 'test topic', frequency: 5, importance: 'high' }],
      suggestedHeadings: [
        { text: 'What is test keyword', level: 'h2', source: 'Common pattern' },
      ],
      questionsToAnswer: [
        { question: 'What is test keyword?', source: 'inferred' },
      ],
      relatedKeywords: ['related keyword 1', 'related keyword 2'],
      mockData: true,
      provider: 'Mock',
    }),
  },
}))

import { POST, GET } from '@/app/api/content-brief/route'
import { rateLimiter } from '@/lib/rate-limit/redis-rate-limiter'

// Helper to create mock request
function createMockRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/content-brief', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify(body),
  })
}

describe('/api/content-brief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/content-brief', () => {
    it('returns a content brief for valid keyword', async () => {
      const request = createMockRequest({
        keyword: 'test keyword',
        location: 'US',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.brief).toBeDefined()
      expect(data.brief.keyword).toBe('test keyword')
      expect(data.brief.recommendedWordCount).toBeDefined()
      expect(data.brief.topics).toBeDefined()
      expect(data.brief.suggestedHeadings).toBeDefined()
      expect(data.brief.questionsToAnswer).toBeDefined()
    })

    it('includes rate limit headers', async () => {
      const request = createMockRequest({
        keyword: 'test keyword',
      })

      const response = await POST(request)

      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined()
    })

    it('returns 400 for missing keyword', async () => {
      const request = createMockRequest({})

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('returns 400 for invalid keyword characters', async () => {
      const request = createMockRequest({
        keyword: 'test<script>alert(1)</script>',
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('returns 400 for keyword exceeding max length', async () => {
      const request = createMockRequest({
        keyword: 'a'.repeat(101),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 3600,
        resetAt: new Date(Date.now() + 3600000),
      })

      const request = createMockRequest({
        keyword: 'test keyword',
      })

      const response = await POST(request)

      expect(response.status).toBe(429)
    })

    it('uses default location when not provided', async () => {
      const request = createMockRequest({
        keyword: 'test keyword',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.brief).toBeDefined()
    })

    it('validates location format', async () => {
      const request = createMockRequest({
        keyword: 'test keyword',
        location: 'invalid',
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/content-brief', () => {
    it('returns 405 Method Not Allowed', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(405)
      expect(data.error).toBe('Method Not Allowed')
    })
  })
})
