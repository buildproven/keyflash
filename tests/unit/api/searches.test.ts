/**
 * Saved Searches API Routes Tests
 *
 * Tests for /api/searches endpoints:
 * - GET /api/searches - List saved searches
 * - POST /api/searches - Create saved search
 * - GET /api/searches/[id] - Get single search
 * - PUT /api/searches/[id] - Update search
 * - DELETE /api/searches/[id] - Delete search
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Clerk auth BEFORE importing routes
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() =>
    Promise.resolve({ userId: 'user_123', sessionClaims: null })
  ),
}))

// Mock savedSearchesService
vi.mock('@/lib/saved-searches/saved-searches-service', () => ({
  savedSearchesService: {
    isAvailable: vi.fn(() => true),
    listSavedSearches: vi.fn(),
    createSavedSearch: vi.fn(),
    getSavedSearch: vi.fn(),
    updateSavedSearch: vi.fn(),
    deleteSavedSearch: vi.fn(),
  },
}))

// Import after mocks
import { GET, POST } from '@/app/api/searches/route'
import { GET as GET_ID, PUT, DELETE } from '@/app/api/searches/[id]/route'
import { auth } from '@clerk/nextjs/server'
import { savedSearchesService } from '@/lib/saved-searches/saved-searches-service'

describe('/api/searches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      userId: 'user_123',
      sessionClaims: null,
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    vi.mocked(savedSearchesService.isAvailable).mockReturnValue(true)
  })

  describe('GET /api/searches', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        sessionClaims: null,
      } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

      const request = new NextRequest('http://localhost:3000/api/searches')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.message).toBe('Authentication required')
    })

    it('should return 503 when service unavailable', async () => {
      vi.mocked(savedSearchesService.isAvailable).mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/searches')
      const response = await GET(request)

      expect(response.status).toBe(503)
      const data = await response.json()
      expect(data.message).toBe('Service temporarily unavailable')
    })

    it('should return saved searches list', async () => {
      const mockSearches = [
        {
          id: '1735000000-abc123',
          name: 'Test Search',
          keywordCount: 5,
          location: 'US',
          metadata: {
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      ]
      vi.mocked(savedSearchesService.listSavedSearches).mockResolvedValue(
        mockSearches
      )

      const request = new NextRequest('http://localhost:3000/api/searches')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.searches).toHaveLength(1)
      expect(data.searches[0].name).toBe('Test Search')
    })

    it('should return empty array when no searches', async () => {
      vi.mocked(savedSearchesService.listSavedSearches).mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/searches')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.searches).toHaveLength(0)
    })
  })

  describe('POST /api/searches', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        sessionClaims: null,
      } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

      const request = new NextRequest('http://localhost:3000/api/searches', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test',
          searchParams: {
            keywords: ['test'],
            location: 'US',
            language: 'en',
            matchType: 'phrase',
          },
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('should return 400 for invalid body', async () => {
      const request = new NextRequest('http://localhost:3000/api/searches', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should return 400 for missing name', async () => {
      const request = new NextRequest('http://localhost:3000/api/searches', {
        method: 'POST',
        body: JSON.stringify({
          searchParams: {
            keywords: ['test'],
            location: 'US',
            language: 'en',
            matchType: 'phrase',
          },
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should create saved search successfully', async () => {
      const mockCreated = {
        id: '1735000000-abc123',
        clerkUserId: 'user_123',
        name: 'My Search',
        searchParams: {
          keywords: ['seo'],
          location: 'US',
          language: 'en',
          matchType: 'phrase' as const,
        },
        metadata: {
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      }
      vi.mocked(savedSearchesService.createSavedSearch).mockResolvedValue(
        mockCreated
      )

      const request = new NextRequest('http://localhost:3000/api/searches', {
        method: 'POST',
        body: JSON.stringify({
          name: 'My Search',
          searchParams: {
            keywords: ['seo'],
            location: 'US',
            language: 'en',
            matchType: 'phrase',
          },
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.search.id).toBe('1735000000-abc123')
      expect(data.search.name).toBe('My Search')
    })

    it('should return 400 when limit reached', async () => {
      vi.mocked(savedSearchesService.createSavedSearch).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/searches', {
        method: 'POST',
        body: JSON.stringify({
          name: 'My Search',
          searchParams: {
            keywords: ['seo'],
            location: 'US',
            language: 'en',
            matchType: 'phrase',
          },
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.message).toContain('limit')
    })
  })

  describe('GET /api/searches/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        sessionClaims: null,
      } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

      const request = new NextRequest('http://localhost:3000/api/searches/123')
      const response = await GET_ID(request, {
        params: Promise.resolve({ id: '123' }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 404 when search not found', async () => {
      vi.mocked(savedSearchesService.getSavedSearch).mockResolvedValue(null)

      const request = new NextRequest(
        'http://localhost:3000/api/searches/nonexistent'
      )
      const response = await GET_ID(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      })

      expect(response.status).toBe(404)
    })

    it('should return saved search', async () => {
      const mockSearch = {
        id: '1735000000-abc123',
        clerkUserId: 'user_123',
        name: 'Test Search',
        searchParams: {
          keywords: ['test'],
          location: 'US',
          language: 'en',
          matchType: 'phrase' as const,
        },
        metadata: {
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      }
      vi.mocked(savedSearchesService.getSavedSearch).mockResolvedValue(
        mockSearch
      )

      const request = new NextRequest(
        'http://localhost:3000/api/searches/1735000000-abc123'
      )
      const response = await GET_ID(request, {
        params: Promise.resolve({ id: '1735000000-abc123' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.search.name).toBe('Test Search')
    })
  })

  describe('PUT /api/searches/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        sessionClaims: null,
      } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

      const request = new NextRequest(
        'http://localhost:3000/api/searches/123',
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' }),
        }
      )
      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 404 when search not found', async () => {
      vi.mocked(savedSearchesService.updateSavedSearch).mockResolvedValue(null)

      const request = new NextRequest(
        'http://localhost:3000/api/searches/nonexistent',
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' }),
        }
      )
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      })

      expect(response.status).toBe(404)
    })

    it('should update saved search', async () => {
      const mockUpdated = {
        id: '1735000000-abc123',
        clerkUserId: 'user_123',
        name: 'Updated Name',
        searchParams: {
          keywords: ['test'],
          location: 'US',
          language: 'en',
          matchType: 'phrase' as const,
        },
        metadata: {
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-02T00:00:00.000Z',
        },
      }
      vi.mocked(savedSearchesService.updateSavedSearch).mockResolvedValue(
        mockUpdated
      )

      const request = new NextRequest(
        'http://localhost:3000/api/searches/1735000000-abc123',
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Name' }),
        }
      )
      const response = await PUT(request, {
        params: Promise.resolve({ id: '1735000000-abc123' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.search.name).toBe('Updated Name')
    })
  })

  describe('DELETE /api/searches/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        sessionClaims: null,
      } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)

      const request = new NextRequest(
        'http://localhost:3000/api/searches/123',
        {
          method: 'DELETE',
        }
      )
      const response = await DELETE(request, {
        params: Promise.resolve({ id: '123' }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 404 when search not found', async () => {
      vi.mocked(savedSearchesService.deleteSavedSearch).mockResolvedValue(false)

      const request = new NextRequest(
        'http://localhost:3000/api/searches/nonexistent',
        {
          method: 'DELETE',
        }
      )
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      })

      expect(response.status).toBe(404)
    })

    it('should delete saved search', async () => {
      vi.mocked(savedSearchesService.deleteSavedSearch).mockResolvedValue(true)

      const request = new NextRequest(
        'http://localhost:3000/api/searches/1735000000-abc123',
        {
          method: 'DELETE',
        }
      )
      const response = await DELETE(request, {
        params: Promise.resolve({ id: '1735000000-abc123' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })
})
