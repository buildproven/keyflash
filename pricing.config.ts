/**
 * KeyFlash Pricing Configuration
 *
 * Used by @vbl/shared pricing analyzer to validate margins.
 * Run: npx ts-node -e "import { analyzePricing, formatAnalysis } from '@vbl/shared'; import config from './pricing.config'; console.log(formatAnalysis(analyzePricing(config)))"
 */

import type { PricingConfig } from '@vbl/shared'

const config: PricingConfig = {
  project: 'keyflash',

  tiers: [
    {
      name: 'Free',
      price: 0,
      // Free tier gets minimal limits - just enough to demo
      limits: {
        keyword_lookup: 100, // 100 keywords/month total
      },
    },
    {
      name: 'Pro',
      price: 29,
      targetMargin: 0.9, // 90% margin target
      limits: {
        keyword_lookup: 1500, // ~$3 cost at 90% margin
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

  fixedCostPerUser: 0, // No per-user fixed costs currently
}

export default config
