import { Redis } from '@upstash/redis'
import { logger } from '@/lib/utils/logger'
import type {
  SavedSearch,
  SavedSearchSummary,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
} from '@/types/saved-search'

const SAVED_SEARCH_PREFIX = 'saved-search:'
const SAVED_SEARCHES_INDEX_PREFIX = 'saved-searches:'
const MAX_SAVED_SEARCHES_PER_USER = 50
const SAVED_SEARCH_TTL = 60 * 60 * 24 * 365 // 1 year

function generateSearchId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

class SavedSearchesService {
  private client: Redis | null = null
  private isConfigured = false

  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (url && token) {
      try {
        this.client = new Redis({ url, token })
        this.isConfigured = true
      } catch (error) {
        logger.error(
          'Failed to initialize SavedSearchesService Redis client',
          error,
          { module: 'SavedSearchesService' }
        )
      }
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.client !== null
  }

  private getSearchKey(clerkUserId: string, searchId: string): string {
    return `${SAVED_SEARCH_PREFIX}${clerkUserId}:${searchId}`
  }

  private getIndexKey(clerkUserId: string): string {
    return `${SAVED_SEARCHES_INDEX_PREFIX}${clerkUserId}`
  }

  async createSavedSearch(
    clerkUserId: string,
    input: CreateSavedSearchInput
  ): Promise<SavedSearch | null> {
    if (!this.isAvailable()) {
      logger.warn('SavedSearchesService not available', {
        module: 'SavedSearchesService',
      })
      return null
    }

    try {
      // Check limit
      const existingIds = await this.client!.smembers(
        this.getIndexKey(clerkUserId)
      )
      if (existingIds.length >= MAX_SAVED_SEARCHES_PER_USER) {
        logger.warn('User reached saved searches limit', {
          module: 'SavedSearchesService',
          clerkUserId,
          limit: MAX_SAVED_SEARCHES_PER_USER,
        })
        return null
      }

      const now = new Date().toISOString()
      const searchId = generateSearchId()

      const savedSearch: SavedSearch = {
        id: searchId,
        clerkUserId,
        name: input.name,
        description: input.description,
        searchParams: input.searchParams,
        results: input.results,
        metadata: {
          createdAt: now,
          updatedAt: now,
          resultCount: input.results?.length,
        },
      }

      // Store the search
      await this.client!.set(
        this.getSearchKey(clerkUserId, searchId),
        savedSearch,
        { ex: SAVED_SEARCH_TTL }
      )

      // Add to user's index
      await this.client!.sadd(this.getIndexKey(clerkUserId), searchId)

      logger.info('Created saved search', {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
        name: input.name,
      })

      return savedSearch
    } catch (error) {
      logger.error('Failed to create saved search', error, {
        module: 'SavedSearchesService',
        clerkUserId,
      })
      return null
    }
  }

  async getSavedSearch(
    clerkUserId: string,
    searchId: string
  ): Promise<SavedSearch | null> {
    if (!this.isAvailable()) return null

    try {
      const search = await this.client!.get<SavedSearch>(
        this.getSearchKey(clerkUserId, searchId)
      )
      return search
    } catch (error) {
      logger.error('Failed to get saved search', error, {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })
      return null
    }
  }

  async listSavedSearches(clerkUserId: string): Promise<SavedSearchSummary[]> {
    if (!this.isAvailable()) return []

    try {
      const searchIds = await this.client!.smembers(
        this.getIndexKey(clerkUserId)
      )

      if (searchIds.length === 0) return []

      const summaries: SavedSearchSummary[] = []

      for (const id of searchIds) {
        const search = await this.client!.get<SavedSearch>(
          this.getSearchKey(clerkUserId, String(id))
        )
        if (search) {
          summaries.push({
            id: search.id,
            name: search.name,
            description: search.description,
            keywordCount: search.searchParams.keywords.length,
            location: search.searchParams.location,
            metadata: search.metadata,
          })
        }
      }

      // Sort by most recently updated
      summaries.sort(
        (a, b) =>
          new Date(b.metadata.updatedAt).getTime() -
          new Date(a.metadata.updatedAt).getTime()
      )

      return summaries
    } catch (error) {
      logger.error('Failed to list saved searches', error, {
        module: 'SavedSearchesService',
        clerkUserId,
      })
      return []
    }
  }

  async updateSavedSearch(
    clerkUserId: string,
    searchId: string,
    input: UpdateSavedSearchInput
  ): Promise<SavedSearch | null> {
    if (!this.isAvailable()) return null

    try {
      const existing = await this.getSavedSearch(clerkUserId, searchId)
      if (!existing) return null

      const updated: SavedSearch = {
        ...existing,
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        metadata: {
          ...existing.metadata,
          updatedAt: new Date().toISOString(),
        },
      }

      await this.client!.set(
        this.getSearchKey(clerkUserId, searchId),
        updated,
        {
          ex: SAVED_SEARCH_TTL,
        }
      )

      logger.info('Updated saved search', {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })

      return updated
    } catch (error) {
      logger.error('Failed to update saved search', error, {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })
      return null
    }
  }

  async deleteSavedSearch(
    clerkUserId: string,
    searchId: string
  ): Promise<boolean> {
    if (!this.isAvailable()) return false

    try {
      // Remove from index
      await this.client!.srem(this.getIndexKey(clerkUserId), searchId)

      // Delete the search
      await this.client!.del(this.getSearchKey(clerkUserId, searchId))

      logger.info('Deleted saved search', {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })

      return true
    } catch (error) {
      logger.error('Failed to delete saved search', error, {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })
      return false
    }
  }

  async updateLastRun(clerkUserId: string, searchId: string): Promise<boolean> {
    if (!this.isAvailable()) return false

    try {
      const existing = await this.getSavedSearch(clerkUserId, searchId)
      if (!existing) return false

      const updated: SavedSearch = {
        ...existing,
        metadata: {
          ...existing.metadata,
          lastRunAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }

      await this.client!.set(
        this.getSearchKey(clerkUserId, searchId),
        updated,
        {
          ex: SAVED_SEARCH_TTL,
        }
      )

      return true
    } catch (error) {
      logger.error('Failed to update last run', error, {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })
      return false
    }
  }
}

export const savedSearchesService = new SavedSearchesService()
export { SavedSearchesService }
