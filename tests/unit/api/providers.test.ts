import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createProvider,
  getProvider,
  isProviderAvailable,
} from '@/lib/api/factory'
import { GoogleAdsProvider } from '@/lib/api/providers/google-ads'
import { DataForSEOProvider } from '@/lib/api/providers/dataforseo'

describe('Provider Factory', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('createProvider', () => {
    it('should create mock provider by default', () => {
      delete process.env.KEYWORD_API_PROVIDER

      const provider = createProvider()

      expect(provider.name).toBe('Mock')
    })

    it('should create Google Ads provider when specified', () => {
      process.env.KEYWORD_API_PROVIDER = 'google-ads'

      const provider = createProvider()

      expect(provider).toBeInstanceOf(GoogleAdsProvider)
      expect(provider.name).toBe('Google Ads')
    })

    it('should create DataForSEO provider when specified', () => {
      process.env.KEYWORD_API_PROVIDER = 'dataforseo'

      const provider = createProvider()

      expect(provider).toBeInstanceOf(DataForSEOProvider)
      expect(provider.name).toBe('DataForSEO')
    })

    it('should fall back to mock for unknown provider', () => {
      process.env.KEYWORD_API_PROVIDER = 'unknown'

      const provider = createProvider()

      expect(provider.name).toBe('Mock')
    })
  })

  describe('getProvider', () => {
    it('should return provider with validation', () => {
      process.env.KEYWORD_API_PROVIDER = 'mock'

      const provider = getProvider()

      expect(provider).toBeDefined()
      expect(provider.name).toBe('Mock')
    })

    it('should throw error if Google Ads credentials missing', () => {
      process.env.KEYWORD_API_PROVIDER = 'google-ads'
      delete process.env.GOOGLE_ADS_CLIENT_ID

      expect(() => getProvider()).toThrow(/configuration error/i)
    })

    it('should throw error if DataForSEO credentials missing', () => {
      process.env.KEYWORD_API_PROVIDER = 'dataforseo'
      delete process.env.DATAFORSEO_API_LOGIN

      expect(() => getProvider()).toThrow(/configuration error/i)
    })
  })

  describe('isProviderAvailable', () => {
    it('should return true for mock provider', () => {
      expect(isProviderAvailable('mock')).toBe(true)
    })

    it('should return false if Google Ads not configured', () => {
      delete process.env.GOOGLE_ADS_CLIENT_ID

      expect(isProviderAvailable('google-ads')).toBe(false)
    })

    it('should return false if DataForSEO not configured', () => {
      delete process.env.DATAFORSEO_API_LOGIN

      expect(isProviderAvailable('dataforseo')).toBe(false)
    })
  })

  describe('Mock Provider', () => {
    it('should return keyword data', async () => {
      const provider = createProvider()
      const keywords = ['seo tools', 'keyword research']

      const data = await provider.getKeywordData(keywords, {
        matchType: 'phrase',
      })

      expect(data).toHaveLength(2)
      expect(data[0].keyword).toBe('seo tools')
      expect(data[1].keyword).toBe('keyword research')
    })

    it('should have batch limit', () => {
      const provider = createProvider()

      expect(provider.getBatchLimit()).toBe(200)
    })

    it('should have rate limit info', () => {
      const provider = createProvider()

      const rateLimit = provider.getRateLimit()

      expect(rateLimit.requests).toBeGreaterThan(0)
      expect(rateLimit.period).toBeDefined()
    })
  })

  describe('GoogleAdsProvider', () => {
    it('should validate missing credentials', () => {
      delete process.env.GOOGLE_ADS_CLIENT_ID

      const provider = new GoogleAdsProvider()

      expect(() => provider.validateConfiguration()).toThrow(
        /missing configuration/i
      )
    })

    it('should have correct batch limit', () => {
      const provider = new GoogleAdsProvider()

      expect(provider.getBatchLimit()).toBe(1000)
    })

    it('should have correct rate limit', () => {
      const provider = new GoogleAdsProvider()
      const rateLimit = provider.getRateLimit()

      expect(rateLimit.requests).toBe(1000)
      expect(rateLimit.period).toBe('day')
    })

    it('should return mock keyword data when not configured', async () => {
      delete process.env.GOOGLE_ADS_CLIENT_ID

      const provider = new GoogleAdsProvider()
      const keywords = ['seo tools', 'keyword research']

      // getKeywordData calls validateConfiguration which throws
      await expect(
        provider.getKeywordData(keywords, { matchType: 'phrase' })
      ).rejects.toThrow(/missing configuration/i)
    })

    it('should return keyword data with correct structure when configured', async () => {
      process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-client-secret'
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-dev-token'
      process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh-token'
      process.env.GOOGLE_ADS_CUSTOMER_ID = 'test-customer-id'

      const provider = new GoogleAdsProvider()
      const keywords = ['seo tools', 'keyword research']

      const data = await provider.getKeywordData(keywords, {
        matchType: 'phrase',
      })

      expect(data).toHaveLength(2)
      expect(data[0]).toMatchObject({
        keyword: 'seo tools',
        searchVolume: expect.any(Number),
        difficulty: expect.any(Number),
        cpc: expect.any(Number),
        competition: expect.stringMatching(/^(low|medium|high)$/),
        intent: expect.stringMatching(
          /^(informational|commercial|transactional|navigational)$/
        ),
      })
      expect(data[1].keyword).toBe('keyword research')
    })

    it('should validate all required credentials individually', () => {
      const testCases = [
        'GOOGLE_ADS_CLIENT_ID',
        'GOOGLE_ADS_CLIENT_SECRET',
        'GOOGLE_ADS_DEVELOPER_TOKEN',
        'GOOGLE_ADS_REFRESH_TOKEN',
        'GOOGLE_ADS_CUSTOMER_ID',
      ]

      testCases.forEach(envVar => {
        // Set all credentials
        process.env.GOOGLE_ADS_CLIENT_ID = 'test'
        process.env.GOOGLE_ADS_CLIENT_SECRET = 'test'
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test'
        process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test'
        process.env.GOOGLE_ADS_CUSTOMER_ID = 'test'

        // Delete one credential
        delete process.env[envVar]

        const provider = new GoogleAdsProvider()

        expect(() => provider.validateConfiguration()).toThrow(
          new RegExp(envVar, 'i')
        )
      })
    })

    it('should generate random mock data for each keyword', async () => {
      process.env.GOOGLE_ADS_CLIENT_ID = 'test'
      process.env.GOOGLE_ADS_CLIENT_SECRET = 'test'
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test'
      process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test'
      process.env.GOOGLE_ADS_CUSTOMER_ID = 'test'

      const provider = new GoogleAdsProvider()
      const keywords = ['test1', 'test2', 'test3']

      const data = await provider.getKeywordData(keywords, {
        matchType: 'exact',
      })

      expect(data).toHaveLength(3)
      expect(data[0].keyword).toBe('test1')
      expect(data[1].keyword).toBe('test2')
      expect(data[2].keyword).toBe('test3')

      // Verify data ranges
      data.forEach(item => {
        expect(item.searchVolume).toBeGreaterThanOrEqual(0)
        expect(item.searchVolume).toBeLessThan(100000)
        expect(item.difficulty).toBeGreaterThanOrEqual(0)
        expect(item.difficulty).toBeLessThan(100)
        expect(item.cpc).toBeGreaterThanOrEqual(0)
        expect(item.cpc).toBeLessThan(10)
      })
    })
  })

  describe('DataForSEOProvider', () => {
    it('should validate missing credentials', () => {
      delete process.env.DATAFORSEO_API_LOGIN

      const provider = new DataForSEOProvider()

      expect(() => provider.validateConfiguration()).toThrow(
        /missing configuration/i
      )
    })

    it('should have correct batch limit', () => {
      const provider = new DataForSEOProvider()

      expect(provider.getBatchLimit()).toBe(10000)
    })

    it('should have correct rate limit', () => {
      const provider = new DataForSEOProvider()
      const rateLimit = provider.getRateLimit()

      expect(rateLimit.requests).toBe(2000)
      expect(rateLimit.period).toBe('day')
    })

    it('should return mock keyword data when not configured', async () => {
      delete process.env.DATAFORSEO_API_LOGIN

      const provider = new DataForSEOProvider()
      const keywords = ['seo tools']

      await expect(
        provider.getKeywordData(keywords, { matchType: 'phrase' })
      ).rejects.toThrow(/missing configuration/i)
    })

    it('should return keyword data with correct structure when configured', async () => {
      process.env.DATAFORSEO_API_LOGIN = 'test-login'
      process.env.DATAFORSEO_API_PASSWORD = 'test-password'

      const provider = new DataForSEOProvider()
      const keywords = ['content marketing', 'digital strategy']

      const data = await provider.getKeywordData(keywords, {
        matchType: 'exact',
        location: 'US',
        language: 'en',
      })

      expect(data).toHaveLength(2)
      expect(data[0]).toMatchObject({
        keyword: 'content marketing',
        searchVolume: expect.any(Number),
        difficulty: expect.any(Number),
        cpc: expect.any(Number),
        competition: expect.stringMatching(/^(low|medium|high)$/),
        intent: expect.stringMatching(
          /^(informational|commercial|transactional|navigational)$/
        ),
      })
      expect(data[1].keyword).toBe('digital strategy')
    })

    it('should validate all required credentials individually', () => {
      const testCases = ['DATAFORSEO_API_LOGIN', 'DATAFORSEO_API_PASSWORD']

      testCases.forEach(envVar => {
        // Set all credentials
        process.env.DATAFORSEO_API_LOGIN = 'test'
        process.env.DATAFORSEO_API_PASSWORD = 'test'

        // Delete one credential
        delete process.env[envVar]

        const provider = new DataForSEOProvider()

        expect(() => provider.validateConfiguration()).toThrow(
          new RegExp(envVar, 'i')
        )
      })
    })

    it('should generate random mock data for multiple keywords', async () => {
      process.env.DATAFORSEO_API_LOGIN = 'test'
      process.env.DATAFORSEO_API_PASSWORD = 'test'

      const provider = new DataForSEOProvider()
      const keywords = Array(10)
        .fill(0)
        .map((_, i) => `keyword${i}`)

      const data = await provider.getKeywordData(keywords, {
        matchType: 'phrase',
      })

      expect(data).toHaveLength(10)

      // Verify all keywords are present
      keywords.forEach((keyword, index) => {
        expect(data[index].keyword).toBe(keyword)
      })

      // Verify data validity
      data.forEach(item => {
        expect(item.searchVolume).toBeGreaterThanOrEqual(0)
        expect(item.difficulty).toBeGreaterThanOrEqual(0)
        expect(item.cpc).toBeGreaterThanOrEqual(0)
        expect(['low', 'medium', 'high']).toContain(item.competition)
        expect([
          'informational',
          'commercial',
          'transactional',
          'navigational',
        ]).toContain(item.intent)
      })
    })
  })
})
