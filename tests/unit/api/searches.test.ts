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

// Mock savedSearchesService - use importOriginal to get error classes for error-handler.ts
vi.mock('@/lib/saved-searches/saved-searches-service', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/lib/saved-searches/saved-searches-service')
    >()
  return {
    ...actual, // Keep ServiceUnavailableError and ServiceOperationError
    savedSearchesService: {
      isAvailable: vi.fn(() => true),
      listSavedSearches: vi.fn(),
      createSavedSearch: vi.fn(),
      getSavedSearch: vi.fn(),
      updateSavedSearch: vi.fn(),
      deleteSavedSearch: vi.fn(),
    },
  }
})

// Import after mocks
import { GET, POST } from '@/app/api/searches/route'
import { GET as GET_ID, PUT, DELETE } from '@/app/api/searches/[id]/route'
import { auth } from '@clerk/nextjs/server'
import {
  savedSearchesService,
  ServiceUnavailableError,
} from '@/lib/saved-searches/saved-searches-service'

// FIX-011: Use valid search IDs that match SearchIdSchema
// UUID format: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
// Legacy format: /^\d{13}-[a-z0-9]{7}$/ (13-digit timestamp + 7 alphanumeric)
const VALID_LEGACY_ID = '1735000000000-abc1234'

describe('/api/searches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      userId: 'user_123',
      sessionClaims: null,
    } as unknown as Awaited<ReturnType<typeof auth>>)
    vi.mocked(savedSearchesService.isAvailable).mockReturnValue(true)
  })

  describe('GET /api/searches', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        sessionClaims: null,
      } as unknown as Awaited<ReturnType<typeof auth>>)

      const response = await GET()

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.message).toBe('Authentication required')
    })

    it('should return 503 when service unavailable', async () => {
      vi.mocked(savedSearchesService.listSavedSearches).mockRejectedValue(
        new ServiceUnavailableError('Service temporarily unavailable')
      )

      const response = await GET()

      expect(response.status).toBe(503)
      const data = await response.json()
      expect(data.message).toBe(
        'Service temporarily unavailable. Please try again later.'
      )
    })

    it('should return saved searches list', async () => {
      const mockSearches = [
        {
          id: VALID_LEGACY_ID,
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

      const response = await GET()

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.searches).toHaveLength(1)
      expect(data.searches[0].name).toBe('Test Search')
    })

    it('should return empty array when no searches', async () => {
      vi.mocked(savedSearchesService.listSavedSearches).mockResolvedValue([])

      const response = await GET()

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
      } as unknown as Awaited<ReturnType<typeof auth>>)

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
        id: VALID_LEGACY_ID,
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
      expect(data.search.id).toBe(VALID_LEGACY_ID)
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
      } as unknown as Awaited<ReturnType<typeof auth>>)

      const request = new NextRequest(
        `http://localhost:3000/api/searches/${VALID_UUID}`
      )
      const response = await GET_ID(request, {
        params: Promise.resolve({ id: VALID_UUID }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 404 when search not found', async () => {
      vi.mocked(savedSearchesService.getSavedSearch).mockResolvedValue(null)

      const request = new NextRequest(
        `http://localhost:3000/api/searches/${VALID_UUID}`
      )
      const response = await GET_ID(request, {
        params: Promise.resolve({ id: VALID_UUID }),
      })

      expect(response.status).toBe(404)
    })

    it('should return saved search', async () => {
      const mockSearch = {
        id: VALID_LEGACY_ID,
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
        `http://localhost:3000/api/searches/${VALID_LEGACY_ID}`
      )
      const response = await GET_ID(request, {
        params: Promise.resolve({ id: VALID_LEGACY_ID }),
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
      } as unknown as Awaited<ReturnType<typeof auth>>)

      const request = new NextRequest(
        `http://localhost:3000/api/searches/${VALID_UUID}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' }),
        }
      )
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_UUID }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 404 when search not found', async () => {
      vi.mocked(savedSearchesService.updateSavedSearch).mockResolvedValue(null)

      const request = new NextRequest(
        `http://localhost:3000/api/searches/${VALID_UUID}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' }),
        }
      )
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_UUID }),
      })

      expect(response.status).toBe(404)
    })

    it('should update saved search', async () => {
      const mockUpdated = {
        id: VALID_LEGACY_ID,
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
        `http://localhost:3000/api/searches/${VALID_LEGACY_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Name' }),
        }
      )
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_LEGACY_ID }),
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
      } as unknown as Awaited<ReturnType<typeof auth>>)

      const request = new NextRequest(
        `http://localhost:3000/api/searches/${VALID_UUID}`,
        {
          method: 'DELETE',
        }
      )
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_UUID }),
      })

      expect(response.status).toBe(401)
    })

    it('should return 404 when search not found', async () => {
      vi.mocked(savedSearchesService.deleteSavedSearch).mockResolvedValue(false)

      const request = new NextRequest(
        `http://localhost:3000/api/searches/${VALID_UUID}`,
        {
          method: 'DELETE',
        }
      )
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_UUID }),
      })

      expect(response.status).toBe(404)
    })

    it('should delete saved search', async () => {
      vi.mocked(savedSearchesService.deleteSavedSearch).mockResolvedValue(true)

      const request = new NextRequest(
        `http://localhost:3000/api/searches/${VALID_LEGACY_ID}`,
        {
          method: 'DELETE',
        }
      )
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_LEGACY_ID }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })
})
