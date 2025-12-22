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
      // Max variable cost: $2.90/mo
      limits: {
        keyword_lookup: 1450, // ~$2.90 at $0.002/keyword
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
 * - 6 searches/day × 50 keywords = 300 keywords/day
 * - Uses MOCK DATA only - $0 operating cost
 * - Requires: Email signup (for trial tracking)
 *
 * PRO ($29/month):
 * - Real API data from DataForSEO
 * - ~30 searches/day × 50 keywords = 1,500 keywords/day
 * - Monthly: ~1,450 keywords (capped for 90% margin)
 * - Cost: ~$2.90/mo → 90% margin
 *
 * NOTE: Trial requires AUTH-001 implementation to track trial start dates.
 * Until auth is implemented, use IP-based rate limiting as stopgap.
 */
