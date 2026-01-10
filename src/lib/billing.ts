/**
 * Billing Configuration
 *
 * Controls whether billing/payment features are enabled.
 * Default: false (open source mode - all features free)
 *
 * Set BILLING_ENABLED=true to enable:
 * - Trial/Pro tier limits
 * - Stripe checkout
 * - Subscription management
 */

/**
 * Check if billing features are enabled.
 *
 * When disabled (default):
 * - All users get unlimited access
 * - No tier restrictions
 * - Stripe routes return 503
 *
 * When enabled:
 * - Trial users get limited access (mock data)
 * - Pro users get full access (real data)
 * - Stripe checkout/webhooks are active
 */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true'
}

/**
 * Check if Stripe is configured.
 * Even with billing enabled, Stripe must be configured.
 */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRICE_PRO
  )
}

/**
 * Check if billing is fully operational.
 * Requires both billing enabled AND Stripe configured.
 */
export function isBillingOperational(): boolean {
  return isBillingEnabled() && isStripeConfigured()
}
