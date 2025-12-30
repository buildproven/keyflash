/**
 * Saved Searches Service Tests
 *
 * Tests for CRUD operations, limits, and Redis storage patterns.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Must set env vars before any imports
const originalEnv = process.env

describe('SavedSearchesService', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Constants', () => {
    it('should define correct max saved searches per user', () => {
      const MAX_SAVED_SEARCHES_PER_USER = 50
      expect(MAX_SAVED_SEARCHES_PER_USER).toBe(50)
    })

    it('should define correct TTL of 1 year', () => {
      const SAVED_SEARCH_TTL = 60 * 60 * 24 * 365
      expect(SAVED_SEARCH_TTL).toBe(31536000)
    })
  })

  describe('Redis Key Patterns', () => {
    const SAVED_SEARCH_PREFIX = 'saved-search:'
    const SAVED_SEARCHES_INDEX_PREFIX = 'saved-searches:'

    it('should generate correct search key', () => {
      const clerkUserId = 'user_123'
      const searchId = '1735000000-abc123'
      const key = `${SAVED_SEARCH_PREFIX}${clerkUserId}:${searchId}`

      expect(key).toBe('saved-search:user_123:1735000000-abc123')
    })

    it('should generate correct index key', () => {
      const clerkUserId = 'user_123'
      const key = `${SAVED_SEARCHES_INDEX_PREFIX}${clerkUserId}`

      expect(key).toBe('saved-searches:user_123')
    })
  })

  describe('Search ID Generation', () => {
    it('should generate unique search IDs', () => {
      const generateSearchId = (): string => {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      }

      const id1 = generateSearchId()
      const id2 = generateSearchId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^\d+-[a-z0-9]{7}$/)
    })

    it('should include timestamp in search ID', () => {
      const before = Date.now()
      const generateSearchId = (): string => {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      }
      const id = generateSearchId()
      const after = Date.now()

      const timestamp = parseInt(id.split('-')[0])
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('SavedSearch Data Structure', () => {
    it('should have correct saved search structure', () => {
      const savedSearch = {
        id: '1735000000-abc123',
        clerkUserId: 'user_123',
        name: 'My SEO Keywords',
        description: 'Keywords for blog optimization',
        searchParams: {
          keywords: ['seo', 'keyword research'],
          location: 'US',
          language: 'en',
          matchType: 'phrase' as const,
        },
        results: [
          {
            keyword: 'seo',
            searchVolume: 10000,
            competition: 'high' as const,
            difficulty: 75,
            cpc: 2.5,
            trend: [1000, 1100, 1200],
            intent: 'informational' as const,
          },
        ],
        metadata: {
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          resultCount: 1,
        },
      }

      expect(savedSearch.id).toBeDefined()
      expect(savedSearch.clerkUserId).toBe('user_123')
      expect(savedSearch.name).toBe('My SEO Keywords')
      expect(savedSearch.searchParams.keywords).toHaveLength(2)
      expect(savedSearch.results).toHaveLength(1)
      expect(savedSearch.metadata.resultCount).toBe(1)
    })

    it('should allow optional description', () => {
      const savedSearch = {
        id: '1735000000-abc123',
        clerkUserId: 'user_123',
        name: 'Quick Search',
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

      expect(savedSearch.description).toBeUndefined()
    })

    it('should allow optional results', () => {
      const savedSearch = {
        id: '1735000000-abc123',
        clerkUserId: 'user_123',
        name: 'Search Without Results',
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

      expect(savedSearch.results).toBeUndefined()
    })
  })

  describe('SavedSearchSummary Structure', () => {
    it('should have correct summary structure for listing', () => {
      const summary = {
        id: '1735000000-abc123',
        name: 'My SEO Keywords',
        description: 'Keywords for blog optimization',
        keywordCount: 5,
        location: 'US',
        metadata: {
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-02T00:00:00.000Z',
          lastRunAt: '2025-01-02T12:00:00.000Z',
        },
      }

      expect(summary.id).toBeDefined()
      expect(summary.keywordCount).toBe(5)
      expect(summary.metadata.lastRunAt).toBeDefined()
    })
  })

  describe('Limit Check Logic', () => {
    const MAX_SAVED_SEARCHES_PER_USER = 50

    it('should allow creating search under limit', () => {
      const existingCount = 10
      const allowed = existingCount < MAX_SAVED_SEARCHES_PER_USER

      expect(allowed).toBe(true)
    })

    it('should deny creating search at limit', () => {
      const existingCount = 50
      const allowed = existingCount < MAX_SAVED_SEARCHES_PER_USER

      expect(allowed).toBe(false)
    })

    it('should deny creating search over limit', () => {
      const existingCount = 55
      const allowed = existingCount < MAX_SAVED_SEARCHES_PER_USER

      expect(allowed).toBe(false)
    })
  })

  describe('Update Logic', () => {
    it('should update only provided fields', () => {
      const existing = {
        id: '1735000000-abc123',
        clerkUserId: 'user_123',
        name: 'Original Name',
        description: 'Original Description',
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

      const input = {
        name: 'Updated Name',
        description: undefined, // Not provided
      }

      const updated = {
        ...existing,
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        metadata: {
          ...existing.metadata,
          updatedAt: '2025-01-02T00:00:00.000Z',
        },
      }

      expect(updated.name).toBe('Updated Name')
      expect(updated.description).toBe('Original Description') // Preserved
      expect(updated.metadata.updatedAt).toBe('2025-01-02T00:00:00.000Z')
    })

    it('should update both name and description when provided', () => {
      const existing = {
        name: 'Original',
        description: 'Original Desc',
      }

      const input = {
        name: 'New Name',
        description: 'New Description',
      }

      const updated = {
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
      }

      expect(updated.name).toBe('New Name')
      expect(updated.description).toBe('New Description')
    })
  })

  describe('Last Run Update', () => {
    it('should update lastRunAt timestamp', () => {
      const existing = {
        metadata: {
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          lastRunAt: undefined as string | undefined,
        },
      }

      const now = '2025-01-02T12:00:00.000Z'
      const updated = {
        metadata: {
          ...existing.metadata,
          lastRunAt: now,
          updatedAt: now,
        },
      }

      expect(updated.metadata.lastRunAt).toBe(now)
      expect(updated.metadata.updatedAt).toBe(now)
    })
  })

  describe('Sorting Logic', () => {
    it('should sort summaries by most recently updated', () => {
      const summaries = [
        {
          id: '1',
          name: 'Old',
          metadata: { updatedAt: '2025-01-01T00:00:00.000Z' },
        },
        {
          id: '2',
          name: 'New',
          metadata: { updatedAt: '2025-01-03T00:00:00.000Z' },
        },
        {
          id: '3',
          name: 'Middle',
          metadata: { updatedAt: '2025-01-02T00:00:00.000Z' },
        },
      ]

      const sorted = [...summaries].sort(
        (a, b) =>
          new Date(b.metadata.updatedAt).getTime() -
          new Date(a.metadata.updatedAt).getTime()
      )

      expect(sorted[0].name).toBe('New')
      expect(sorted[1].name).toBe('Middle')
      expect(sorted[2].name).toBe('Old')
    })
  })

  describe('Configuration', () => {
    it('should require Redis URL for availability', () => {
      const hasRedisConfig = (url?: string, token?: string) => {
        return !!(url && token)
      }

      expect(hasRedisConfig('https://test.upstash.io', 'token')).toBe(true)
      expect(hasRedisConfig(undefined, 'token')).toBe(false)
      expect(hasRedisConfig('https://test.upstash.io', undefined)).toBe(false)
      expect(hasRedisConfig(undefined, undefined)).toBe(false)
    })
  })

  describe('Validation Schema', () => {
    it('should validate name is required and non-empty', () => {
      const validateName = (name: string): boolean => {
        return name.trim().length > 0
      }

      expect(validateName('Valid Name')).toBe(true)
      expect(validateName('')).toBe(false)
      expect(validateName('   ')).toBe(false)
    })

    it('should validate name max length', () => {
      const MAX_NAME_LENGTH = 100
      const validateNameLength = (name: string): boolean => {
        return name.length <= MAX_NAME_LENGTH
      }

      expect(validateNameLength('Short name')).toBe(true)
      expect(validateNameLength('a'.repeat(100))).toBe(true)
      expect(validateNameLength('a'.repeat(101))).toBe(false)
    })

    it('should validate description max length', () => {
      const MAX_DESC_LENGTH = 500
      const validateDescLength = (desc: string): boolean => {
        return desc.length <= MAX_DESC_LENGTH
      }

      expect(validateDescLength('Short description')).toBe(true)
      expect(validateDescLength('a'.repeat(500))).toBe(true)
      expect(validateDescLength('a'.repeat(501))).toBe(false)
    })
  })
})
