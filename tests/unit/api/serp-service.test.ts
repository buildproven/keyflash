import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SerpService } from '@/lib/api/serp-service'

describe('SerpService', () => {
  let originalEnv: NodeJS.ProcessEnv
  let service: SerpService

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('isConfigured', () => {
    it('returns false when credentials are not set', () => {
      delete process.env.DATAFORSEO_API_LOGIN
      delete process.env.DATAFORSEO_API_PASSWORD
      service = new SerpService()

      expect(service.isConfigured()).toBe(false)
    })

    it('returns true when credentials are set', () => {
      process.env.DATAFORSEO_API_LOGIN = 'test@example.com'
      process.env.DATAFORSEO_API_PASSWORD = 'test-password'
      service = new SerpService()

      expect(service.isConfigured()).toBe(true)
    })
  })

  describe('getSerpResults', () => {
    it('returns mock results when not configured', async () => {
      delete process.env.DATAFORSEO_API_LOGIN
      delete process.env.DATAFORSEO_API_PASSWORD
      service = new SerpService()

      const result = await service.getSerpResults('keyword research')

      expect(result.results).toHaveLength(5) // Mock returns 5 results
      expect(result.paaQuestions).toHaveLength(5)
      expect(result.totalResults).toBe(1250000)
    })

    it('includes keyword in mock results', async () => {
      delete process.env.DATAFORSEO_API_LOGIN
      delete process.env.DATAFORSEO_API_PASSWORD
      service = new SerpService()

      const result = await service.getSerpResults('seo tools')

      expect(result.results[0].title).toContain('seo tools')
      expect(result.paaQuestions[0]).toContain('seo tools')
    })
  })

  describe('generateContentBrief', () => {
    beforeEach(() => {
      delete process.env.DATAFORSEO_API_LOGIN
      delete process.env.DATAFORSEO_API_PASSWORD
      service = new SerpService()
    })

    it('returns a complete content brief', async () => {
      const brief = await service.generateContentBrief('test keyword')

      expect(brief.keyword).toBe('test keyword')
      expect(brief.location).toBe('US')
      expect(brief.generatedAt).toBeDefined()
      expect(brief.serpResults).toBeDefined()
      expect(brief.recommendedWordCount).toBeDefined()
      expect(brief.topics).toBeDefined()
      expect(brief.suggestedHeadings).toBeDefined()
      expect(brief.questionsToAnswer).toBeDefined()
      expect(brief.relatedKeywords).toBeDefined()
    })

    it('includes word count recommendations', async () => {
      const brief = await service.generateContentBrief('test keyword')

      expect(brief.recommendedWordCount.min).toBeGreaterThan(0)
      expect(brief.recommendedWordCount.max).toBeGreaterThan(
        brief.recommendedWordCount.min
      )
      expect(brief.recommendedWordCount.average).toBeGreaterThan(0)
    })

    it('includes topics to cover', async () => {
      const brief = await service.generateContentBrief('test keyword')

      expect(Array.isArray(brief.topics)).toBe(true)
      if (brief.topics.length > 0) {
        expect(brief.topics[0]).toHaveProperty('topic')
        expect(brief.topics[0]).toHaveProperty('frequency')
        expect(brief.topics[0]).toHaveProperty('importance')
      }
    })

    it('includes suggested headings', async () => {
      const brief = await service.generateContentBrief('test keyword')

      expect(Array.isArray(brief.suggestedHeadings)).toBe(true)
      if (brief.suggestedHeadings.length > 0) {
        expect(brief.suggestedHeadings[0]).toHaveProperty('text')
        expect(brief.suggestedHeadings[0]).toHaveProperty('level')
        expect(brief.suggestedHeadings[0]).toHaveProperty('source')
      }
    })

    it('includes questions to answer', async () => {
      const brief = await service.generateContentBrief('test keyword')

      expect(Array.isArray(brief.questionsToAnswer)).toBe(true)
      if (brief.questionsToAnswer.length > 0) {
        expect(brief.questionsToAnswer[0]).toHaveProperty('question')
        expect(brief.questionsToAnswer[0]).toHaveProperty('source')
      }
    })

    it('indicates mock data when not configured', async () => {
      const brief = await service.generateContentBrief('test keyword')

      expect(brief.mockData).toBe(true)
      expect(brief.provider).toBe('Mock')
    })

    it('uses provided location', async () => {
      const brief = await service.generateContentBrief('test keyword', 'GB')

      expect(brief.location).toBe('GB')
    })
  })
})
