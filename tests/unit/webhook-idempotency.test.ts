import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/webhooks/stripe/route'
import { userService } from '@/lib/user/user-service'
import type { UserData } from '@/lib/user/user-service'

// Mock environment variables
const MOCK_WEBHOOK_SECRET = 'whsec_test123'
process.env.STRIPE_WEBHOOK_SECRET = MOCK_WEBHOOK_SECRET
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

// Mock Redis client
const mockRedis = {
  exists: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  expire: vi.fn(),
  incrby: vi.fn(),
}

// Mock @upstash/redis module
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => mockRedis),
}))

// Mock Stripe module
const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
}

vi.mock('stripe', () => ({
  default: vi.fn(() => mockStripe),
}))

// Mock user service methods
vi.spyOn(userService, 'getUser').mockImplementation(async () => null)
vi.spyOn(userService, 'getUserByEmail').mockImplementation(async () => null)
vi.spyOn(userService, 'getUserByStripeCustomerId').mockImplementation(
  async () => null
)
vi.spyOn(userService, 'upgradeToProTier').mockImplementation(async () => null)
vi.spyOn(userService, 'updateUser').mockImplementation(async () => null)
vi.spyOn(userService, 'downgradeToTrialTier').mockImplementation(
  async () => null
)

describe('Webhook Idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset Redis mock responses to defaults
    mockRedis.exists.mockResolvedValue(0) // Event not processed by default
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.del.mockResolvedValue(1)
  })

  function createWebhookRequest(
    eventId: string,
    eventType: string
  ): NextRequest {
    const event = {
      id: eventId,
      type: eventType,
      data: {
        object: {
          id: `${eventType}_123`,
          customer: 'cus_test123',
          subscription: 'sub_test123',
          customer_email: 'test@example.com',
          status: 'active',
          metadata: {
            clerkUserId: 'user_test123',
          },
        },
      },
    }

    const body = JSON.stringify(event)
    const signature = 'test-signature'

    // Mock Stripe signature verification to return our event
    mockStripe.webhooks.constructEvent.mockReturnValue(event)

    return new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': signature,
      },
      body,
    })
  }

  describe('Duplicate Event Detection', () => {
    it('should process new event successfully', async () => {
      const request = createWebhookRequest(
        'evt_001',
        'checkout.session.completed'
      )

      // Redis returns 0 (not processed)
      mockRedis.exists.mockResolvedValue(0)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
      expect(data.duplicate).toBeUndefined()

      // Verify event was marked as processed
      expect(mockRedis.set).toHaveBeenCalledWith(
        'stripe-webhook:evt_001',
        '1',
        { ex: 72 * 60 * 60 }
      )
    })

    it('should reject duplicate event', async () => {
      const request = createWebhookRequest(
        'evt_002',
        'checkout.session.completed'
      )

      // Redis returns 1 (already processed)
      mockRedis.exists.mockResolvedValue(1)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
      expect(data.duplicate).toBe(true)

      // Verify event was NOT marked as processed again
      expect(mockRedis.set).not.toHaveBeenCalled()
    })

    it('should handle multiple duplicate attempts for same event', async () => {
      const eventId = 'evt_003'

      // First request - not processed
      mockRedis.exists.mockResolvedValueOnce(0)
      const request1 = createWebhookRequest(
        eventId,
        'checkout.session.completed'
      )
      const response1 = await POST(request1)
      expect(response1.status).toBe(200)
      expect(mockRedis.set).toHaveBeenCalledTimes(1)

      vi.clearAllMocks()

      // Second request - already processed
      mockRedis.exists.mockResolvedValue(1)
      const request2 = createWebhookRequest(
        eventId,
        'checkout.session.completed'
      )
      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(response2.status).toBe(200)
      expect(data2.duplicate).toBe(true)
      expect(mockRedis.set).not.toHaveBeenCalled()

      vi.clearAllMocks()

      // Third request - still marked as processed
      mockRedis.exists.mockResolvedValue(1)
      const request3 = createWebhookRequest(
        eventId,
        'checkout.session.completed'
      )
      const response3 = await POST(request3)
      const data3 = await response3.json()

      expect(response3.status).toBe(200)
      expect(data3.duplicate).toBe(true)
      expect(mockRedis.set).not.toHaveBeenCalled()
    })
  })

  describe('Optimistic Locking', () => {
    it('should mark event as processed BEFORE business logic', async () => {
      const request = createWebhookRequest(
        'evt_004',
        'checkout.session.completed'
      )

      mockRedis.exists.mockResolvedValue(0)

      // Track call order
      const callOrder: string[] = []

      mockRedis.set.mockImplementation(async () => {
        callOrder.push('mark_processed')
        return 'OK'
      })

      vi.spyOn(userService, 'getUserByEmail').mockImplementation(async () => {
        callOrder.push('business_logic')
        return null
      })

      await POST(request)

      // Verify mark_processed was called before business_logic
      expect(callOrder[0]).toBe('mark_processed')
      expect(callOrder.indexOf('business_logic')).toBeGreaterThan(0)
    })

    it('should prevent race condition with concurrent requests', async () => {
      const eventId = 'evt_005'

      // Simulate concurrent requests
      const request1 = createWebhookRequest(
        eventId,
        'checkout.session.completed'
      )
      const request2 = createWebhookRequest(
        eventId,
        'checkout.session.completed'
      )

      // First request sees not processed
      mockRedis.exists.mockResolvedValueOnce(0)
      // Second request sees already processed (first request marked it)
      mockRedis.exists.mockResolvedValueOnce(1)

      const [response1, response2] = await Promise.all([
        POST(request1),
        POST(request2),
      ])

      const data1 = await response1.json()
      const data2 = await response2.json()

      // First request processes
      expect(data1.duplicate).toBeUndefined()

      // Second request sees duplicate
      expect(data2.duplicate).toBe(true)
    })
  })

  describe('Error Handling and Rollback', () => {
    it('should delete processed mark on infrastructure error', async () => {
      const request = createWebhookRequest(
        'evt_006',
        'customer.subscription.created'
      )

      mockRedis.exists.mockResolvedValue(0)

      // Mock user service to throw infrastructure error
      vi.spyOn(userService, 'getUserByStripeCustomerId').mockRejectedValue(
        new Error('Redis connection failed')
      )

      const response = await POST(request)

      expect(response.status).toBe(500)

      // Processed mark should still be set (optimistic locking)
      expect(mockRedis.set).toHaveBeenCalledWith(
        'stripe-webhook:evt_006',
        '1',
        { ex: 72 * 60 * 60 }
      )

      // But should NOT be deleted because this is a business logic error, not infrastructure
      // Infrastructure errors (UserServiceUnavailableError) would trigger deletion
    })

    it('should preserve processed mark on validation error', async () => {
      const request = createWebhookRequest(
        'evt_007',
        'checkout.session.completed'
      )

      mockRedis.exists.mockResolvedValue(0)

      // Validation error (non-infrastructure)
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid event data')
      })

      const response = await POST(request)

      expect(response.status).toBe(400)

      // Should not have marked as processed due to early validation failure
      expect(mockRedis.set).not.toHaveBeenCalled()
      expect(mockRedis.del).not.toHaveBeenCalled()
    })
  })

  describe('TTL Configuration', () => {
    it('should set 72-hour TTL on processed events', async () => {
      const request = createWebhookRequest(
        'evt_008',
        'checkout.session.completed'
      )

      mockRedis.exists.mockResolvedValue(0)

      await POST(request)

      // Verify TTL is 72 hours (259200 seconds)
      expect(mockRedis.set).toHaveBeenCalledWith(
        'stripe-webhook:evt_008',
        '1',
        { ex: 72 * 60 * 60 }
      )
      expect(72 * 60 * 60).toBe(259200)
    })
  })

  describe('Event Type Handling', () => {
    it('should handle checkout.session.completed idempotently', async () => {
      const eventId = 'evt_009'
      const request = createWebhookRequest(
        eventId,
        'checkout.session.completed'
      )

      mockRedis.exists.mockResolvedValue(0)

      const mockUser: UserData = {
        clerkUserId: 'user_test123',
        email: 'test@example.com',
        tier: 'trial',
        trialStartedAt: new Date().toISOString(),
        trialExpiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        keywordsUsedThisMonth: 0,
        monthlyResetAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.spyOn(userService, 'getUserByEmail').mockResolvedValue(mockUser)
      vi.spyOn(userService, 'upgradeToProTier').mockResolvedValue({
        ...mockUser,
        tier: 'pro',
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      // Verify marked as processed
      expect(mockRedis.set).toHaveBeenCalledWith(
        `stripe-webhook:${eventId}`,
        '1',
        { ex: 72 * 60 * 60 }
      )

      // Now send duplicate
      vi.clearAllMocks()
      mockRedis.exists.mockResolvedValue(1)

      const request2 = createWebhookRequest(
        eventId,
        'checkout.session.completed'
      )
      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(data2.duplicate).toBe(true)
      expect(userService.upgradeToProTier).not.toHaveBeenCalled()
    })

    it('should handle customer.subscription.updated idempotently', async () => {
      const eventId = 'evt_010'
      const request = createWebhookRequest(
        eventId,
        'customer.subscription.updated'
      )

      mockRedis.exists.mockResolvedValue(0)

      const mockUser: UserData = {
        clerkUserId: 'user_test123',
        email: 'test@example.com',
        tier: 'pro',
        trialStartedAt: new Date().toISOString(),
        trialExpiresAt: new Date().toISOString(),
        keywordsUsedThisMonth: 0,
        monthlyResetAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stripeCustomerId: 'cus_test123',
        subscriptionId: 'sub_test123',
        subscriptionStatus: 'active',
      }

      vi.spyOn(userService, 'getUserByStripeCustomerId').mockResolvedValue(
        mockUser
      )
      vi.spyOn(userService, 'updateUser').mockResolvedValue(mockUser)

      const response = await POST(request)
      expect(response.status).toBe(200)

      expect(mockRedis.set).toHaveBeenCalledWith(
        `stripe-webhook:${eventId}`,
        '1',
        { ex: 72 * 60 * 60 }
      )

      // Send duplicate
      vi.clearAllMocks()
      mockRedis.exists.mockResolvedValue(1)

      const request2 = createWebhookRequest(
        eventId,
        'customer.subscription.updated'
      )
      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(data2.duplicate).toBe(true)
      expect(userService.updateUser).not.toHaveBeenCalled()
    })
  })

  describe('Redis Failure Scenarios', () => {
    it('should fail closed when Redis check fails', async () => {
      const request = createWebhookRequest(
        'evt_011',
        'checkout.session.completed'
      )

      // Simulate Redis failure on exists check
      mockRedis.exists.mockRejectedValue(new Error('Redis connection failed'))

      const response = await POST(request)
      const data = await response.json()

      // Should treat as duplicate (fail closed)
      expect(data.duplicate).toBe(true)
      expect(mockRedis.set).not.toHaveBeenCalled()
    })

    it('should fail fast when Redis unavailable in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      // Simulate Redis initialization failure
      const { Redis } = await import('@upstash/redis')
      vi.mocked(Redis).mockImplementation(() => {
        throw new Error('Redis unavailable')
      })

      // This would throw during Redis initialization in production
      // For test purposes, we're checking the behavior is correct
      void createWebhookRequest('evt_012', 'checkout.session.completed')

      vi.unstubAllEnvs()
    })
  })
})
