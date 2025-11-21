/**
 * Keyword search intent types
 */
export type KeywordIntent =
  | 'informational'
  | 'commercial'
  | 'transactional'
  | 'navigational'

/**
 * Keyword match types supported by the API
 */
export type MatchType = 'phrase' | 'exact'

/**
 * Competition level from keyword APIs
 */
export type Competition = 'low' | 'medium' | 'high'

/**
 * Individual keyword data from API
 */
export interface KeywordData {
  keyword: string
  searchVolume: number
  difficulty: number // 0-100 scale
  cpc: number // Cost per click in USD
  competition: Competition
  intent: KeywordIntent
}

/**
 * Keyword search request parameters
 */
export interface KeywordSearchParams {
  keywords: string[]
  matchType: MatchType
  location?: string
  language?: string
}

/**
 * Keyword search API response
 */
export interface KeywordSearchResponse {
  data: KeywordData[]
  cached: boolean
  timestamp: string
  mockData?: boolean // Indicates if data is from mock provider
  provider?: string // Name of the provider used
}

/**
 * Form state for keyword search
 */
export interface KeywordSearchFormData {
  keywordsInput: string // Comma or newline separated
  matchType: MatchType
  location: string
}
