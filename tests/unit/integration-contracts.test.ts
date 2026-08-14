import { describe, expect, it } from 'vitest'

import { STRIPE_API_VERSION as checkoutStripeApiVersion } from '@/app/api/checkout/route'
import { STRIPE_API_VERSION as webhookStripeApiVersion } from '@/app/api/webhooks/stripe/route'
import { CLERK_AFTER_SIGN_OUT_URL } from '@/app/layout'

describe('third-party integration contracts', () => {
  it('uses one current Stripe API version for checkout and webhooks', () => {
    expect(checkoutStripeApiVersion).toBe('2026-03-25.dahlia')
    expect(webhookStripeApiVersion).toBe(checkoutStripeApiVersion)
  })

  it('returns signed-out users to the application root', () => {
    expect(CLERK_AFTER_SIGN_OUT_URL).toBe('/')
  })
})
