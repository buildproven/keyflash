/**
 * Stripe Test Utilities
 *
 * Reusable mocks, factories, and fixtures for testing Stripe integrations.
 * Mirrors @vbl/shared/stripe/testing for consistency across VBL projects.
 *
 * @example
 * ```typescript
 * import { createStripeMock, createCheckoutEvent, TEST_CUSTOMERS } from '@/tests/utils/stripe-testing'
 *
 * // In your test file
 * vi.mock('stripe', () => ({
 *   default: vi.fn().mockImplementation(() => createStripeMock())
 * }))
 *
 * // Create test events
 * const event = createCheckoutEvent({
 *   email: 'test@example.com',
 *   customerId: 'cus_123'
 * })
 * ```
 */

import { vi, expect } from 'vitest'
import type Stripe from 'stripe'

// ============================================
// Test Data
// ============================================

export const TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  insufficientFunds: '4000000000009995',
  requires3DS: '4000002760003184',
} as const

export const TEST_CUSTOMERS = {
  trial: {
    id: 'cus_test_trial',
    email: 'trial@test.com',
    name: 'Trial User',
  },
  pro: {
    id: 'cus_test_pro',
    email: 'pro@test.com',
    name: 'Pro User',
  },
} as const

export const TEST_PRICES = {
  keyflashProMonthly: 'price_keyflash_pro_monthly',
  keyflashProAnnual: 'price_keyflash_pro_annual',
} as const

// ============================================
// Mock Factories
// ============================================

type MockFn = ReturnType<typeof vi.fn<(...args: any[]) => any>>

export interface StripeMock {
  checkout: {
    sessions: {
      create: MockFn
      retrieve: MockFn
    }
  }
  webhooks: {
    constructEvent: MockFn
  }
  customers: {
    create: MockFn
    retrieve: MockFn
  }
  subscriptions: {
    create: MockFn
    retrieve: MockFn
    update: MockFn
    cancel: MockFn
  }
  billingPortal: {
    sessions: {
      create: MockFn
    }
  }
}

/**
 * Create a mock Stripe client for unit tests
 */
export function createStripeMock(
  overrides: Partial<StripeMock> = {}
): StripeMock {
  const mockSubscription = {
    id: 'sub_test',
    status: 'active',
    customer: TEST_CUSTOMERS.pro.id,
    cancel_at_period_end: false,
    items: {
      data: [{ id: 'si_test', price: { id: TEST_PRICES.keyflashProMonthly } }],
    },
  }

  return {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'cs_test_session',
          url: 'https://checkout.stripe.com/test',
          mode: 'subscription',
          customer: TEST_CUSTOMERS.pro.id,
          subscription: 'sub_test',
        }),
        retrieve: vi.fn().mockResolvedValue({
          id: 'cs_test_session',
          payment_status: 'paid',
          status: 'complete',
        }),
      },
    },
    webhooks: {
      constructEvent: vi.fn().mockImplementation(payload => {
        return JSON.parse(payload)
      }),
    },
    customers: {
      create: vi.fn().mockResolvedValue(TEST_CUSTOMERS.pro),
      retrieve: vi.fn().mockResolvedValue(TEST_CUSTOMERS.pro),
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue(mockSubscription),
      retrieve: vi.fn().mockResolvedValue(mockSubscription),
      update: vi.fn().mockResolvedValue(mockSubscription),
      cancel: vi
        .fn()
        .mockResolvedValue({ ...mockSubscription, status: 'canceled' }),
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'bps_test',
          url: 'https://billing.stripe.com/test',
        }),
      },
    },
    ...overrides,
  }
}

// ============================================
// Event Factories
// ============================================

export interface EventFactoryOptions {
  userId?: string
  customerId?: string
  subscriptionId?: string
  priceId?: string
  status?: Stripe.Subscription.Status
  email?: string
  metadata?: Record<string, string>
}

const defaultEventOptions: EventFactoryOptions = {
  userId: 'user_123',
  customerId: 'cus_test_123',
  subscriptionId: 'sub_test_123',
  priceId: TEST_PRICES.keyflashProMonthly,
  status: 'active',
  email: 'test@example.com',
}

/**
 * Helper to create base event structure
 */
function createBaseEvent<T extends string>(type: T, eventId?: string) {
  return {
    id: eventId || `evt_${type.replace(/\./g, '_')}_${Date.now()}`,
    type: type as T,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    api_version: '2024-12-18.acacia' as const,
    object: 'event' as const,
  }
}

/**
 * Helper to create a mock subscription object
 */
function createMockSubscriptionObject(
  options: EventFactoryOptions
): Stripe.Subscription {
  return {
    id: options.subscriptionId || 'sub_test_123',
    customer: options.customerId || 'cus_test_123',
    status: options.status || 'active',
    cancel_at_period_end: false,
    items: {
      data: [
        {
          id: 'si_test_123',
          price: { id: options.priceId || TEST_PRICES.keyflashProMonthly },
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      ],
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
    },
    metadata: {
      userId: options.userId || 'user_123',
      ...(options.metadata || {}),
    },
  } as unknown as Stripe.Subscription
}

/**
 * Create a checkout.session.completed event
 */
export function createCheckoutEvent(
  options: EventFactoryOptions & {
    product?: string
    amount?: number
    currency?: string
    sessionId?: string
    mode?: 'payment' | 'subscription'
  } = {}
): Stripe.Event {
  const opts = { ...defaultEventOptions, ...options }

  return {
    ...createBaseEvent('checkout.session.completed'),
    data: {
      object: {
        id: options.sessionId || 'cs_test_123',
        mode:
          options.mode || (opts.subscriptionId ? 'subscription' : 'payment'),
        customer: opts.customerId,
        subscription: opts.subscriptionId,
        customer_details: {
          email: opts.email,
          name: 'Test Customer',
        },
        customer_email: opts.email,
        payment_status: 'paid',
        status: 'complete',
        amount_total: options.amount || 2900,
        currency: options.currency || 'usd',
        metadata: {
          userId: opts.userId,
          product: options.product || 'keyflash-pro',
          ...(opts.metadata || {}),
        },
      },
    },
  } as unknown as Stripe.Event
}

/**
 * Create a customer.subscription.created event
 */
export function createSubscriptionCreatedEvent(
  options: EventFactoryOptions = {}
): Stripe.Event {
  const opts = { ...defaultEventOptions, ...options }
  return {
    ...createBaseEvent('customer.subscription.created'),
    data: {
      object: createMockSubscriptionObject(opts),
    },
  } as unknown as Stripe.Event
}

/**
 * Create a customer.subscription.updated event
 */
export function createSubscriptionUpdatedEvent(
  options: EventFactoryOptions & {
    previousAttributes?: Record<string, unknown>
  } = {}
): Stripe.Event {
  const opts = { ...defaultEventOptions, ...options }
  return {
    ...createBaseEvent('customer.subscription.updated'),
    data: {
      object: createMockSubscriptionObject(opts),
      previous_attributes: options.previousAttributes || {},
    },
  } as unknown as Stripe.Event
}

/**
 * Create a customer.subscription.deleted event
 */
export function createSubscriptionDeletedEvent(
  options: EventFactoryOptions = {}
): Stripe.Event {
  const opts = {
    ...defaultEventOptions,
    ...options,
    status: 'canceled' as const,
  }
  return {
    ...createBaseEvent('customer.subscription.deleted'),
    data: {
      object: createMockSubscriptionObject(opts),
    },
  } as unknown as Stripe.Event
}

/**
 * Create an invoice.payment_succeeded event
 */
export function createPaymentSucceededEvent(
  options: EventFactoryOptions & { amount?: number } = {}
): Stripe.Event {
  const opts = { ...defaultEventOptions, ...options }
  return {
    ...createBaseEvent('invoice.payment_succeeded'),
    data: {
      object: {
        id: 'in_test_123',
        customer: opts.customerId,
        subscription: opts.subscriptionId,
        status: 'paid',
        amount_paid: options.amount || 2900,
        currency: 'usd',
      },
    },
  } as unknown as Stripe.Event
}

/**
 * Create an invoice.payment_failed event
 */
export function createPaymentFailedEvent(
  options: EventFactoryOptions & { attemptCount?: number } = {}
): Stripe.Event {
  const opts = { ...defaultEventOptions, ...options }
  return {
    ...createBaseEvent('invoice.payment_failed'),
    data: {
      object: {
        id: 'in_test_123',
        customer: opts.customerId,
        subscription: opts.subscriptionId,
        status: 'open',
        attempt_count: options.attemptCount || 1,
      },
    },
  } as unknown as Stripe.Event
}

// ============================================
// Status Mapping
// ============================================

/**
 * Map Stripe subscription status to KeyFlash tier
 */
export const STRIPE_STATUS_MAP: Record<
  Stripe.Subscription.Status,
  'trial' | 'pro' | 'expired'
> = {
  active: 'pro',
  trialing: 'pro',
  past_due: 'expired',
  canceled: 'trial',
  incomplete: 'trial',
  incomplete_expired: 'expired',
  unpaid: 'expired',
  paused: 'expired',
}

/**
 * Check if subscription status grants Pro access
 */
export function isProStatus(status: Stripe.Subscription.Status): boolean {
  return ['active', 'trialing'].includes(status)
}

// ============================================
// Test Helpers
// ============================================

/**
 * Generate a valid Stripe signature for testing
 */
export function generateTestSignature(
  _payload: string,
  timestamp = Math.floor(Date.now() / 1000)
): string {
  return `t=${timestamp},v1=test_signature_${timestamp}`
}

/**
 * Create a mock webhook request
 */
export function createWebhookRequest(
  event: Stripe.Event,
  signature?: string
): {
  body: string
  headers: { 'stripe-signature': string }
} {
  const body = JSON.stringify(event)
  return {
    body,
    headers: {
      'stripe-signature': signature || generateTestSignature(body),
    },
  }
}

/**
 * Assert checkout session was created with expected params
 */
export function assertCheckoutCreated(
  mock: ReturnType<typeof vi.fn>,
  expected: {
    priceId?: string
    mode?: 'payment' | 'subscription'
    email?: string
    metadata?: Record<string, string>
  }
): void {
  expect(mock).toHaveBeenCalled()
  const call = mock.mock.calls[0][0]

  if (expected.priceId) {
    expect(call.line_items[0].price).toBe(expected.priceId)
  }
  if (expected.mode) {
    expect(call.mode).toBe(expected.mode)
  }
  if (expected.email) {
    expect(call.customer_email).toBe(expected.email)
  }
  if (expected.metadata) {
    expect(call.metadata).toMatchObject(expected.metadata)
  }
}

// ============================================
// KeyFlash-Specific Helpers
// ============================================

/**
 * Create a complete checkout flow mock for KeyFlash Pro upgrade
 */
export function createProUpgradeCheckout(
  email: string,
  userId?: string
): Stripe.Event {
  return createCheckoutEvent({
    email,
    userId: userId || `user_${Date.now()}`,
    customerId: `cus_${Date.now()}`,
    subscriptionId: `sub_${Date.now()}`,
    priceId: TEST_PRICES.keyflashProMonthly,
    amount: 2900, // $29.00
    product: 'keyflash-pro',
  })
}

/**
 * Create a subscription cancellation event for downgrade
 */
export function createProDowngrade(
  customerId: string,
  subscriptionId: string
): Stripe.Event {
  return createSubscriptionDeletedEvent({
    customerId,
    subscriptionId,
    status: 'canceled',
  })
}
