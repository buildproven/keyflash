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
  })
})
