/**
 * Content Brief Types
 *
 * AI-powered content briefs based on SERP analysis
 */

/**
 * A single SERP result item
 */
export interface SerpResult {
  position: number
  title: string
  url: string
  domain: string
  description: string
  wordCount?: number
}

/**
 * Content topic extracted from SERP analysis
 */
export interface ContentTopic {
  topic: string
  frequency: number // How many top results mention this
  importance: 'high' | 'medium' | 'low'
}

/**
 * Suggested heading for the content outline
 */
export interface SuggestedHeading {
  text: string
  level: 'h2' | 'h3'
  source: string // Which competitors use this
}

/**
 * Question to answer in the content
 */
export interface ContentQuestion {
  question: string
  source: 'paa' | 'competitor' | 'inferred' // People Also Ask, competitor content, or inferred
}

/**
 * The complete content brief
 */
export interface ContentBrief {
  keyword: string
  location: string
  generatedAt: string

  // SERP overview
  serpResults: SerpResult[]
  totalResults?: number

  // Content recommendations
  recommendedWordCount: {
    min: number
    max: number
    average: number
  }

  // Topics to cover
  topics: ContentTopic[]

  // Suggested outline
  suggestedHeadings: SuggestedHeading[]

  // Questions to answer
  questionsToAnswer: ContentQuestion[]

  // Related keywords to include
  relatedKeywords: string[]

  // Meta data
  mockData?: boolean
  provider?: string
}

/**
 * Content brief request parameters
 */
export interface ContentBriefRequest {
  keyword: string
  location?: string // ISO country code
  language?: string
}

/**
 * Content brief API response
 */
export interface ContentBriefResponse {
  brief: ContentBrief
  cached: boolean
  timestamp: string
}
