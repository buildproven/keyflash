import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

  it.each([
    ['src/app/api/checkout/route.ts', 'STRIPE_API_VERSION'],
    ['src/app/api/webhooks/stripe/route.ts', 'STRIPE_API_VERSION'],
    ['src/app/layout.tsx', 'CLERK_AFTER_SIGN_OUT_URL'],
  ])(
    '%s imports its contract without exposing a reserved export',
    (path, name) => {
      const source = readFileSync(join(process.cwd(), path), 'utf8')

      expect(source).toContain(
        `import { ${name} } from '@/lib/integration-contracts'`
      )
      expect(source).not.toContain(`export const ${name}`)
    }
  )
})
