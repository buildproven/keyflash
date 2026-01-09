import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const store = new Map<string, unknown>()
const mockRedis = {
  get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => {
    store.set(key, value)
    return Promise.resolve('OK')
  }),
  expire: vi.fn(() => Promise.resolve(1)),
  del: vi.fn((key: string) => {
    store.delete(key)
    return Promise.resolve(1)
  }),
}

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function MockRedis() {
    return mockRedis
  }),
}))

describe('UserService monthly reset', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-03-02T12:00:00.000Z'))
    store.clear()
    process.env = { ...originalEnv }
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env = originalEnv
  })

  it('resets keyword usage when monthly reset has passed', async () => {
    const { UserService } = await import('@/lib/user/user-service')
    const service = new UserService()
    const clerkUserId = 'user_123'

    store.set(`user:${clerkUserId}`, {
      clerkUserId,
      email: 'test@example.com',
      tier: 'pro',
      trialStartedAt: '2025-02-01T00:00:00.000Z',
      trialExpiresAt: '2025-02-08T00:00:00.000Z',
      keywordsUsedThisMonth: 1000,
      monthlyResetAt: '2025-03-01T00:00:00.000Z',
      createdAt: '2025-02-01T00:00:00.000Z',
      updatedAt: '2025-02-15T00:00:00.000Z',
    })

    // Note: With TTL-based usage tracking, checkKeywordLimit() reads from
    // the usage:{userId}:{YYYY-MM} key, which doesn't exist for the new month,
    // so it returns 0 (auto-reset via key expiry)
    const result = await service.checkKeywordLimit(clerkUserId)

    expect(result?.used).toBe(0)
    expect(result?.allowed).toBe(true)

    // TTL-based implementation no longer updates UserData.keywordsUsedThisMonth
    // or monthlyResetAt - usage is tracked in separate Redis keys that auto-expire
  })
})
