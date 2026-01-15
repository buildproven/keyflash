import type {
  KeywordAPIProvider,
  SearchOptions,
  RateLimit,
  ProviderConfig,
} from '../types'
import type { KeywordData, Competition, MonthlyTrend } from '@/types/keyword'
import type { RelatedKeyword } from '@/types/related-keywords'
import { logger } from '@/lib/utils/logger'
import { fetchWithTimeout, API_TIMEOUTS } from '@/lib/utils/fetch-with-timeout'

/**
 * DataForSEO API Response Types
 */
interface DataForSEOKeywordMetrics {
  keyword?: string
  search_volume?: number
  competition?: number
  competition_level?: string
  cpc?: number
  low_top_of_page_bid?: number
  high_top_of_page_bid?: number
  keyword_difficulty?: number
  monthly_searches?: Array<{
    month?: number
    year?: number
    search_volume?: number
  }>
}

interface DataForSEOResultItem {
  keyword?: string
  search_volume?: number
  competition?: string
  competition_index?: number
  cpc?: number
  low_top_of_page_bid?: number
  high_top_of_page_bid?: number
  monthly_searches?: Array<{
    month?: number
    year?: number
    search_volume?: number
  }>
  keyword_info?: {
    keyword?: string
    monthly_searches?: Array<{
      month?: number
      year?: number
      search_volume?: number
    }>
  }
  keyword_properties?: {
    keyword?: string
    keyword_difficulty?: number
  }
  search_volume_info?: {
    keyword?: string
    search_volume?: number
    competition?: number
    competition_level?: string
    cpc?: number
    low_top_of_page_bid?: number
    high_top_of_page_bid?: number
  }
}

interface DataForSEOTask {
  status_code?: number
  status_message?: string
  result?: DataForSEOResultItem[]
}

interface DataForSEOResponse {
  status_code?: number
  status_message?: string
  tasks?: DataForSEOTask[]
}

function getDefaultKeywordData(keyword: string): KeywordData {
  return {
    keyword,
    searchVolume: 0,
    difficulty: 50,
    cpc: 0,
    competition: 'low' as Competition,
    intent: 'informational' as const,
  }
}

function extractKeywordFromResult(result: DataForSEOResultItem): string | null {
  return (
    result.keyword ||
    result.keyword_info?.keyword ||
    result.keyword_properties?.keyword ||
    result.search_volume_info?.keyword ||
    null
  )
}

function extractMetricsFromResult(
  result: DataForSEOResultItem
): DataForSEOKeywordMetrics {
  const keyword = extractKeywordFromResult(result) || ''
  return {
    keyword,
    search_volume:
      result.search_volume ??
      result.search_volume_info?.search_volume ??
      result.keyword_info?.monthly_searches?.[0]?.search_volume ??
      0,
    competition:
      result.competition_index ?? result.search_volume_info?.competition,
    competition_level:
      result.competition ?? result.search_volume_info?.competition_level,
    cpc: result.cpc ?? result.search_volume_info?.cpc ?? 0,
    low_top_of_page_bid:
      result.low_top_of_page_bid ??
      result.search_volume_info?.low_top_of_page_bid ??
      0,
    high_top_of_page_bid:
      result.high_top_of_page_bid ??
      result.search_volume_info?.high_top_of_page_bid ??
      0,
    keyword_difficulty: result.keyword_properties?.keyword_difficulty ?? 50,
    monthly_searches:
      result.monthly_searches ?? result.keyword_info?.monthly_searches,
  }
}

/**
 * DataForSEO API Provider
 *
 * Setup instructions:
 * 1. Sign up at https://dataforseo.com/
 * 2. Get API credentials from dashboard
 * 3. Set environment variables:
 *    - DATAFORSEO_API_LOGIN
 *    - DATAFORSEO_API_PASSWORD
 *
 * Pricing: Pay-as-you-go, cheaper at scale than Google Ads
 * Documentation: https://docs.dataforseo.com/v3/keywords_data/
 */
export class DataForSEOProvider implements KeywordAPIProvider {
  readonly name = 'DataForSEO'

  private config: Required<Pick<ProviderConfig, 'login' | 'password'>>

  constructor() {
    this.config = {
      login: process.env.DATAFORSEO_API_LOGIN || '',
      password: process.env.DATAFORSEO_API_PASSWORD || '',
    }
  }

  validateConfiguration(): void {
    const missing: string[] = []

    if (!this.config.login) missing.push('DATAFORSEO_API_LOGIN')
    if (!this.config.password) missing.push('DATAFORSEO_API_PASSWORD')

    if (missing.length > 0) {
      throw new Error(
        `DataForSEO provider missing configuration: ${missing.join(', ')}. ` +
          'Please set these environment variables.'
      )
    }
  }

  async getKeywordData(
    keywords: string[],
    options: SearchOptions
  ): Promise<KeywordData[]> {
    this.validateConfiguration()

    try {
      // Call DataForSEO Keywords Data API
      const response = await this.callKeywordsAPI(keywords, options)

      // Transform response to KeywordData format
      return this.transformResponse(response, keywords)
    } catch (error) {
      logger.error('API error', error, { module: this.name })

      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`DataForSEO API failed: ${error.message}`)
      }
      throw new Error('DataForSEO API failed with unknown error')
    }
  }

  getBatchLimit(): number {
    // DataForSEO allows larger batches than Google Ads
    return 10000
  }

  getRateLimit(): RateLimit {
    return {
      requests: 2000,
      period: 'day',
    }
  }

  /**
   * Get Basic Auth header for DataForSEO
   * @private
   */
  private getAuthHeader(): string {
    const credentials = `${this.config.login}:${this.config.password}`
    return `Basic ${Buffer.from(credentials).toString('base64')}`
  }

  /**
   * Call DataForSEO Keywords Data API
   * @private
   */
  private async callKeywordsAPI(
    keywords: string[],
    options: SearchOptions
  ): Promise<DataForSEOResponse> {
    const apiBaseUrl = 'https://api.dataforseo.com/v3'

    // Map location to DataForSEO location code
    const locationCode = this.getLocationCode(options.location)

    // Map language to DataForSEO language code
    const languageCode = this.getLanguageCode(options.language)

    try {
      const response = await fetchWithTimeout(
        `${apiBaseUrl}/keywords_data/google_ads/search_volume/live`,
        {
          method: 'POST',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              keywords,
              location_code: locationCode,
              language_code: languageCode,
              search_partners: false,
              date_from: null, // Current month
              date_to: null,
            },
          ]),
        },
        API_TIMEOUTS.DEFAULT
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `DataForSEO API request failed (${response.status}): ${errorText}`
        )
      }

      const data: DataForSEOResponse = await response.json()

      // Check for API-level errors
      if (data.status_code === undefined) {
        logger.warn(
          'DataForSEO API returned no status_code; treating as empty result set',
          { module: 'DataForSEO' }
        )
        return {
          status_code: 20000,
          status_message: data.status_message,
          tasks: data.tasks || [],
        }
      }

      if (data.status_code !== 20000) {
        throw new Error(
          `DataForSEO API error (${data.status_code}): ${data.status_message}`
        )
      }

      return data
    } catch (error) {
      logger.error('API call error', error, { module: 'DataForSEO' })
      throw new Error(
        `DataForSEO API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Transform DataForSEO API response to KeywordData format
   * @private
   */
  private transformResponse(
    response: DataForSEOResponse,
    requestedKeywords: string[]
  ): KeywordData[] {
    const tasks = response.tasks || []

    if (tasks.length === 0) {
      return requestedKeywords.map(getDefaultKeywordData)
    }

    const results = tasks[0].result || []
    const metricsMap = this.buildMetricsMap(results)

    return requestedKeywords.map(keyword => {
      const metrics = metricsMap.get(keyword.toLowerCase())
      if (!metrics) {
        return getDefaultKeywordData(keyword)
      }
      return this.metricsToKeywordData(keyword, metrics)
    })
  }

  private buildMetricsMap(
    results: DataForSEOResultItem[]
  ): Map<string, DataForSEOKeywordMetrics> {
    const map = new Map<string, DataForSEOKeywordMetrics>()
    for (const result of results) {
      const keyword = extractKeywordFromResult(result)
      if (keyword) {
        map.set(keyword.toLowerCase(), extractMetricsFromResult(result))
      }
    }
    return map
  }

  private metricsToKeywordData(
    keyword: string,
    metrics: DataForSEOKeywordMetrics
  ): KeywordData {
    const searchVolume = metrics.search_volume || 0
    const difficulty = metrics.keyword_difficulty || 50
    const cpc = metrics.cpc || 0
    const competition = this.mapCompetition(
      metrics.competition_level,
      metrics.competition
    )

    return {
      keyword,
      searchVolume,
      difficulty,
      cpc,
      competition,
      intent: this.inferIntent(searchVolume, cpc, competition),
      trends: this.extractTrends(metrics.monthly_searches),
    }
  }

  /**
   * Extract and transform monthly search trends
   * @private
   */
  private extractTrends(
    monthlySearches?: Array<{
      month?: number
      year?: number
      search_volume?: number
    }>
  ): MonthlyTrend[] | undefined {
    if (!monthlySearches || monthlySearches.length === 0) {
      return undefined
    }

    // Transform and sort by date (oldest first for charting)
    return monthlySearches
      .filter(m => m.month !== undefined && m.year !== undefined)
      .map(m => ({
        month: m.month!,
        year: m.year!,
        volume: m.search_volume || 0,
      }))
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })
      .slice(-12) // Keep last 12 months
  }

  /**
   * Map DataForSEO competition level to our Competition type
   * @private
   */
  private mapCompetition(
    competitionLevel?: string,
    competitionIndex?: number
  ): Competition {
    // Priority 1: Use competition_level if available
    if (competitionLevel) {
      switch (competitionLevel.toUpperCase()) {
        case 'LOW':
          return 'low'
        case 'MEDIUM':
          return 'medium'
        case 'HIGH':
          return 'high'
      }
    }

    // Priority 2: Use competition index (0-1 scale)
    if (competitionIndex !== undefined) {
      if (competitionIndex < 0.33) return 'low'
      if (competitionIndex < 0.67) return 'medium'
      return 'high'
    }

    return 'medium'
  }

  /**
   * Infer search intent from keyword metrics (heuristic approach)
   * @private
   */
  private inferIntent(
    searchVolume: number,
    cpc: number,
    competition: Competition
  ): 'informational' | 'commercial' | 'transactional' | 'navigational' {
    // High CPC + High competition = Commercial/Transactional
    if (cpc > 5 && competition === 'high') {
      return 'transactional'
    }

    // Medium CPC + Medium/High competition = Commercial
    if (cpc > 2 && (competition === 'medium' || competition === 'high')) {
      return 'commercial'
    }

    // Low CPC + Low competition + High volume = Informational
    if (cpc < 1 && competition === 'low' && searchVolume > 10000) {
      return 'informational'
    }

    // Low volume + brand-like keywords = Navigational
    if (searchVolume < 1000) {
      return 'navigational'
    }

    // Default to informational
    return 'informational'
  }

  /**
   * Get DataForSEO location code for location name
   * @private
   */
  private getLocationCode(location?: string): number {
    // Map of common location names to DataForSEO location codes
    // Full list: https://docs.dataforseo.com/v3/appendix/locations/
    const locationMap: Record<string, number> = {
      'United States': 2840,
      'United Kingdom': 2826,
      Canada: 2124,
      Australia: 2036,
      Germany: 2276,
      France: 2250,
      India: 2356,
      Worldwide: 0, // Global
    }

    return locationMap[location || 'United States'] || 2840
  }

  /**
   * Get DataForSEO language code for language name
   * @private
   */
  private getLanguageCode(language?: string): string {
    // Map of common language codes
    // Full list: https://docs.dataforseo.com/v3/appendix/languages/
    const languageMap: Record<string, string> = {
      en: 'en',
      'en-US': 'en',
      'en-GB': 'en',
      es: 'es',
      fr: 'fr',
      de: 'de',
      pt: 'pt',
      it: 'it',
    }

    return languageMap[language || 'en'] || 'en'
  }

  /**
   * Fetch related keywords for a seed keyword
   * Uses DataForSEO Keywords for Keywords endpoint
   */
  async getRelatedKeywords(
    keyword: string,
    options: SearchOptions
  ): Promise<RelatedKeyword[]> {
    this.validateConfiguration()

    const apiBaseUrl = 'https://api.dataforseo.com/v3'
    const locationCode = this.getLocationCode(options.location)
    const languageCode = this.getLanguageCode(options.language)

    try {
      const response = await fetch(
        `${apiBaseUrl}/keywords_data/google_ads/keywords_for_keywords/live`,
        {
          method: 'POST',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              keywords: [keyword],
              location_code: locationCode,
              language_code: languageCode,
              include_seed_keyword: false,
              sort_by: 'relevance',
            },
          ]),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `DataForSEO API request failed (${response.status}): ${errorText}`
        )
      }

      const data: DataForSEOResponse = await response.json()

      if (data.status_code !== 20000) {
        throw new Error(
          `DataForSEO API error (${data.status_code}): ${data.status_message}`
        )
      }

      return this.transformRelatedKeywordsResponse(data, keyword)
    } catch (error) {
      logger.error('Related keywords API error', error, {
        module: 'DataForSEO',
      })
      throw new Error(
        `DataForSEO related keywords failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Transform DataForSEO response to RelatedKeyword array
   * @private
   */
  private transformRelatedKeywordsResponse(
    response: DataForSEOResponse,
    seedKeyword: string
  ): RelatedKeyword[] {
    const tasks = response.tasks || []
    if (tasks.length === 0 || !tasks[0].result) {
      return []
    }

    const results = tasks[0].result
    const seedKeywordLower = seedKeyword.toLowerCase()

    return results
      .map((result, index) => {
        const keyword = extractKeywordFromResult(result)
        if (!keyword || keyword.toLowerCase() === seedKeywordLower) {
          return null
        }

        const metrics = extractMetricsFromResult(result)
        const searchVolume = metrics.search_volume || 0
        const cpc = metrics.cpc || 0
        const competition = this.mapCompetition(
          metrics.competition_level,
          metrics.competition
        )

        const relatedKeyword: RelatedKeyword = {
          keyword,
          searchVolume,
          difficulty: metrics.keyword_difficulty || 50,
          cpc,
          competition,
          intent: this.inferIntent(searchVolume, cpc, competition),
          relevance: Math.max(0, 100 - index * 3),
        }
        return relatedKeyword
      })
      .filter((item): item is RelatedKeyword => item !== null)
      .slice(0, 20)
  }
}
