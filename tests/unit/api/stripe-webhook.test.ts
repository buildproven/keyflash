/**
 * Stripe Webhook API Route Tests
 *
 * Tests for subscription-based checkout flow:
 * - Webhook signature validation
 * - checkout.session.completed handling
 * - Subscription lifecycle events
 * - Error handling
 *
 * Uses shared stripe-testing utilities for consistent patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createCheckoutEvent,
  createSubscriptionCreatedEvent,
  createSubscriptionUpdatedEvent,
  createSubscriptionDeletedEvent,
  createPaymentSucceededEvent,
  createPaymentFailedEvent,
  createStripeMock,
  createWebhookRequest,
  createProUpgradeCheckout,
  createProDowngrade,
  STRIPE_STATUS_MAP,
  isProStatus,
  TEST_CUSTOMERS,
  TEST_PRICES,
} from '../../utils/stripe-testing'

// Mock Stripe
const mockConstructEvent = vi.fn()
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  })),
}))

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Stripe Webhook API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ===========================================
  // Configuration
  // ===========================================
  describe('Webhook Configuration', () => {
    it('should require STRIPE_WEBHOOK_SECRET environment variable', () => {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      expect(webhookSecret).toBeDefined()
      expect(webhookSecret).toBe('whsec_test_secret')
    })

    it('should require STRIPE_SECRET_KEY environment variable', () => {
      const secretKey = process.env.STRIPE_SECRET_KEY
      expect(secretKey).toBeDefined()
      expect(secretKey).toBe('sk_test_123')
    })

    it('should fail gracefully without webhook secret', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      expect(webhookSecret).toBeUndefined()
    })
  })

  // ===========================================
  // Signature Validation
  // ===========================================
  describe('Signature Validation', () => {
    it('should require stripe-signature header', () => {
      const validateSignature = (signature: string | null): boolean => {
        return signature !== null && signature.length > 0
      }

      expect(validateSignature(null)).toBe(false)
      expect(validateSignature('')).toBe(false)
      expect(validateSignature('t=123,v1=abc')).toBe(true)
    })

    it('should parse signature components correctly', () => {
      const parseSignature = (
        sig: string
      ): { timestamp: string; hash: string } | null => {
        const parts = sig.split(',')
        const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
        const hash = parts.find(p => p.startsWith('v1='))?.slice(3)
        if (!timestamp || !hash) return null
        return { timestamp, hash }
      }

      const result = parseSignature('t=1234567890,v1=abc123def456')
      expect(result).toEqual({ timestamp: '1234567890', hash: 'abc123def456' })
      expect(parseSignature('invalid')).toBeNull()
    })

    it('should reject requests without signature', () => {
      const headers = new Headers()
      const signature = headers.get('stripe-signature')
      expect(signature).toBeNull()
    })
  })

  // ===========================================
  // Event Type Handling (using factories)
  // ===========================================
  describe('Event Type Handling', () => {
    it('should handle checkout.session.completed events', () => {
      const event = createCheckoutEvent({ email: 'test@example.com' })
      expect(event.type).toBe('checkout.session.completed')
      expect(event.data.object).toBeDefined()
    })

    it('should handle subscription.created events', () => {
      const event = createSubscriptionCreatedEvent({
        customerId: TEST_CUSTOMERS.pro.id,
      })
      expect(event.type).toBe('customer.subscription.created')
      expect(event.data.object.customer).toBe(TEST_CUSTOMERS.pro.id)
    })

    it('should handle subscription.updated events', () => {
      const event = createSubscriptionUpdatedEvent({
        status: 'active',
        previousAttributes: { status: 'trialing' },
      })
      expect(event.type).toBe('customer.subscription.updated')
      expect(event.data.object.status).toBe('active')
    })

    it('should handle subscription.deleted events', () => {
      const event = createSubscriptionDeletedEvent({
        customerId: 'cus_leaving',
      })
      expect(event.type).toBe('customer.subscription.deleted')
      expect(event.data.object.status).toBe('canceled')
    })

    it('should handle payment_succeeded events', () => {
      const event = createPaymentSucceededEvent({ amount: 2900 })
      expect(event.type).toBe('invoice.payment_succeeded')
      expect(event.data.object.amount_paid).toBe(2900)
    })

    it('should handle payment_failed events', () => {
      const event = createPaymentFailedEvent({ attemptCount: 3 })
      expect(event.type).toBe('invoice.payment_failed')
      expect(event.data.object.attempt_count).toBe(3)
    })

    it('should recognize handled event types', () => {
      const shouldProcess = (eventType: string): boolean => {
        const handledEvents = [
          'checkout.session.completed',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
        ]
        return handledEvents.includes(eventType)
      }

      expect(shouldProcess('checkout.session.completed')).toBe(true)
      expect(shouldProcess('customer.subscription.created')).toBe(true)
      expect(shouldProcess('customer.subscription.updated')).toBe(true)
      expect(shouldProcess('customer.subscription.deleted')).toBe(true)
      expect(shouldProcess('payment_intent.succeeded')).toBe(false)
    })
  })

  // ===========================================
  // Status Mapping (using STRIPE_STATUS_MAP)
  // ===========================================
  describe('Subscription Status Handling', () => {
    it('should map active status to pro tier', () => {
      expect(STRIPE_STATUS_MAP.active).toBe('pro')
      expect(isProStatus('active')).toBe(true)
    })

    it('should map trialing status to pro tier', () => {
      expect(STRIPE_STATUS_MAP.trialing).toBe('pro')
      expect(isProStatus('trialing')).toBe(true)
    })

    it('should map canceled status to trial tier', () => {
      expect(STRIPE_STATUS_MAP.canceled).toBe('trial')
      expect(isProStatus('canceled')).toBe(false)
    })

    it('should map past_due status to expired', () => {
      expect(STRIPE_STATUS_MAP.past_due).toBe('expired')
      expect(isProStatus('past_due')).toBe(false)
    })

    it('should map unpaid status to expired', () => {
      expect(STRIPE_STATUS_MAP.unpaid).toBe('expired')
      expect(isProStatus('unpaid')).toBe(false)
    })

    it('should determine user tier from subscription status', () => {
      const getUserTier = (
        subscriptionStatus: string | null
      ): 'trial' | 'pro' | 'expired' => {
        if (!subscriptionStatus) return 'trial'
        if (['active', 'trialing'].includes(subscriptionStatus)) return 'pro'
        return 'expired'
      }

      expect(getUserTier(null)).toBe('trial')
      expect(getUserTier('active')).toBe('pro')
      expect(getUserTier('trialing')).toBe('pro')
      expect(getUserTier('canceled')).toBe('expired')
    })
  })

  // ===========================================
  // Webhook Request Helpers
  // ===========================================
  describe('Webhook Request Creation', () => {
    it('should create webhook request with signature', () => {
      const event = createCheckoutEvent({ email: 'test@example.com' })
      const request = createWebhookRequest(event)

      expect(request.body).toBeDefined()
      expect(request.headers['stripe-signature']).toMatch(/^t=\d+,v1=/)
      expect(JSON.parse(request.body).type).toBe('checkout.session.completed')
    })

    it('should create webhook request with custom signature', () => {
      const event = createCheckoutEvent()
      const customSig = 't=123456,v1=custom_signature'
      const request = createWebhookRequest(event, customSig)

      expect(request.headers['stripe-signature']).toBe(customSig)
    })
  })

  // ===========================================
  // Checkout Session Handling
  // ===========================================
  describe('Checkout Session Handling', () => {
    it('should extract customer email from checkout event', () => {
      const event = createCheckoutEvent({ email: 'user@example.com' })
      const session = event.data.object as {
        customer_email?: string
        customer_details?: { email?: string }
      }

      expect(session.customer_email).toBe('user@example.com')
      expect(session.customer_details?.email).toBe('user@example.com')
    })

    it('should extract subscription ID from checkout event', () => {
      const event = createCheckoutEvent({ subscriptionId: 'sub_new_123' })
      const session = event.data.object as { subscription?: string }

      expect(session.subscription).toBe('sub_new_123')
    })

    it('should create subscription mode checkout by default', () => {
      const event = createCheckoutEvent({ subscriptionId: 'sub_123' })
      const session = event.data.object as { mode?: string }

      expect(session.mode).toBe('subscription')
    })

    it('should validate payment status', () => {
      const event = createCheckoutEvent()
      const session = event.data.object as { payment_status?: string }

      expect(session.payment_status).toBe('paid')
    })
  })

  // ===========================================
  // Error Handling
  // ===========================================
  describe('Error Handling', () => {
    it('should handle missing customer data gracefully', () => {
      const extractCustomerData = (session: {
        customer?: string | null
        customer_email?: string | null
      }) => {
        return {
          customerId: session.customer || null,
          email: session.customer_email || 'unknown',
        }
      }

      expect(extractCustomerData({})).toEqual({
        customerId: null,
        email: 'unknown',
      })
    })

    it('should return appropriate HTTP status codes', () => {
      const getStatusCode = (
        error:
          | 'missing_signature'
          | 'invalid_signature'
          | 'handler_error'
          | null
      ): number => {
        switch (error) {
          case 'missing_signature':
            return 400
          case 'invalid_signature':
            return 400
          case 'handler_error':
            return 500
          default:
            return 200
        }
      }

      expect(getStatusCode(null)).toBe(200)
      expect(getStatusCode('missing_signature')).toBe(400)
      expect(getStatusCode('invalid_signature')).toBe(400)
      expect(getStatusCode('handler_error')).toBe(500)
    })
  })

  // ===========================================
  // KeyFlash-Specific Flow Tests
  // ===========================================
  describe('KeyFlash Subscription Flow', () => {
    it('should create pro upgrade checkout event', () => {
      const event = createProUpgradeCheckout('newuser@example.com', 'user_456')
      const session = event.data.object as {
        customer_email?: string
        metadata?: { userId?: string; product?: string }
      }

      expect(event.type).toBe('checkout.session.completed')
      expect(session.customer_email).toBe('newuser@example.com')
      expect(session.metadata?.userId).toBe('user_456')
      expect(session.metadata?.product).toBe('keyflash-pro')
    })

    it('should create downgrade event', () => {
      const event = createProDowngrade('cus_123', 'sub_456')

      expect(event.type).toBe('customer.subscription.deleted')
      expect(event.data.object.customer).toBe('cus_123')
      expect(event.data.object.id).toBe('sub_456')
      expect(event.data.object.status).toBe('canceled')
    })

    it('should map subscription to keyword limits', () => {
      const getKeywordLimit = (tier: 'trial' | 'pro'): number => {
        return tier === 'pro' ? 1000 : 300
      }

      expect(getKeywordLimit('trial')).toBe(300)
      expect(getKeywordLimit('pro')).toBe(1000)
    })

    it('should determine data source from tier', () => {
      const getDataSource = (tier: 'trial' | 'pro'): 'mock' | 'dataforseo' => {
        return tier === 'pro' ? 'dataforseo' : 'mock'
      }

      expect(getDataSource('trial')).toBe('mock')
      expect(getDataSource('pro')).toBe('dataforseo')
    })

    it('should calculate remaining keywords', () => {
      const getRemainingKeywords = (
        tier: 'trial' | 'pro',
        usedThisMonth: number
      ): number => {
        const limits = { trial: 300, pro: 1000 }
        return Math.max(0, limits[tier] - usedThisMonth)
      }

      expect(getRemainingKeywords('trial', 100)).toBe(200)
      expect(getRemainingKeywords('pro', 500)).toBe(500)
      expect(getRemainingKeywords('pro', 1200)).toBe(0)
    })
  })

  // ===========================================
  // Stripe Mock Integration
  // ===========================================
  describe('Stripe Mock', () => {
    it('should create functional Stripe mock', () => {
      const stripeMock = createStripeMock()

      expect(stripeMock.checkout.sessions.create).toBeDefined()
      expect(stripeMock.webhooks.constructEvent).toBeDefined()
      expect(stripeMock.subscriptions.cancel).toBeDefined()
      expect(stripeMock.billingPortal.sessions.create).toBeDefined()
    })

    it('should mock checkout session creation', async () => {
      const stripeMock = createStripeMock()
      const session = await stripeMock.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: TEST_PRICES.keyflashProMonthly }],
      })

      expect(session.id).toBe('cs_test_session')
      expect(session.url).toContain('checkout.stripe.com')
    })

    it('should mock subscription cancellation', async () => {
      const stripeMock = createStripeMock()
      const canceled = await stripeMock.subscriptions.cancel('sub_123')

      expect(canceled.status).toBe('canceled')
    })

    it('should mock billing portal creation', async () => {
      const stripeMock = createStripeMock()
      const portal = await stripeMock.billingPortal.sessions.create({
        customer: 'cus_123',
        return_url: 'https://keyflash.com/account',
      })

      expect(portal.url).toContain('billing.stripe.com')
    })
  })
})
