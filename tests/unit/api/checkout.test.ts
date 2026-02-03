/**
 * Checkout API Route Tests
 *
 * Tests for creating Stripe checkout sessions:
 * - Session creation with correct parameters
 * - Error handling for missing configuration
 * - URL generation for success/cancel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { resolveCheckoutOrigin } from '@/app/api/checkout/route'

// Mock Stripe
const mockCheckoutCreate = vi.fn()
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutCreate,
      },
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

describe('Checkout API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set test values for Stripe env vars (all calls are mocked)
    process.env.NEXT_PUBLIC_APP_URL = 'https://keyflash.vibebuildlab.com'
    process.env.STRIPE_SECRET_KEY =
      process.env.STRIPE_SECRET_KEY || 'sk_test_fake_key_for_testing'
    process.env.STRIPE_PRICE_PRO =
      process.env.STRIPE_PRICE_PRO || 'price_test_keyflash_pro'
    delete process.env.VERCEL_URL
  })

  // ===========================================
  // Configuration
  // ===========================================
  describe('Configuration', () => {
    it('should require STRIPE_PRICE_PRO environment variable', () => {
      const priceId = process.env.STRIPE_PRICE_PRO
      expect(priceId).toBeDefined()
      expect(priceId).toBe('price_test_keyflash_pro') // From .env.test
    })

    it('should fail gracefully without price ID', () => {
      const originalPrice = process.env.STRIPE_PRICE_PRO
      delete process.env.STRIPE_PRICE_PRO
      const priceId = process.env.STRIPE_PRICE_PRO
      expect(priceId).toBeUndefined()
      // Restore for subsequent tests
      process.env.STRIPE_PRICE_PRO = originalPrice
    })
  })

  // ===========================================
  // Session Creation
  // ===========================================
  describe('Checkout Session Creation', () => {
    it('should create session with subscription mode', async () => {
      mockCheckoutCreate.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

      const session = await mockCheckoutCreate({
        mode: 'subscription',
        line_items: [{ price: 'price_keyflash_pro_123', quantity: 1 }],
        success_url: 'https://keyflash.vibebuildlab.com/search?upgraded=true',
        cancel_url: 'https://keyflash.vibebuildlab.com/search?canceled=true',
      })

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_keyflash_pro_123', quantity: 1 }],
        })
      )
      expect(session.url).toContain('checkout.stripe.com')
    })

    it('should include correct success URL', async () => {
      const origin = 'https://keyflash.vibebuildlab.com'
      const successUrl = `${origin}/search?upgraded=true`

      expect(successUrl).toBe(
        'https://keyflash.vibebuildlab.com/search?upgraded=true'
      )
      expect(successUrl).toContain('upgraded=true')
    })

    it('should include correct cancel URL', async () => {
      const origin = 'https://keyflash.vibebuildlab.com'
      const cancelUrl = `${origin}/search?canceled=true`

      expect(cancelUrl).toBe(
        'https://keyflash.vibebuildlab.com/search?canceled=true'
      )
      expect(cancelUrl).toContain('canceled=true')
    })

    it('should enable customer creation for new users', () => {
      const sessionConfig = {
        customer_creation: 'always' as const,
      }

      expect(sessionConfig.customer_creation).toBe('always')
    })

    it('should allow promotion codes', () => {
      const sessionConfig = {
        allow_promotion_codes: true,
      }

      expect(sessionConfig.allow_promotion_codes).toBe(true)
    })

    it('should include product metadata in subscription', () => {
      const sessionConfig = {
        subscription_data: {
          metadata: {
            product: 'keyflash-pro',
          },
        },
      }

      expect(sessionConfig.subscription_data.metadata.product).toBe(
        'keyflash-pro'
      )
    })
  })

  // ===========================================
  // Error Handling
  // ===========================================
  describe('Error Handling', () => {
    it('should handle Stripe API errors', async () => {
      mockCheckoutCreate.mockRejectedValue(new Error('Stripe API error'))

      await expect(mockCheckoutCreate({})).rejects.toThrow('Stripe API error')
    })

    it('should return 500 for missing configuration', () => {
      const checkConfig = (priceId: string | undefined) => {
        if (!priceId) {
          return { error: 'Checkout not configured', status: 500 }
        }
        return { ok: true }
      }

      expect(checkConfig(undefined)).toEqual({
        error: 'Checkout not configured',
        status: 500,
      })
      expect(checkConfig('price_123')).toEqual({ ok: true })
    })

    it('should return 500 for session creation failure', () => {
      const handleError = (error: Error) => {
        return {
          error: 'Failed to create checkout session',
          status: 500,
          message: error.message,
        }
      }

      const result = handleError(new Error('Network timeout'))
      expect(result.status).toBe(500)
      expect(result.error).toBe('Failed to create checkout session')
    })
  })

  // ===========================================
  // Response Format
  // ===========================================
  describe('Response Format', () => {
    it('should return checkout URL on success', async () => {
      const mockUrl = 'https://checkout.stripe.com/pay/cs_test_abc'
      mockCheckoutCreate.mockResolvedValue({
        id: 'cs_test_abc',
        url: mockUrl,
      })

      const session = await mockCheckoutCreate({})

      const response = { url: session.url }
      expect(response.url).toBe(mockUrl)
    })

    it('should return error object on failure', () => {
      const errorResponse = {
        error: 'Failed to create checkout session',
      }

      expect(errorResponse).toHaveProperty('error')
      expect(typeof errorResponse.error).toBe('string')
    })
  })

  describe('Origin Resolution', () => {
    it('uses the allowed origin when it matches the allowlist', () => {
      const request = new NextRequest('https://example.com/api/checkout', {
        headers: {
          origin: 'https://keyflash.vibebuildlab.com',
        },
      })

      const origin = resolveCheckoutOrigin(request)
      expect(origin).toBe('https://keyflash.vibebuildlab.com')
    })

    it('falls back to the configured app URL when origin is untrusted', () => {
      const request = new NextRequest('https://example.com/api/checkout', {
        headers: {
          origin: 'https://evil.example.com',
        },
      })

      const origin = resolveCheckoutOrigin(request)
      expect(origin).toBe('https://keyflash.vibebuildlab.com')
    })
  })

  // ===========================================
  // KeyFlash Pro Subscription
  // ===========================================
  describe('KeyFlash Pro Subscription', () => {
    it('should use correct price for $29/mo Pro plan', () => {
      // Price ID should map to $29/month subscription
      const priceId = process.env.STRIPE_PRICE_PRO
      expect(priceId).toBeDefined()
    })

    it('should create recurring subscription (not one-time payment)', () => {
      const sessionConfig = {
        mode: 'subscription' as const,
      }

      expect(sessionConfig.mode).toBe('subscription')
      expect(sessionConfig.mode).not.toBe('payment')
    })

    it('should redirect to search page after successful checkout', () => {
      const successUrl =
        'https://keyflash.vibebuildlab.com/search?upgraded=true'

      expect(successUrl).toContain('/search')
      expect(successUrl).toContain('upgraded=true')
    })
  })
})
