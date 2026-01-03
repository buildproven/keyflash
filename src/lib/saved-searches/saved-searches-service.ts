import { Redis } from '@upstash/redis'
import crypto from 'crypto'
import { logger } from '@/lib/utils/logger'
import { SavedSearchSchema } from '@/lib/validation/domain-schemas'
import type {
  SavedSearch,
  SavedSearchSummary,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
} from '@/types/saved-search'

// FIX-008: Custom error for service infrastructure failures
export class ServiceUnavailableError extends Error {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message)
    this.name = 'ServiceUnavailableError'
  }
}

// FIX-008: Custom error for Redis operation failures
export class ServiceOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string
  ) {
    super(message)
    this.name = 'ServiceOperationError'
  }
}

const SAVED_SEARCH_PREFIX = 'saved-search:'
const SAVED_SEARCHES_INDEX_PREFIX = 'saved-searches:'
const MAX_SAVED_SEARCHES_PER_USER = 50
const SAVED_SEARCH_TTL = 60 * 60 * 24 * 365 // 1 year

// FIX-006: Use crypto.randomUUID for unique IDs
function generateSearchId(): string {
  return crypto.randomUUID()
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

  /**
   * Get Redis client, throwing if unavailable
   * Assumes isAvailable() has already been checked
   * @private
   */
  private getClient(): Redis {
    // This should only be called after isAvailable() check
    return this.client!
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
    // FIX-008: Throw on unavailable instead of returning null
    if (!this.isAvailable()) {
      throw new ServiceUnavailableError('Saved searches service unavailable')
    }

    try {
      const client = this.getClient()
      const indexKey = this.getIndexKey(clerkUserId)
      const searchId = generateSearchId()
      const searchKey = this.getSearchKey(clerkUserId, searchId)

      // SEC-012 FIX: Add FIRST, then check count (prevents TOCTOU race)
      // This prevents concurrent requests from bypassing the quota
      const addResult = await client.sadd(indexKey, searchId)

      if (addResult === 0) {
        // ID already existed (extremely unlikely with UUID)
        logger.warn('Search ID collision detected', {
          module: 'SavedSearchesService',
          clerkUserId,
          searchId,
        })
        return null // Business logic: collision is not an infra error
      }

      // Check count AFTER adding atomically
      const currentCount = await client.scard(indexKey)
      if (currentCount > MAX_SAVED_SEARCHES_PER_USER) {
        // Rollback: remove the search we just added
        await client.srem(indexKey, searchId)
        logger.warn('User exceeded saved searches limit (rolled back)', {
          module: 'SavedSearchesService',
          clerkUserId,
          limit: MAX_SAVED_SEARCHES_PER_USER,
          currentCount,
        })
        return null // Business logic: limit exceeded is not an infra error
      }

      const now = new Date().toISOString()

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

      // Store the search data
      await client.set(searchKey, savedSearch, { ex: SAVED_SEARCH_TTL })

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
      // FIX-008: Throw on Redis errors so API can return 503
      throw new ServiceOperationError('Failed to create saved search', 'create')
    }
  }

  async getSavedSearch(
    clerkUserId: string,
    searchId: string
  ): Promise<SavedSearch | null> {
    // FIX-008: Throw on unavailable instead of returning null
    if (!this.isAvailable()) {
      throw new ServiceUnavailableError('Saved searches service unavailable')
    }

    try {
      const client = this.getClient()
      const raw = await client.get<SavedSearch>(
        this.getSearchKey(clerkUserId, searchId)
      )
      if (!raw) {
        return null // null means not found, which is valid
      }

      // Runtime validation to ensure data integrity
      const validated = SavedSearchSchema.parse(raw)
      return validated as SavedSearch
    } catch (error) {
      logger.error('Failed to get saved search', error, {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })
      // FIX-008: Throw on Redis errors so API can return 503
      throw new ServiceOperationError('Failed to retrieve saved search', 'get')
    }
  }

  async listSavedSearches(clerkUserId: string): Promise<SavedSearchSummary[]> {
    // FIX-008: Throw on unavailable instead of returning empty array
    if (!this.isAvailable()) {
      throw new ServiceUnavailableError('Saved searches service unavailable')
    }

    try {
      const client = this.getClient()
      const searchIds = await client.smembers(this.getIndexKey(clerkUserId))

      if (searchIds.length === 0) return []

      // FIX-009: Use MGET to batch fetch all searches instead of N+1 queries
      const keys = searchIds.map(id =>
        this.getSearchKey(clerkUserId, String(id))
      )
      const searches = await client.mget<SavedSearch[]>(...keys)

      const summaries: SavedSearchSummary[] = []

      for (const search of searches) {
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
      // FIX-008: Throw on Redis errors so API can return 503
      throw new ServiceOperationError('Failed to list saved searches', 'list')
    }
  }

  async updateSavedSearch(
    clerkUserId: string,
    searchId: string,
    input: UpdateSavedSearchInput
  ): Promise<SavedSearch | null> {
    // FIX-008: Throw on unavailable instead of returning null
    if (!this.isAvailable()) {
      throw new ServiceUnavailableError('Saved searches service unavailable')
    }

    try {
      // getSavedSearch already throws on Redis errors
      const existing = await this.getSavedSearch(clerkUserId, searchId)
      if (!existing) return null // Not found is valid

      const updated: SavedSearch = {
        ...existing,
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        metadata: {
          ...existing.metadata,
          updatedAt: new Date().toISOString(),
        },
      }

      const client = this.getClient()
      await client.set(this.getSearchKey(clerkUserId, searchId), updated, {
        ex: SAVED_SEARCH_TTL,
      })

      logger.info('Updated saved search', {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })

      return updated
    } catch (error) {
      // Re-throw service errors (from getSavedSearch)
      if (
        error instanceof ServiceUnavailableError ||
        error instanceof ServiceOperationError
      ) {
        throw error
      }
      logger.error('Failed to update saved search', error, {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })
      // FIX-008: Throw on Redis errors so API can return 503
      throw new ServiceOperationError('Failed to update saved search', 'update')
    }
  }

  async deleteSavedSearch(
    clerkUserId: string,
    searchId: string
  ): Promise<boolean> {
    // FIX-008: Throw on unavailable instead of returning false
    if (!this.isAvailable()) {
      throw new ServiceUnavailableError('Saved searches service unavailable')
    }

    try {
      const client = this.getClient()
      // FIX-019: Check SREM return value to verify search existed
      const removed = await client.srem(this.getIndexKey(clerkUserId), searchId)

      if (removed === 0) {
        // Search was not in the index - it doesn't exist
        return false
      }

      // Delete the search data
      await client.del(this.getSearchKey(clerkUserId, searchId))

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
      // FIX-008: Throw on Redis errors so API can return 503
      throw new ServiceOperationError('Failed to delete saved search', 'delete')
    }
  }

  async updateLastRun(clerkUserId: string, searchId: string): Promise<boolean> {
    // FIX-008: Throw on unavailable instead of returning false
    if (!this.isAvailable()) {
      throw new ServiceUnavailableError('Saved searches service unavailable')
    }

    try {
      // getSavedSearch already throws on Redis errors
      const existing = await this.getSavedSearch(clerkUserId, searchId)
      if (!existing) return false // Not found is valid

      const updated: SavedSearch = {
        ...existing,
        metadata: {
          ...existing.metadata,
          lastRunAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }

      const client = this.getClient()
      await client.set(this.getSearchKey(clerkUserId, searchId), updated, {
        ex: SAVED_SEARCH_TTL,
      })

      return true
    } catch (error) {
      // Re-throw service errors (from getSavedSearch)
      if (
        error instanceof ServiceUnavailableError ||
        error instanceof ServiceOperationError
      ) {
        throw error
      }
      logger.error('Failed to update last run', error, {
        module: 'SavedSearchesService',
        clerkUserId,
        searchId,
      })
      // FIX-008: Throw on Redis errors so API can return 503
      throw new ServiceOperationError(
        'Failed to update last run',
        'updateLastRun'
      )
    }
  }
}

export const savedSearchesService = new SavedSearchesService()
export { SavedSearchesService }
