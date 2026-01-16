/**
 * Advanced Rate Limiting with Request Deduplication
 *
 * Implements per-user rate limiting with:
 * - Mutex locking for atomic operations (prevents race conditions)
 * - SHA-256 content hashing for request deduplication
 * - In-flight request tracking (duplicate requests wait for original)
 * - Result caching with configurable TTL
 * - Automatic cleanup of expired records
 *
 * Ported from saas-starter-kit for cross-project security standards.
 */

import * as crypto from 'crypto'

export interface RateLimitConfig {
  requestsPerMinute?: number
  requestsPerHour?: number
  dedupCacheTtl?: number
  cleanupInterval?: number
  lockTimeout?: number
  namespace?: string
}

interface RateLimitRecord {
  count: number
  resetTime: number
  lastRequest: number
  locked: boolean
}

interface PendingRequest<T = unknown> {
  requestId: string
  userId: string
  contentHash: string
  timestamp: number
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

interface CachedResult<T = unknown> {
  result: T
  timestamp: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
  reason?: string
  remaining?: number
  resetTime?: number
}

export interface DeduplicationResult<T = unknown> {
  isDuplicate: boolean
  requestId: string
  existingResult?: T
}

export interface UserStatus {
  requestsRemaining: number
  resetTime: number
  isLimited: boolean
}

export interface RateLimiterStats {
  activeUsers: number
  pendingRequests: number
  cachedResults: number
  timestamp: number
}

export class AdvancedRateLimiter<T = unknown> {
  private userLimits = new Map<string, RateLimitRecord>()
  private pendingRequests = new Map<string, PendingRequest<T>>()
  private completedRequests = new Map<string, CachedResult<T>>()
  private cleanupIntervalHandle: ReturnType<typeof setInterval> | null = null

  private readonly requestsPerMinute: number
  private readonly requestsPerHour: number
  private readonly dedupCacheTtl: number
  private readonly cleanupInterval: number
  private readonly lockTimeout: number
  private readonly namespace: string

  constructor(config: RateLimitConfig = {}) {
    this.requestsPerMinute = config.requestsPerMinute ?? 3
    this.requestsPerHour = config.requestsPerHour ?? 10
    this.dedupCacheTtl = config.dedupCacheTtl ?? 5 * 60 * 1000
    this.cleanupInterval = config.cleanupInterval ?? 60 * 1000
    this.lockTimeout = config.lockTimeout ?? 1000
    this.namespace = config.namespace ?? 'default'

    this.cleanupIntervalHandle = setInterval(
      () => this.cleanup(),
      this.cleanupInterval
    )
  }

  destroy(): void {
    if (this.cleanupIntervalHandle) {
      clearInterval(this.cleanupIntervalHandle)
      this.cleanupIntervalHandle = null
    }
    this.userLimits.clear()
    this.pendingRequests.clear()
    this.completedRequests.clear()
  }

  private async acquireLock(key: string): Promise<boolean> {
    const startTime = Date.now()
    const maxIterations = Math.ceil(this.lockTimeout / 10) + 10

    for (let i = 0; i < maxIterations; i++) {
      const record = this.userLimits.get(key)

      if (!record) return true

      if (!record.locked) {
        record.locked = true
        this.userLimits.set(key, record)
        return true
      }

      if (Date.now() - startTime > this.lockTimeout) {
        record.locked = false
        this.userLimits.set(key, record)
        return true
      }

      await new Promise(resolve => setTimeout(resolve, 10))
    }

    return true
  }

  private releaseLock(key: string): void {
    const record = this.userLimits.get(key)
    if (record) {
      record.locked = false
      this.userLimits.set(key, record)
    }
  }

  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    const isTestEnv =
      process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
    const enforceInTests = process.env.ENFORCE_RATE_LIMIT_TESTS === 'true'

    if (isTestEnv && !enforceInTests) {
      return { allowed: true, remaining: this.requestsPerMinute }
    }

    const now = Date.now()
    const userKey = `${this.namespace}:${userId}`

    await this.acquireLock(userKey)

    try {
      let record = this.userLimits.get(userKey)

      if (!record) {
        record = {
          count: 1,
          resetTime: now + 60 * 1000,
          lastRequest: now,
          locked: false,
        }
        this.userLimits.set(userKey, record)
        return {
          allowed: true,
          remaining: this.requestsPerMinute - 1,
          resetTime: record.resetTime,
        }
      }

      if (now >= record.resetTime) {
        record.count = 1
        record.resetTime = now + 60 * 1000
        record.lastRequest = now
        this.userLimits.set(userKey, record)
        return {
          allowed: true,
          remaining: this.requestsPerMinute - 1,
          resetTime: record.resetTime,
        }
      }

      if (record.count >= this.requestsPerMinute) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000)
        return {
          allowed: false,
          retryAfter,
          reason: `Rate limit exceeded: ${this.requestsPerMinute} requests per minute. Try again in ${retryAfter}s.`,
          remaining: 0,
          resetTime: record.resetTime,
        }
      }

      const hourAgo = now - 60 * 60 * 1000
      if (
        record.lastRequest > hourAgo &&
        record.count >= this.requestsPerHour
      ) {
        return {
          allowed: false,
          retryAfter: 3600,
          reason: `Hourly limit reached: ${this.requestsPerHour} requests per hour. Try again later.`,
          remaining: 0,
          resetTime: now + 3600 * 1000,
        }
      }

      record.count++
      record.lastRequest = now
      this.userLimits.set(userKey, record)

      return {
        allowed: true,
        remaining: Math.max(0, this.requestsPerMinute - record.count),
        resetTime: record.resetTime,
      }
    } finally {
      this.releaseLock(userKey)
    }
  }

  generateContentHash(userId: string, content: string | object): string {
    const contentStr =
      typeof content === 'string' ? content : JSON.stringify(content)
    return crypto
      .createHash('sha256')
      .update(`${userId}:${contentStr}`)
      .digest('hex')
      .substring(0, 16)
  }

  async handleDeduplication(
    userId: string,
    content: string | object
  ): Promise<DeduplicationResult<T>> {
    const contentHash = this.generateContentHash(userId, content)
    const requestId = `${userId}:${contentHash}`

    const existingResult = this.completedRequests.get(requestId)
    if (existingResult) {
      const age = Date.now() - existingResult.timestamp
      if (age < this.dedupCacheTtl) {
        return {
          isDuplicate: true,
          requestId,
          existingResult: existingResult.result,
        }
      } else {
        this.completedRequests.delete(requestId)
      }
    }

    const pendingRequest = this.pendingRequests.get(requestId)
    if (pendingRequest) {
      return new Promise((resolve, reject) => {
        const originalResolve = pendingRequest.resolve
        const originalReject = pendingRequest.reject

        pendingRequest.resolve = result => {
          originalResolve(result)
          resolve({ isDuplicate: true, requestId, existingResult: result })
        }

        pendingRequest.reject = error => {
          originalReject(error)
          reject(error)
        }
      })
    }

    return { isDuplicate: false, requestId }
  }

  registerPendingRequest(
    requestId: string,
    userId: string,
    contentHash: string
  ): {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (error: unknown) => void
  } {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void

    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    const pendingRequest: PendingRequest<T> = {
      requestId,
      userId,
      contentHash,
      timestamp: Date.now(),
      resolve,
      reject,
    }

    this.pendingRequests.set(requestId, pendingRequest)

    return { promise, resolve, reject }
  }

  completePendingRequest(requestId: string, result: T): void {
    const pendingRequest = this.pendingRequests.get(requestId)
    if (pendingRequest) {
      pendingRequest.resolve(result)
      this.pendingRequests.delete(requestId)

      this.completedRequests.set(requestId, {
        result,
        timestamp: Date.now(),
      })
    }
  }

  failPendingRequest(requestId: string, error: unknown): void {
    const pendingRequest = this.pendingRequests.get(requestId)
    if (pendingRequest) {
      pendingRequest.reject(error)
      this.pendingRequests.delete(requestId)
    }
  }

  getUserStatus(userId: string): UserStatus {
    const now = Date.now()
    const userKey = `${this.namespace}:${userId}`
    const record = this.userLimits.get(userKey)

    if (!record || now >= record.resetTime) {
      return {
        requestsRemaining: this.requestsPerMinute,
        resetTime: now + 60 * 1000,
        isLimited: false,
      }
    }

    const remaining = Math.max(0, this.requestsPerMinute - record.count)
    return {
      requestsRemaining: remaining,
      resetTime: record.resetTime,
      isLimited: remaining === 0,
    }
  }

  getStats(): RateLimiterStats {
    return {
      activeUsers: this.userLimits.size,
      pendingRequests: this.pendingRequests.size,
      cachedResults: this.completedRequests.size,
      timestamp: Date.now(),
    }
  }

  private cleanup(): void {
    const now = Date.now()

    for (const [key, record] of this.userLimits.entries()) {
      if (now >= record.resetTime + 60 * 1000) {
        this.userLimits.delete(key)
      }
    }

    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > 5 * 60 * 1000) {
        request.reject(new Error('Request timeout'))
        this.pendingRequests.delete(key)
      }
    }

    for (const [key, result] of this.completedRequests.entries()) {
      if (now - result.timestamp > this.dedupCacheTtl) {
        this.completedRequests.delete(key)
      }
    }
  }
}

export const rateLimiter = new AdvancedRateLimiter()
export default AdvancedRateLimiter
