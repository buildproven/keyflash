import type { Competition, KeywordIntent } from './keyword'

/**
 * Related keyword data returned from providers
 */
export interface RelatedKeyword {
  keyword: string
  searchVolume: number
  difficulty?: number
  cpc?: number
  competition?: Competition
  intent?: KeywordIntent
  relevance: number // 0-100 score indicating how related to seed keyword
}

/**
 * Response from related keywords API
 */
export interface RelatedKeywordsResponse {
  seedKeyword: string
  relatedKeywords: RelatedKeyword[]
  cached: boolean
  timestamp: string
  provider?: string
}

/**
 * Request parameters for related keywords API
 */
export interface RelatedKeywordsRequest {
  keyword: string
  location?: string
  language?: string
  limit?: number // Max number of related keywords to return (default: 20)
}
