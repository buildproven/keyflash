/**
 * Edge-Compatible Rate Limiting with Shared Storage
 *
 * Provides reliable rate limiting for Edge runtime environments.
 *
 * Storage Options (in order of preference):
 * 1. Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * 2. In-memory fallback (BEST-EFFORT: resets on cold starts)
 *
 * Ported from shiparchitect for cross-project security standards.
 */

import { logger } from '@/lib/utils/logger'
import { fetchWithTimeout, API_TIMEOUTS } from '@/lib/utils/fetch-with-timeout'

// FIX-013: Maximum entries in memory store to prevent unbounded growth
const MAX_MEMORY_ENTRIES = 10000

interface RateLimitEntry {
  count: number
  windowStart: number
  expiresAt: number
}

interface RateLimitResult {
  limited: boolean
  remaining: number
  resetTime: number
  retryAfter: number
}

interface RateLimitStorage {
  get(key: string): Promise<RateLimitEntry | null>
  set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void>
  increment(key: string, ttlMs: number): Promise<number>
}

class RedisStorage implements RateLimitStorage {
  private baseUrl: string
  private token: string

  constructor(url: string, token: string) {
    this.baseUrl = url.replace(/\/$/, '')
    this.token = token
  }

  private async request(command: string[]): Promise<unknown> {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/pipeline`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([command]),
      },
      API_TIMEOUTS.DEFAULT
    )

    if (!response.ok) {
      throw new Error(`Redis request failed: ${response.status}`)
    }

    const results = (await response.json()) as Array<{
      result?: unknown
      error?: string
    }>
    const result = results[0]
    if (!result) {
      throw new Error('Redis returned empty response')
    }
    if (result.error) {
      throw new Error(`Redis error: ${result.error}`)
    }

    return result.result
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    try {
      const result = await this.request(['GET', key])
      return result && typeof result === 'string' ? JSON.parse(result) : null
    } catch (error) {
      // FIX-014: Use logger instead of console.warn
      logger.warn('Redis GET failed', { module: 'EdgeRateLimit', error })
      return null
    }
  }

  async set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
    try {
      await this.request([
        'SETEX',
        key,
        Math.ceil(ttlMs / 1000).toString(),
        JSON.stringify(entry),
      ])
    } catch (error) {
      // FIX-014: Use logger instead of console.warn
      logger.warn('Redis SET failed', { module: 'EdgeRateLimit', error })
    }
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/pipeline`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            ['INCR', key],
            ['EXPIRE', key, Math.ceil(ttlMs / 1000).toString()],
          ]),
        },
        API_TIMEOUTS.DEFAULT
      )

      if (!response.ok) {
        throw new Error(`Redis pipeline failed: ${response.status}`)
      }

      const results = (await response.json()) as Array<{
        result?: number
        error?: string
      }>
      const incrResult = results[0]

      if (!incrResult) {
        throw new Error('Redis INCR returned empty response')
      }

      if (incrResult.error) {
        throw new Error(`Redis INCR error: ${incrResult.error}`)
      }

      return incrResult.result ?? 0
    } catch (error) {
      // FIX-014: Use logger instead of console.warn
      logger.warn('Redis INCREMENT failed', { module: 'EdgeRateLimit', error })
      throw error
    }
  }
}

class MemoryStorage implements RateLimitStorage {
  private store = new Map<string, RateLimitEntry>()

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key)
    if (!entry || entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ttlMs required by interface but expiration handled via entry.expiresAt
  async set(key: string, entry: RateLimitEntry, _ttlMs: number): Promise<void> {
    // FIX-013: Prevent unbounded memory growth - evict oldest entries if at limit
    if (this.store.size >= MAX_MEMORY_ENTRIES && !this.store.has(key)) {
      // Evict ~10% of oldest entries based on expiresAt
      const entries = Array.from(this.store.entries())
        .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
        .slice(0, Math.ceil(MAX_MEMORY_ENTRIES * 0.1))
      for (const [k] of entries) {
        this.store.delete(k)
      }
    }
    this.store.set(key, entry)
    // FIX-012: Removed setTimeout - entries are cleaned up on get() via expiresAt check
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const now = Date.now()
    const windowStart = Math.floor(now / ttlMs) * ttlMs
    const expiresAt = windowStart + ttlMs

    const existing = await this.get(key)
    const newCount = (existing?.count || 0) + 1

    await this.set(key, { count: newCount, windowStart, expiresAt }, ttlMs)
    return newCount
  }

  clearByPattern(pattern: string): number {
    const keysToDelete: string[] = []
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) keysToDelete.push(key)
    }
    keysToDelete.forEach(k => this.store.delete(k))
    return keysToDelete.length
  }
}

let cachedStorage: RateLimitStorage | null = null

function getStorage(): RateLimitStorage {
  if (cachedStorage) return cachedStorage

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (process.env.NODE_ENV === 'production' && (!redisUrl || !redisToken)) {
    // FIX-014: Use logger instead of console.error
    logger.error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required in production',
      new Error('Redis required in production'),
      { module: 'EdgeRateLimit' }
    )
    throw new Error('Redis required in production for edge rate limiting')
  }

  if (redisUrl && redisToken) {
    cachedStorage = new RedisStorage(redisUrl, redisToken)
  } else {
    // FIX-014: Use logger instead of console.warn
    logger.warn('Using in-memory edge rate limiting (dev only)', {
      module: 'EdgeRateLimit',
    })
    cachedStorage = new MemoryStorage()
  }

  return cachedStorage
}

export function __clearStorageCache(): void {
  cachedStorage = null
}

export async function checkEdgeRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const storage = getStorage()
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const key = `ratelimit:${identifier}:${windowStart}`
  const resetTime = windowStart + windowMs

  try {
    const count = await storage.increment(key, windowMs)

    if (count > limit) {
      return {
        limited: true,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      }
    }

    return {
      limited: false,
      remaining: limit - count,
      resetTime,
      retryAfter: 0,
    }
  } catch (error) {
    // FIX-014: Use logger instead of console.error
    logger.error('Edge rate limit check failed', error, {
      module: 'EdgeRateLimit',
    })

    if (process.env.NODE_ENV === 'production') {
      return { limited: true, remaining: 0, resetTime, retryAfter: 60 }
    }

    return { limited: false, remaining: limit - 1, resetTime, retryAfter: 0 }
  }
}

export async function getEdgeRateLimitStatus(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const storage = getStorage()
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const key = `ratelimit:${identifier}:${windowStart}`
  const resetTime = windowStart + windowMs

  try {
    const existing = await storage.get(key)

    if (!existing) {
      return { limited: false, remaining: limit, resetTime, retryAfter: 0 }
    }

    return {
      limited: existing.count >= limit,
      remaining: Math.max(0, limit - existing.count),
      resetTime,
      retryAfter:
        existing.count >= limit ? Math.ceil((resetTime - now) / 1000) : 0,
    }
  } catch (error) {
    // FIX-014: Use logger instead of console.error
    logger.error('Edge rate limit status check failed', error, {
      module: 'EdgeRateLimit',
    })

    if (process.env.NODE_ENV === 'production') {
      return { limited: true, remaining: 0, resetTime, retryAfter: 60 }
    }

    return { limited: false, remaining: limit, resetTime, retryAfter: 0 }
  }
}

export async function clearEdgeRateLimit(identifier: string): Promise<void> {
  const storage = getStorage()
  if (storage instanceof MemoryStorage) {
    storage.clearByPattern(`ratelimit:${identifier}:`)
  }
}

export function getEdgeRateLimitStorageType(): string {
  const storage = getStorage()
  return storage instanceof RedisStorage ? 'redis' : 'memory'
}
