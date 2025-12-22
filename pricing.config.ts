/**
 * KeyFlash Pricing Configuration
 *
 * Model: 7-day free trial → $29/mo Pro
 * No perpetual free tier (industry standard for keyword tools)
 *
 * Used by @vbl/shared pricing analyzer to validate margins.
 */

interface PricingConfig {
  project: string
  tiers: Array<{
    name: string
    price: number
    targetMargin?: number
    limits?: Record<string, number>
  }>
  costs: Array<{
    name: string
    source: string
    costPerUnit: number
    unit: string
  }>
  fixedCostPerUser?: number
}

const config: PricingConfig = {
  project: 'keyflash',

  tiers: [
    {
      name: 'Trial',
      price: 0,
      // 7-day trial uses MOCK DATA - $0 operating cost
      // Real API calls reserved for paying Pro users only
      limits: {
        keyword_lookup: 2100, // 300/day × 7 days (mock data only)
      },
    },
    {
      name: 'Pro',
      price: 29,
      targetMargin: 0.9, // 90% margin target
      // Realistic usage: quick/cheap research, not enterprise
      // 1,000 kw/mo × $0.002 = $2/mo cost = 93% margin
      limits: {
        keyword_lookup: 1000, // 1,000 keywords/month
      },
    },
  ],

  costs: [
    {
      name: 'keyword_lookup',
      source: 'DataForSEO',
      costPerUnit: 0.002, // $0.002 per keyword
      unit: 'keyword',
    },
  ],

  fixedCostPerUser: 0,
}

export default config

/**
 * Pricing Summary:
 *
 * TRIAL (7 days):
 * - Uses MOCK DATA only - $0 operating cost
 * - Unlimited searches with sample data
 * - Requires: Email signup (for trial tracking)
 *
 * PRO ($29/month):
 * - Real API data from DataForSEO
 * - 1,000 keywords/month (quick/cheap research use case)
 * - ~20 searches × 50 keywords = typical monthly usage
 * - Cost: $2/mo → 93% margin
 *
 * Target user: Content creators doing occasional keyword research,
 * NOT enterprise SEO teams (they use Ahrefs/SEMrush at $129+/mo).
 *
 * NOTE: Trial requires AUTH-001 implementation to track trial start dates.
 * Until auth is implemented, use IP-based rate limiting as stopgap.
 */
