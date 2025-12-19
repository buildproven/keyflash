import type { KeywordAPIProvider, SearchOptions } from './types'
import type { MonthlyTrend } from '@/types/keyword'
import type { RelatedKeyword } from '@/types/related-keywords'
import { GoogleAdsProvider } from './providers/google-ads'
import { DataForSEOProvider } from './providers/dataforseo'
import { logger } from '@/lib/utils/logger'

/**
 * Supported API provider names
 */
export type ProviderName = 'google-ads' | 'dataforseo' | 'mock'

/**
 * Mock provider for development and testing
 * Returns randomized data without requiring API credentials
 */
class MockProvider implements KeywordAPIProvider {
  readonly name = 'Mock'

  validateConfiguration(): void {
    // Mock provider doesn't require configuration
  }

  async getKeywordData(
    keywords: string[]
  ): Promise<import('@/types/keyword').KeywordData[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))

    return keywords.map(keyword => {
      const baseVolume = Math.floor(Math.random() * 100000)
      return {
        keyword,
        searchVolume: baseVolume,
        difficulty: Math.floor(Math.random() * 100),
        cpc: Math.random() * 10,
        competition: (['low', 'medium', 'high'] as const)[
          Math.floor(Math.random() * 3)
        ],
        intent: (
          [
            'informational',
            'commercial',
            'transactional',
            'navigational',
          ] as const
        )[Math.floor(Math.random() * 4)],
        trends: this.generateMockTrends(baseVolume),
      }
    })
  }

  /**
   * Generate realistic mock trend data for last 12 months
   */
  private generateMockTrends(baseVolume: number): MonthlyTrend[] {
    const now = new Date()
    const trends: MonthlyTrend[] = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      // Add seasonal variation (±30%) and random noise (±10%)
      const seasonalFactor =
        1 + 0.3 * Math.sin((date.getMonth() / 12) * 2 * Math.PI)
      const noise = 0.9 + Math.random() * 0.2
      const volume = Math.floor(baseVolume * seasonalFactor * noise)

      trends.push({
        month: date.getMonth() + 1, // 1-12
        year: date.getFullYear(),
        volume: Math.max(0, volume),
      })
    }

    return trends
  }

  getBatchLimit(): number {
    return 200 // Match UI limit
  }

  getRateLimit() {
    return {
      requests: 1000,
      period: 'hour' as const,
    }
  }

  async getRelatedKeywords(
    keyword: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- options required by interface but not needed for mock
    _options: SearchOptions
  ): Promise<RelatedKeyword[]> {
    await new Promise(resolve => setTimeout(resolve, 500))

    const relatedTerms = [
      `${keyword} guide`,
      `${keyword} tutorial`,
      `best ${keyword}`,
      `${keyword} tips`,
      `how to ${keyword}`,
      `${keyword} for beginners`,
      `${keyword} examples`,
      `${keyword} tools`,
      `${keyword} software`,
      `${keyword} online`,
      `free ${keyword}`,
      `${keyword} course`,
      `${keyword} training`,
      `${keyword} certification`,
      `${keyword} services`,
      `${keyword} agency`,
      `${keyword} consultant`,
      `${keyword} expert`,
      `${keyword} strategies`,
      `${keyword} techniques`,
    ]

    return relatedTerms.map((term, index) => ({
      keyword: term,
      searchVolume: Math.floor(Math.random() * 50000),
      difficulty: Math.floor(Math.random() * 100),
      cpc: Math.random() * 5,
      competition: (['low', 'medium', 'high'] as const)[
        Math.floor(Math.random() * 3)
      ],
      intent: (
        [
          'informational',
          'commercial',
          'transactional',
          'navigational',
        ] as const
      )[Math.floor(Math.random() * 4)],
      relevance: Math.max(0, 100 - index * 5),
    }))
  }
}

/**
 * Create keyword API provider instance based on environment configuration
 *
 * Provider selection priority:
 * 1. KEYWORD_API_PROVIDER environment variable
 * 2. Auto-detect based on available credentials
 * 3. Fall back to mock provider
 *
 * @returns Configured provider instance
 * @throws Error if provider configuration is invalid
 */
export function createProvider(): KeywordAPIProvider {
  const providerName = (
    process.env.KEYWORD_API_PROVIDER || 'mock'
  ).toLowerCase() as ProviderName

  switch (providerName) {
    case 'google-ads':
      return new GoogleAdsProvider()

    case 'dataforseo':
      return new DataForSEOProvider()

    case 'mock':
      return new MockProvider()

    default:
      logger.warn(
        `Unknown provider "${providerName}". Falling back to mock provider.`
      )
      return new MockProvider()
  }
}

/**
 * Get provider instance with validation
 * Validates configuration and throws descriptive error if misconfigured
 *
 * @returns Validated provider instance
 * @throws Error with setup instructions if provider is misconfigured
 */
export function getProvider(): KeywordAPIProvider {
  const provider = createProvider()

  try {
    provider.validateConfiguration()
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `${provider.name} provider configuration error: ${error.message}\n\n` +
          'To fix this:\n' +
          '1. Copy .env.example to .env.local\n' +
          '2. Add your API credentials\n' +
          '3. Restart the development server\n\n' +
          'Or set KEYWORD_API_PROVIDER=mock to use mock data.'
      )
    }
    throw error
  }

  return provider
}

/**
 * Check if a specific provider is available (credentials configured)
 *
 * @param providerName - Name of provider to check
 * @returns True if provider is properly configured
 */
export function isProviderAvailable(providerName: ProviderName): boolean {
  if (providerName === 'mock') return true

  try {
    const provider = createProvider()
    if (provider.name.toLowerCase().replace(/\s/g, '-') !== providerName) {
      return false
    }
    provider.validateConfiguration()
    return true
  } catch {
    return false
  }
}
