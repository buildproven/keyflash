import type { KeywordData } from '@/types/keyword'
import type { RelatedKeyword } from '@/types/related-keywords'

/**
 * Search options for keyword API requests
 */
export interface SearchOptions {
  matchType: 'phrase' | 'exact'
  location?: string
  language?: string
}

/**
 * Rate limit configuration for API provider
 */
export interface RateLimit {
  requests: number
  period: 'minute' | 'hour' | 'day'
}

/**
 * API Provider response with metadata
 */
export interface ProviderResponse {
  data: KeywordData[]
  cached: boolean
  provider: string
  requestId?: string
  rateLimit?: {
    remaining: number
    resetAt: string
  }
}

/**
 * Base interface for keyword API providers
 * All providers (Google Ads, DataForSEO) must implement this interface
 */
export interface KeywordAPIProvider {
  /**
   * Provider name for logging and debugging
   */
  readonly name: string

  /**
   * Fetch keyword data from the provider
   * @param keywords - Array of keywords to research
   * @param options - Search configuration options
   * @returns Promise with keyword data
   */
  getKeywordData(
    keywords: string[],
    options: SearchOptions
  ): Promise<KeywordData[]>

  /**
   * Maximum number of keywords allowed per request
   */
  getBatchLimit(): number

  /**
   * Rate limit information for this provider
   */
  getRateLimit(): RateLimit

  /**
   * Check if provider is properly configured
   * @throws Error if credentials are missing
   */
  validateConfiguration(): void

  /**
   * Fetch related/similar keywords for a seed keyword
   * @param keyword - Seed keyword to find related terms for
   * @param options - Search configuration options
   * @returns Promise with related keyword data
   */
  getRelatedKeywords?(
    keyword: string,
    options: SearchOptions
  ): Promise<RelatedKeyword[]>
}

/**
 * Provider configuration options
 */
export interface ProviderConfig {
  apiKey?: string
  apiSecret?: string
  clientId?: string
  clientSecret?: string
  developerToken?: string
  refreshToken?: string
  customerId?: string
  login?: string
  password?: string
}
