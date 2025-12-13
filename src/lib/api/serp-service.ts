/**
 * SERP Service - Fetches and analyzes search results
 *
 * Uses DataForSEO SERP API to get top organic results
 * and extract content insights for content briefs
 */

import { logger } from '@/lib/utils/logger'
import type {
  SerpResult,
  ContentBrief,
  ContentTopic,
  SuggestedHeading,
  ContentQuestion,
} from '@/types/content-brief'

/**
 * DataForSEO SERP API response types
 */
interface DataForSEOSerpItem {
  type?: string
  rank_group?: number
  rank_absolute?: number
  position?: string
  title?: string
  url?: string
  domain?: string
  description?: string
  breadcrumb?: string
  highlighted?: string[]
  extra?: {
    word_count?: number
  }
  about_this_result?: {
    source?: {
      source_name?: string
    }
  }
}

interface DataForSEOPAAItem {
  type?: string
  title?: string
  expanded_element?: Array<{
    type?: string
    title?: string
    description?: string
  }>
}

interface DataForSEOSerpTask {
  status_code?: number
  status_message?: string
  result?: Array<{
    keyword?: string
    se_results_count?: number
    items?: Array<DataForSEOSerpItem | DataForSEOPAAItem>
  }>
}

interface DataForSEOSerpResponse {
  status_code?: number
  status_message?: string
  tasks?: DataForSEOSerpTask[]
}

/**
 * Location code mapping for DataForSEO
 */
const LOCATION_CODES: Record<string, number> = {
  US: 2840,
  GB: 2826,
  CA: 2124,
  AU: 2036,
  DE: 2276,
  FR: 2250,
  IN: 2356,
  GL: 0, // Global
}

export class SerpService {
  private login: string
  private password: string

  constructor() {
    this.login = process.env.DATAFORSEO_API_LOGIN || ''
    this.password = process.env.DATAFORSEO_API_PASSWORD || ''
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.login && this.password)
  }

  /**
   * Get Basic Auth header
   */
  private getAuthHeader(): string {
    const credentials = `${this.login}:${this.password}`
    return `Basic ${Buffer.from(credentials).toString('base64')}`
  }

  /**
   * Fetch SERP results for a keyword
   */
  async getSerpResults(
    keyword: string,
    location: string = 'US',
    language: string = 'en'
  ): Promise<{
    results: SerpResult[]
    paaQuestions: string[]
    totalResults: number
  }> {
    if (!this.isConfigured()) {
      // Return mock data for development
      return this.getMockSerpResults(keyword)
    }

    try {
      const locationCode = LOCATION_CODES[location] || 2840

      const response = await fetch(
        'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
        {
          method: 'POST',
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              keyword,
              location_code: locationCode,
              language_code: language,
              depth: 10, // Top 10 results
              calculate_rectangles: false,
            },
          ]),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `SERP API request failed (${response.status}): ${errorText}`
        )
      }

      const data: DataForSEOSerpResponse = await response.json()

      if (data.status_code !== 20000) {
        throw new Error(
          `SERP API error (${data.status_code}): ${data.status_message}`
        )
      }

      return this.transformSerpResponse(data)
    } catch (error) {
      logger.error('SERP API error', error, { module: 'SerpService' })
      // Fall back to mock data on error
      return this.getMockSerpResults(keyword)
    }
  }

  /**
   * Transform DataForSEO response to our format
   */
  private transformSerpResponse(response: DataForSEOSerpResponse): {
    results: SerpResult[]
    paaQuestions: string[]
    totalResults: number
  } {
    const task = response.tasks?.[0]
    const result = task?.result?.[0]
    const items = result?.items || []

    const results: SerpResult[] = []
    const paaQuestions: string[] = []

    for (const item of items) {
      if (item.type === 'organic') {
        const organicItem = item as DataForSEOSerpItem
        results.push({
          position: organicItem.rank_group || results.length + 1,
          title: organicItem.title || '',
          url: organicItem.url || '',
          domain: organicItem.domain || '',
          description: organicItem.description || '',
          wordCount: organicItem.extra?.word_count,
        })
      } else if (item.type === 'people_also_ask') {
        const paaItem = item as DataForSEOPAAItem
        if (paaItem.title) {
          paaQuestions.push(paaItem.title)
        }
        // Also check expanded elements
        paaItem.expanded_element?.forEach(el => {
          if (el.title && !paaQuestions.includes(el.title)) {
            paaQuestions.push(el.title)
          }
        })
      }
    }

    return {
      results: results.slice(0, 10), // Top 10 only
      paaQuestions,
      totalResults: result?.se_results_count || 0,
    }
  }

  /**
   * Generate content brief from SERP results
   */
  async generateContentBrief(
    keyword: string,
    location: string = 'US',
    language: string = 'en'
  ): Promise<ContentBrief> {
    const { results, paaQuestions, totalResults } = await this.getSerpResults(
      keyword,
      location,
      language
    )

    // Calculate word count recommendations
    const wordCounts = results
      .filter(r => r.wordCount && r.wordCount > 0)
      .map(r => r.wordCount!)

    const avgWordCount =
      wordCounts.length > 0
        ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
        : 1500 // Default estimate

    // Extract topics from titles and descriptions
    const topics = this.extractTopics(results)

    // Generate suggested headings from competitor content
    const suggestedHeadings = this.extractHeadings(results, keyword)

    // Build questions to answer
    const questionsToAnswer = this.buildQuestions(
      paaQuestions,
      results,
      keyword
    )

    // Extract related keywords from descriptions
    const relatedKeywords = this.extractRelatedKeywords(results, keyword)

    const brief: ContentBrief = {
      keyword,
      location,
      generatedAt: new Date().toISOString(),
      serpResults: results,
      totalResults,
      recommendedWordCount: {
        min: Math.round(avgWordCount * 0.8),
        max: Math.round(avgWordCount * 1.3),
        average: avgWordCount,
      },
      topics,
      suggestedHeadings,
      questionsToAnswer,
      relatedKeywords,
      mockData: !this.isConfigured(),
      provider: this.isConfigured() ? 'DataForSEO' : 'Mock',
    }

    return brief
  }

  /**
   * Extract topics from SERP results
   */
  private extractTopics(results: SerpResult[]): ContentTopic[] {
    const topicCounts = new Map<string, number>()

    for (const result of results) {
      // Extract meaningful phrases from title and description
      const text = `${result.title} ${result.description}`.toLowerCase()
      const phrases = this.extractPhrases(text)

      for (const phrase of phrases) {
        topicCounts.set(phrase, (topicCounts.get(phrase) || 0) + 1)
      }
    }

    // Convert to array and sort by frequency
    const topics: ContentTopic[] = []
    for (const [topic, frequency] of topicCounts.entries()) {
      if (frequency >= 2) {
        // Only include topics mentioned by 2+ results
        topics.push({
          topic,
          frequency,
          importance:
            frequency >= 5 ? 'high' : frequency >= 3 ? 'medium' : 'low',
        })
      }
    }

    return topics.sort((a, b) => b.frequency - a.frequency).slice(0, 15)
  }

  /**
   * Extract meaningful phrases from text
   */
  private extractPhrases(text: string): string[] {
    // Remove common stop words and extract 2-3 word phrases
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'and',
      'or',
      'but',
      'if',
      'then',
      'else',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'also',
      'now',
      'here',
      'there',
      'this',
      'that',
      'these',
      'those',
      'what',
      'which',
      'who',
      'whom',
      'with',
      'from',
      'into',
      'for',
      'of',
      'to',
      'in',
      'on',
      'by',
      'about',
      'as',
      'at',
      'your',
      'our',
      'their',
      'its',
    ])

    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))

    const phrases: string[] = []

    // Extract 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`)
    }

    return phrases
  }

  /**
   * Extract heading suggestions from competitor content
   */
  private extractHeadings(
    results: SerpResult[],
    keyword: string
  ): SuggestedHeading[] {
    const headings: SuggestedHeading[] = []
    const keywordLower = keyword.toLowerCase()

    // Common heading patterns based on keyword
    const patterns = [
      `What is ${keyword}`,
      `How to ${keyword}`,
      `Why ${keyword}`,
      `Best ${keyword}`,
      `${keyword} Benefits`,
      `${keyword} Guide`,
      `${keyword} Tips`,
      `Getting Started with ${keyword}`,
      `${keyword} Examples`,
      `${keyword} vs`,
    ]

    // Add pattern-based suggestions
    for (const pattern of patterns.slice(0, 5)) {
      headings.push({
        text: pattern,
        level: 'h2',
        source: 'Common pattern',
      })
    }

    // Extract from result titles
    for (const result of results.slice(0, 5)) {
      const title = result.title
      if (title.length > 10 && title.length < 80) {
        // Clean up and use as heading suggestion
        const cleaned = title
          .replace(/\s*[-|]\s*.+$/, '') // Remove site name after - or |
          .replace(/^\d+\.\s*/, '') // Remove leading numbers
          .trim()

        if (cleaned.toLowerCase() !== keywordLower && cleaned.length > 10) {
          headings.push({
            text: cleaned,
            level: 'h2',
            source: result.domain,
          })
        }
      }
    }

    return headings.slice(0, 10)
  }

  /**
   * Build questions to answer
   */
  private buildQuestions(
    paaQuestions: string[],
    _results: SerpResult[], // Reserved for future competitor question extraction
    keyword: string
  ): ContentQuestion[] {
    const questions: ContentQuestion[] = []

    // Add People Also Ask questions
    for (const q of paaQuestions.slice(0, 5)) {
      questions.push({
        question: q,
        source: 'paa',
      })
    }

    // Add inferred questions based on keyword
    const inferredQuestions = [
      `What is ${keyword}?`,
      `How does ${keyword} work?`,
      `Why is ${keyword} important?`,
      `What are the benefits of ${keyword}?`,
      `How to get started with ${keyword}?`,
    ]

    for (const q of inferredQuestions) {
      if (
        !questions.some(
          existing => existing.question.toLowerCase() === q.toLowerCase()
        )
      ) {
        questions.push({
          question: q,
          source: 'inferred',
        })
      }
    }

    return questions.slice(0, 10)
  }

  /**
   * Extract related keywords from descriptions
   */
  private extractRelatedKeywords(
    results: SerpResult[],
    keyword: string
  ): string[] {
    const keywordLower = keyword.toLowerCase()
    const relatedSet = new Set<string>()

    for (const result of results) {
      const text = `${result.title} ${result.description}`.toLowerCase()

      // Extract phrases that might be related keywords
      const phrases = this.extractPhrases(text)
      for (const phrase of phrases) {
        // Only include if not the main keyword
        if (
          phrase !== keywordLower &&
          !phrase.includes(keywordLower) &&
          !keywordLower.includes(phrase)
        ) {
          relatedSet.add(phrase)
        }
      }
    }

    return Array.from(relatedSet).slice(0, 15)
  }

  /**
   * Mock SERP results for development/testing
   */
  private getMockSerpResults(keyword: string): {
    results: SerpResult[]
    paaQuestions: string[]
    totalResults: number
  } {
    const mockResults: SerpResult[] = [
      {
        position: 1,
        title: `Complete Guide to ${keyword} - Everything You Need to Know`,
        url: `https://example.com/${keyword.replace(/\s+/g, '-')}`,
        domain: 'example.com',
        description: `Learn everything about ${keyword} with our comprehensive guide. Discover best practices, tips, and expert insights.`,
        wordCount: 2500,
      },
      {
        position: 2,
        title: `${keyword}: A Beginner's Guide for 2025`,
        url: `https://guide.com/${keyword.replace(/\s+/g, '-')}`,
        domain: 'guide.com',
        description: `New to ${keyword}? This beginner's guide covers the basics and helps you get started quickly.`,
        wordCount: 1800,
      },
      {
        position: 3,
        title: `10 Best ${keyword} Strategies That Actually Work`,
        url: `https://tips.com/${keyword.replace(/\s+/g, '-')}-strategies`,
        domain: 'tips.com',
        description: `Discover proven ${keyword} strategies used by experts. Step-by-step instructions included.`,
        wordCount: 2200,
      },
      {
        position: 4,
        title: `${keyword} vs Alternatives: Complete Comparison`,
        url: `https://compare.com/${keyword.replace(/\s+/g, '-')}-comparison`,
        domain: 'compare.com',
        description: `Compare ${keyword} with popular alternatives. Find out which option is best for your needs.`,
        wordCount: 1500,
      },
      {
        position: 5,
        title: `How to Master ${keyword} in 30 Days`,
        url: `https://learn.com/master-${keyword.replace(/\s+/g, '-')}`,
        domain: 'learn.com',
        description: `Our 30-day plan to help you master ${keyword}. Includes exercises, templates, and expert tips.`,
        wordCount: 3000,
      },
    ]

    const mockPAA = [
      `What is ${keyword}?`,
      `How does ${keyword} work?`,
      `Is ${keyword} worth it?`,
      `What are the benefits of ${keyword}?`,
      `How much does ${keyword} cost?`,
    ]

    return {
      results: mockResults,
      paaQuestions: mockPAA,
      totalResults: 1250000,
    }
  }
}

// Export singleton instance
export const serpService = new SerpService()
