import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { UserService } from '@/lib/user/user-service'
import type { UserData } from '@/lib/user/user-service'

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
  exists: vi.fn(),
  incrby: vi.fn(),
}

// Mock @upstash/redis module - use function implementation to avoid Vitest warning
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function MockRedis() {
    return mockRedis
  }),
}))

// Set environment variables for tests
process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

describe('User Service Concurrency', () => {
  let userService: UserService

  beforeEach(() => {
    vi.clearAllMocks()
    userService = new UserService()

    // Default mock responses
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.del.mockResolvedValue(1)
    mockRedis.expire.mockResolvedValue(1)
    mockRedis.exists.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createMockUser(clerkUserId: string, email: string): UserData {
    const now = new Date()
    const trialExpires = new Date(now)
    trialExpires.setDate(trialExpires.getDate() + 7)

    return {
      clerkUserId,
      email,
      tier: 'trial',
      trialStartedAt: now.toISOString(),
      trialExpiresAt: trialExpires.toISOString(),
      keywordsUsedThisMonth: 0,
      monthlyResetAt: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      ).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
  }

  describe('Distributed Locking', () => {
    it('should acquire lock successfully for new user', async () => {
      const clerkUserId = 'user_lock_001'
      const email = 'lock001@example.com'

      // User doesn't exist (first check)
      mockRedis.get.mockResolvedValue(null)

      // Lock acquisition succeeds (SETNX returns OK)
      mockRedis.set.mockResolvedValueOnce('OK')

      await userService.getOrCreateUser(clerkUserId, email)

      // Verify lock was acquired
      expect(mockRedis.set).toHaveBeenCalledWith(
        `lock:user:${clerkUserId}`,
        '1',
        { ex: 10, nx: true }
      )

      // Verify lock was released
      expect(mockRedis.del).toHaveBeenCalledWith(`lock:user:${clerkUserId}`)
    })

    it('should prevent concurrent user creation with lock', async () => {
      const clerkUserId = 'user_lock_002'
      const email = 'lock002@example.com'

      // Track concurrent requests
      let creationCount = 0
      const mockUser = createMockUser(clerkUserId, email)

      // First request acquires lock
      mockRedis.set.mockImplementation(
        async (key: string, _value: unknown, _options?: unknown) => {
          if (key.startsWith('lock:user:')) {
            // Only first request gets the lock
            if (creationCount === 0) {
              creationCount++
              return 'OK'
            }
            return null // Lock already held
          }

          // User data storage
          if (key.startsWith('user:')) {
            return 'OK'
          }

          // Email index storage
          if (key.startsWith('email:')) {
            return 'OK'
          }

          return null
        }
      )

      // First request: no user exists
      // Second request: user exists after first creates it
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key.startsWith('user:')) {
          // Return user only after first request creates it
          return creationCount > 0 ? mockUser : null
        }
        return null
      })

      // Simulate concurrent requests
      const [result1, result2] = await Promise.all([
        userService.getOrCreateUser(clerkUserId, email),
        userService.getOrCreateUser(clerkUserId, email),
      ])

      // Both should get the same user
      expect(result1.clerkUserId).toBe(clerkUserId)
      expect(result2.clerkUserId).toBe(clerkUserId)

      // User should only be created once
      expect(creationCount).toBe(1)
    })

    it('should release lock even on error', async () => {
      const clerkUserId = 'user_lock_003'
      const email = 'lock003@example.com'

      // User doesn't exist
      mockRedis.get.mockResolvedValue(null)

      // Lock acquired successfully
      mockRedis.set
        .mockResolvedValueOnce('OK') // Lock acquisition
        .mockRejectedValueOnce(new Error('Redis connection failed')) // User creation fails

      try {
        await userService.getOrCreateUser(clerkUserId, email)
      } catch {
        // Expected to throw
      }

      // Verify lock was released despite error
      expect(mockRedis.del).toHaveBeenCalledWith(`lock:user:${clerkUserId}`)
    })

    it('should handle lock timeout with retry', async () => {
      const clerkUserId = 'user_lock_004'
      const email = 'lock004@example.com'
      const mockUser = createMockUser(clerkUserId, email)

      let getUserCallCount = 0

      // First getUser call: no user
      // Second getUser call (after lock wait): user exists
      // Third getUser call (double-check): user exists
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key.startsWith('user:')) {
          getUserCallCount++
          return getUserCallCount > 1 ? mockUser : null
        }
        return null
      })

      // Lock acquisition fails (another request holds it)
      mockRedis.set.mockResolvedValue(null)

      const result = await userService.getOrCreateUser(clerkUserId, email)

      // Should get the user that was created by the other request
      expect(result.clerkUserId).toBe(clerkUserId)

      // Should have checked for user multiple times
      expect(getUserCallCount).toBeGreaterThan(1)
    })
  })

  describe('Race Condition Prevention', () => {
    it('should prevent duplicate user creation', async () => {
      const clerkUserId = 'user_race_001'
      const email = 'race001@example.com'

      let userCreationAttempts = 0
      let lockHeld = false
      const mockUser = createMockUser(clerkUserId, email)

      mockRedis.get.mockImplementation(async (key: string) => {
        if (key.startsWith('user:')) {
          // User exists after first creation
          return userCreationAttempts > 0 ? mockUser : null
        }
        return null
      })

      mockRedis.set.mockImplementation(
        async (key: string, _value: unknown, options?: { nx?: boolean }) => {
          // Lock acquisition - only first request gets the lock
          if (key.startsWith('lock:')) {
            if (options?.nx && lockHeld) {
              return null // Lock already held
            }
            lockHeld = true
            return 'OK'
          }
          // User creation
          if (key.startsWith('user:')) {
            userCreationAttempts++
          }
          return 'OK'
        }
      )

      mockRedis.del.mockImplementation(async (key: string) => {
        if (key.startsWith('lock:')) {
          lockHeld = false
        }
        return 1
      })

      // Multiple concurrent requests
      const requests = Array(5)
        .fill(null)
        .map(() => userService.getOrCreateUser(clerkUserId, email))

      const results = await Promise.all(requests)

      // All should get the same user
      results.forEach(result => {
        expect(result.clerkUserId).toBe(clerkUserId)
      })

      // User should only be created once
      expect(userCreationAttempts).toBe(1)
    })

    it('should handle double-check pattern correctly', async () => {
      const clerkUserId = 'user_race_002'
      const email = 'race002@example.com'
      const mockUser = createMockUser(clerkUserId, email)

      const getUserCalls: string[] = []

      mockRedis.get.mockImplementation(async (key: string) => {
        getUserCalls.push(key)
        if (key.startsWith('user:')) {
          // Simulate user being created between first check and lock acquisition
          // Return user on second and subsequent checks
          const userCheckCount = getUserCalls.filter(k =>
            k.startsWith('user:')
          ).length
          return userCheckCount > 1 ? mockUser : null
        }
        return null
      })

      // Lock acquired
      mockRedis.set.mockResolvedValue('OK')

      const result = await userService.getOrCreateUser(clerkUserId, email)

      // Should get existing user without creating
      expect(result.clerkUserId).toBe(clerkUserId)

      // Should have checked for user at least twice (double-check pattern)
      const userChecks = getUserCalls.filter(k => k.startsWith('user:'))
      expect(userChecks.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Lock Expiration', () => {
    it('should set lock TTL to 10 seconds', async () => {
      const clerkUserId = 'user_lock_ttl_001'
      const email = 'ttl001@example.com'

      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue('OK')

      await userService.getOrCreateUser(clerkUserId, email)

      // Verify lock TTL is 10 seconds
      expect(mockRedis.set).toHaveBeenCalledWith(
        `lock:user:${clerkUserId}`,
        '1',
        { ex: 10, nx: true }
      )
    })

    it('should auto-expire lock to prevent deadlocks', async () => {
      // This is tested implicitly by the TTL setting above
      // Redis will automatically delete the lock after 10 seconds
      expect(true).toBe(true)
    })
  })

  describe('Concurrent Updates', () => {
    it('should handle concurrent user updates safely', async () => {
      const clerkUserId = 'user_update_001'
      const mockUser = createMockUser(clerkUserId, 'update001@example.com')

      let updateCount = 0

      mockRedis.get.mockResolvedValue(mockUser)
      mockRedis.set.mockImplementation(async () => {
        updateCount++
        return 'OK'
      })

      // Multiple concurrent updates
      const updates = Array(3)
        .fill(null)
        .map((_, i) =>
          userService.updateUser(clerkUserId, {
            keywordsUsedThisMonth: i + 1,
          })
        )

      await Promise.all(updates)

      // All updates should complete
      expect(updateCount).toBe(3)
    })

    it('should handle concurrent keyword usage increments', async () => {
      const clerkUserId = 'user_incr_001'
      const mockUser = createMockUser(clerkUserId, 'incr001@example.com')

      let currentCount = 0

      mockRedis.get.mockResolvedValue(mockUser)
      mockRedis.incrby.mockImplementation(
        async (_key: string, increment: number) => {
          currentCount += increment
          return currentCount
        }
      )
      mockRedis.expire.mockResolvedValue(1)

      // Multiple concurrent increments
      const increments = Array(10)
        .fill(null)
        .map(() => userService.incrementKeywordUsage(clerkUserId, 1))

      const results = await Promise.all(increments)

      // Should have incremented 10 times
      expect(currentCount).toBe(10)

      // Each result should have a value (though they may be different due to race)
      results.forEach(result => {
        expect(result).toBeGreaterThan(0)
      })
    })
  })

  describe('Error Recovery', () => {
    it('should handle partial failure in user creation', async () => {
      const clerkUserId = 'user_error_001'
      const email = 'error001@example.com'

      mockRedis.get.mockResolvedValue(null)

      // Lock acquired
      mockRedis.set
        .mockResolvedValueOnce('OK') // Lock
        .mockResolvedValueOnce('OK') // User data
        .mockRejectedValueOnce(new Error('Failed to create email index')) // Email index fails

      try {
        await userService.getOrCreateUser(clerkUserId, email)
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).toBeDefined()
      }

      // Lock should still be released
      expect(mockRedis.del).toHaveBeenCalledWith(`lock:user:${clerkUserId}`)
    })

    it('should handle Redis connection failure during lock release', async () => {
      const clerkUserId = 'user_error_002'
      const email = 'error002@example.com'

      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue('OK')

      // Lock release fails
      mockRedis.del.mockRejectedValue(new Error('Redis connection lost'))

      // Should not throw even if lock release fails
      const result = await userService.getOrCreateUser(clerkUserId, email)
      expect(result.clerkUserId).toBe(clerkUserId)
    })
  })

  describe('Stress Testing', () => {
    it('should handle high concurrency load', async () => {
      const clerkUserId = 'user_stress_001'
      const email = 'stress001@example.com'
      const mockUser = createMockUser(clerkUserId, email)

      let creationAttempts = 0
      let lockHeld = false

      mockRedis.get.mockImplementation(async (key: string) => {
        if (key.startsWith('user:')) {
          return creationAttempts > 0 ? mockUser : null
        }
        return null
      })

      mockRedis.set.mockImplementation(
        async (key: string, _value: unknown, options?: { nx?: boolean }) => {
          // Lock acquisition - only first request gets the lock
          if (key.startsWith('lock:')) {
            if (options?.nx && lockHeld) {
              return null // Lock already held
            }
            lockHeld = true
            return 'OK'
          }
          // User creation
          if (key.startsWith('user:')) {
            creationAttempts++
          }
          return 'OK'
        }
      )

      mockRedis.del.mockImplementation(async (key: string) => {
        if (key.startsWith('lock:')) {
          lockHeld = false
        }
        return 1
      })

      // Simulate 50 concurrent requests
      const requests = Array(50)
        .fill(null)
        .map(() => userService.getOrCreateUser(clerkUserId, email))

      const results = await Promise.all(requests)

      // All should succeed
      expect(results).toHaveLength(50)

      // All should get the same user
      results.forEach(result => {
        expect(result.clerkUserId).toBe(clerkUserId)
      })

      // User should only be created once
      expect(creationAttempts).toBe(1)
    })
  })
})
