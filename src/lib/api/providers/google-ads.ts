import type {
  KeywordAPIProvider,
  SearchOptions,
  RateLimit,
  ProviderConfig,
} from '../types'
import type { KeywordData, Competition } from '@/types/keyword'
import { logger } from '@/lib/utils/logger'
import { fetchWithTimeout, API_TIMEOUTS } from '@/lib/utils/fetch-with-timeout'

/**
 * Google Ads API Response Types
 */
interface GoogleAdsOAuthResponse {
  access_token: string
  expires_in: number
  token_type: string
  scope: string
}

interface GoogleAdsKeywordMetrics {
  avg_monthly_searches?: number
  competition?: string
  competition_index?: number
  low_top_of_page_bid_micros?: number
  high_top_of_page_bid_micros?: number
}

interface GoogleAdsKeywordResult {
  results?: Array<{
    keyword_plan_ad_group_keyword?: {
      text?: string
    }
    keyword_plan_keyword_forecast_metrics?: GoogleAdsKeywordMetrics
    keyword_plan_keyword_historical_metrics?: GoogleAdsKeywordMetrics
  }>
}

/**
 * Google Ads Keyword Planner API Provider
 *
 * Setup instructions:
 * 1. Create Google Cloud project
 * 2. Enable Google Ads API
 * 3. Create OAuth credentials
 * 4. Generate refresh token
 * 5. Set environment variables:
 *    - GOOGLE_ADS_CLIENT_ID
 *    - GOOGLE_ADS_CLIENT_SECRET
 *    - GOOGLE_ADS_DEVELOPER_TOKEN
 *    - GOOGLE_ADS_REFRESH_TOKEN
 *    - GOOGLE_ADS_CUSTOMER_ID
 *
 * Documentation: https://developers.google.com/google-ads/api
 */
export class GoogleAdsProvider implements KeywordAPIProvider {
  readonly name = 'Google Ads'

  private config: Required<
    Pick<
      ProviderConfig,
      | 'clientId'
      | 'clientSecret'
      | 'developerToken'
      | 'refreshToken'
      | 'customerId'
    >
  >

  constructor() {
    this.config = {
      clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || '',
      customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '',
    }
  }

  validateConfiguration(): void {
    const missing: string[] = []

    if (!this.config.clientId) missing.push('GOOGLE_ADS_CLIENT_ID')
    if (!this.config.clientSecret) missing.push('GOOGLE_ADS_CLIENT_SECRET')
    if (!this.config.developerToken) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN')
    if (!this.config.refreshToken) missing.push('GOOGLE_ADS_REFRESH_TOKEN')
    if (!this.config.customerId) missing.push('GOOGLE_ADS_CUSTOMER_ID')

    if (missing.length > 0) {
      throw new Error(
        `Google Ads provider missing configuration: ${missing.join(', ')}. ` +
          'Please set these environment variables.'
      )
    }
  }

  async getKeywordData(
    keywords: string[],
    options: SearchOptions
  ): Promise<KeywordData[]> {
    this.validateConfiguration()

    const MAX_KEYWORDS = 200 // align with public API input cap
    const MAX_QUERY_CHARS = 8000 // conservative GAQL payload budget

    if (keywords.length > MAX_KEYWORDS) {
      throw new Error(
        `Too many keywords for Google Ads batch (${keywords.length}). Limit to ${MAX_KEYWORDS} or fewer.`
      )
    }

    const estimatedQuerySize = keywords.join(',').length
    if (estimatedQuerySize > MAX_QUERY_CHARS) {
      throw new Error(
        `Keyword batch too large for Google Ads query (size ≈ ${estimatedQuerySize} chars). Reduce keyword lengths or batch size.`
      )
    }

    const matchType = options.matchType || 'phrase'
    const locationCode = this.getLocationCode(options.location)
    const languageConstant = this.getLanguageConstant(options.language)

    try {
      // Get fresh access token
      const accessToken = await this.getAccessToken()

      // Call Google Ads Keyword Planner API
      const response = await this.callKeywordPlannerAPI(
        keywords,
        accessToken,
        locationCode,
        languageConstant,
        matchType
      )

      // Transform response to KeywordData format
      return this.transformResponse(response, keywords)
    } catch (error) {
      logger.error('API error', error, { module: this.name })

      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Google Ads API failed: ${error.message}`)
      }
      throw new Error('Google Ads API failed with unknown error')
    }
  }

  getBatchLimit(): number {
    // Google Ads allows up to 1000 keywords per request
    return 1000
  }

  getRateLimit(): RateLimit {
    return {
      requests: 1000,
      period: 'day',
    }
  }

  /**
   * Get OAuth access token from refresh token
   * @private
   */
  private async getAccessToken(): Promise<string> {
    try {
      const response = await fetchWithTimeout(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
          grant_type: 'refresh_token',
        }),
        },
        API_TIMEOUTS.AUTH
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `OAuth token refresh failed (${response.status}): ${errorText}`
        )
      }

      const data: GoogleAdsOAuthResponse = await response.json()
      return data.access_token
    } catch (error) {
      logger.error('OAuth token refresh error', error, { module: 'Google Ads' })
      throw new Error(
        `Failed to refresh OAuth token: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Call Google Ads Keyword Planner API
   * @private
   */
  private async callKeywordPlannerAPI(
    keywords: string[],
    accessToken: string,
    locationCode: number,
    languageConstant: string,
    matchType: 'phrase' | 'exact'
  ): Promise<GoogleAdsKeywordResult> {
    // Format customer ID (remove dashes if present)
    const customerId = this.config.customerId.replace(/-/g, '')

    // Build GAQL (Google Ads Query Language) query
    const matchTypeClause =
      matchType === 'exact'
        ? 'keyword_plan_keyword.keyword_match_type = EXACT AND'
        : ''

    const query = `
      SELECT
        keyword_plan_keyword_forecast_metrics.avg_monthly_searches,
        keyword_plan_keyword_historical_metrics.avg_monthly_searches,
        keyword_plan_keyword_forecast_metrics.competition,
        keyword_plan_keyword_forecast_metrics.competition_index,
        keyword_plan_keyword_forecast_metrics.low_top_of_page_bid_micros,
        keyword_plan_keyword_forecast_metrics.high_top_of_page_bid_micros
      FROM keyword_plan_keyword
      WHERE ${matchTypeClause}
        keyword_plan_keyword.text IN (${keywords.map(k => `'${k.replace(/'/g, "\\'")}'`).join(', ')})
    `.trim()

    try {
      const response = await fetchWithTimeout(
        `https://googleads.googleapis.com/v17/customers/${customerId}/googleAdsService:searchStream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'developer-token': this.config.developerToken,
            'Content-Type': 'application/json',
            'login-customer-id': customerId,
          },
          body: JSON.stringify({
            query,
            customer_id: customerId,
            geo_target_constants: [`geoTargetConstants/${locationCode}`],
            language_constants: [languageConstant],
          }),
        },
        API_TIMEOUTS.DEFAULT
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Google Ads API request failed (${response.status}): ${errorText}`
        )
      }

      const data: GoogleAdsKeywordResult = await response.json()
      return data
    } catch (error) {
      logger.error('API call error', error, { module: 'Google Ads' })
      throw new Error(
        `Google Ads API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Transform Google Ads API response to KeywordData format
   * @private
   */
  private transformResponse(
    response: GoogleAdsKeywordResult,
    requestedKeywords: string[]
  ): KeywordData[] {
    const results = response.results || []

    // Create a map of results by keyword
    const resultMap = new Map<string, GoogleAdsKeywordMetrics>()

    results.forEach(result => {
      const keyword = result.keyword_plan_ad_group_keyword?.text
      const metrics =
        result.keyword_plan_keyword_forecast_metrics ||
        result.keyword_plan_keyword_historical_metrics

      if (keyword && metrics) {
        resultMap.set(keyword.toLowerCase(), metrics)
      }
    })

    // Transform each requested keyword
    return requestedKeywords.map(keyword => {
      const metrics = resultMap.get(keyword.toLowerCase())

      if (!metrics) {
        // No data found for this keyword - return default values
        return {
          keyword,
          searchVolume: 0,
          difficulty: 50,
          cpc: 0,
          competition: 'low' as Competition,
          intent: 'informational' as const,
        }
      }

      // Extract metrics
      const searchVolume = metrics.avg_monthly_searches || 0
      const competitionIndex = metrics.competition_index || 50
      const lowBidMicros = metrics.low_top_of_page_bid_micros || 0
      const highBidMicros = metrics.high_top_of_page_bid_micros || 0

      // Calculate average CPC (convert from micros to dollars)
      const cpc = (lowBidMicros + highBidMicros) / 2 / 1_000_000

      // Map competition level
      const competition = this.mapCompetition(metrics.competition)

      // Infer intent from metrics (heuristic approach)
      const intent = this.inferIntent(searchVolume, cpc, competition)

      // Note: Google Ads API only provides average monthly searches,
      // not a month-by-month breakdown. trends remains undefined.
      // Use DataForSEO provider for historical trend data.
      return {
        keyword,
        searchVolume,
        difficulty: competitionIndex,
        cpc,
        competition,
        intent,
        // trends: undefined - Google Ads doesn't provide monthly breakdown
      }
    })
  }

  /**
   * Map Google Ads competition string to our Competition type
   * @private
   */
  private mapCompetition(competition?: string): Competition {
    switch (competition?.toLowerCase()) {
      case 'low':
        return 'low'
      case 'medium':
        return 'medium'
      case 'high':
        return 'high'
      default:
        return 'medium'
    }
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
   * Get Google Ads geotarget constant ID for location
   * @private
   */
  private getLocationCode(location?: string): number {
    const normalized = location || 'United States'

    switch (normalized) {
      case 'United States':
        return 2840
      case 'United Kingdom':
        return 2826
      case 'Canada':
        return 2124
      case 'Australia':
        return 2036
      case 'Germany':
        return 2276
      case 'France':
        return 2250
      case 'India':
        return 2356
      case 'Worldwide':
        return 0
      default:
        throw new Error(
          'Google Ads provider does not support location "' +
            normalized +
            '". Supported: United States, United Kingdom, Canada, Australia, Germany, France, India, Worldwide.'
        )
    }
  }

  /**
   * Get Google Ads language constant for language code
   * @private
   */
  private getLanguageConstant(language?: string): string {
    const normalized = language || 'en'

    switch (normalized) {
      case 'en':
      case 'en-US':
      case 'en-GB':
        return 'languageConstants/1000'
      case 'es':
        return 'languageConstants/1003'
      case 'fr':
        return 'languageConstants/1002'
      case 'de':
        return 'languageConstants/1001'
      default:
        throw new Error(
          'Google Ads provider does not support language "' +
            normalized +
            '". Supported: en, en-US, en-GB, es, fr, de.'
        )
    }
  }
}
