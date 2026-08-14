import { describe, expect, it } from 'vitest'

import {
  CLERK_AFTER_SIGN_OUT_URL,
  STRIPE_API_VERSION,
} from '@/lib/integration-contracts'

describe('third-party integration contracts', () => {
  it('uses one current Stripe API version for checkout and webhooks', () => {
    expect(STRIPE_API_VERSION).toBe('2026-03-25.dahlia')
  })

  it('returns signed-out users to the application root', () => {
    expect(CLERK_AFTER_SIGN_OUT_URL).toBe('/')
  })
})
