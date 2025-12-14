import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GoogleAdsProvider } from '@/lib/api/providers/google-ads'
import type { SearchOptions } from '@/lib/api/types'

/**
 * Integration tests for Google Ads API Provider
 *
 * These tests verify the provider's integration with the Google Ads API
 * using mocked fetch responses to avoid requiring real API credentials in CI/CD.
 */
describe('GoogleAdsProvider Integration Tests', () => {
  let provider: GoogleAdsProvider
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Set up environment variables
    process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-developer-token'
    process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh-token'
    process.env.GOOGLE_ADS_CUSTOMER_ID = '123-456-7890'

    provider = new GoogleAdsProvider()

    // Mock global fetch
    fetchMock = vi.fn()
    global.fetch = fetchMock as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Clean up environment variables
    delete process.env.GOOGLE_ADS_CLIENT_ID
    delete process.env.GOOGLE_ADS_CLIENT_SECRET
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    delete process.env.GOOGLE_ADS_REFRESH_TOKEN
    delete process.env.GOOGLE_ADS_CUSTOMER_ID
  })

  describe('Configuration Validation', () => {
    it('should validate configuration successfully with all required env vars', () => {
      expect(() => provider.validateConfiguration()).not.toThrow()
    })

    it('should throw error when CLIENT_ID is missing', () => {
      delete process.env.GOOGLE_ADS_CLIENT_ID
      provider = new GoogleAdsProvider()

      expect(() => provider.validateConfiguration()).toThrow(
        /GOOGLE_ADS_CLIENT_ID/
      )
    })

    it('should throw error when multiple variables are missing', () => {
      delete process.env.GOOGLE_ADS_CLIENT_ID
      delete process.env.GOOGLE_ADS_CLIENT_SECRET
      provider = new GoogleAdsProvider()

      expect(() => provider.validateConfiguration()).toThrow(
        /GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET/
      )
    })
  })

  describe('API Integration', () => {
    it('should make successful OAuth token refresh request', async () => {
      // Mock OAuth token response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'https://www.googleapis.com/auth/adwords',
        }),
      })

      // Mock Google Ads API response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              keyword_plan_ad_group_keyword: {
                text: 'seo tools',
              },
              keyword_plan_keyword_forecast_metrics: {
                avg_monthly_searches: 12500,
                competition: 'HIGH',
                competition_index: 85,
                low_top_of_page_bid_micros: 7500000, // $7.50
                high_top_of_page_bid_micros: 9500000, // $9.50
              },
            },
          ],
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
        location: 'United States',
        language: 'en',
      }

      const result = await provider.getKeywordData(['seo tools'], options)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        keyword: 'seo tools',
        searchVolume: 12500,
        difficulty: 85,
        competition: 'high',
      })
      expect(result[0].cpc).toBeCloseTo(8.5, 1) // Average of $7.50 and $9.50
    })

    it('should handle OAuth token refresh failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid credentials',
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      await expect(provider.getKeywordData(['test'], options)).rejects.toThrow(
        /OAuth token refresh failed/
      )
    })

    it('should handle Google Ads API error response', async () => {
      // Successful OAuth
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
        }),
      })

      // Failed API request
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Permission denied',
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      await expect(provider.getKeywordData(['test'], options)).rejects.toThrow(
        /Google Ads API request failed/
      )
    })

    it('should handle keywords with no data', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [], // No results
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      const result = await provider.getKeywordData(['unknown keyword'], options)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        keyword: 'unknown keyword',
        searchVolume: 0,
        difficulty: 50,
        cpc: 0,
        competition: 'low',
        intent: 'informational',
      })
    })

    it('should handle multiple keywords', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              keyword_plan_ad_group_keyword: { text: 'seo tools' },
              keyword_plan_keyword_forecast_metrics: {
                avg_monthly_searches: 12500,
                competition: 'HIGH',
                competition_index: 85,
                low_top_of_page_bid_micros: 7500000,
                high_top_of_page_bid_micros: 9500000,
              },
            },
            {
              keyword_plan_ad_group_keyword: { text: 'keyword research' },
              keyword_plan_keyword_forecast_metrics: {
                avg_monthly_searches: 8200,
                competition: 'MEDIUM',
                competition_index: 54,
                low_top_of_page_bid_micros: 5000000,
                high_top_of_page_bid_micros: 7000000,
              },
            },
          ],
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      const result = await provider.getKeywordData(
        ['seo tools', 'keyword research'],
        options
      )

      expect(result).toHaveLength(2)
      expect(result[0].keyword).toBe('seo tools')
      expect(result[1].keyword).toBe('keyword research')
    })
  })

  describe('Response Transformation', () => {
    it('should correctly map competition levels', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              keyword_plan_ad_group_keyword: { text: 'low competition' },
              keyword_plan_keyword_forecast_metrics: {
                avg_monthly_searches: 1000,
                competition: 'LOW',
                competition_index: 20,
                low_top_of_page_bid_micros: 500000,
                high_top_of_page_bid_micros: 1000000,
              },
            },
            {
              keyword_plan_ad_group_keyword: { text: 'medium competition' },
              keyword_plan_keyword_forecast_metrics: {
                avg_monthly_searches: 5000,
                competition: 'MEDIUM',
                competition_index: 50,
                low_top_of_page_bid_micros: 2000000,
                high_top_of_page_bid_micros: 4000000,
              },
            },
            {
              keyword_plan_ad_group_keyword: { text: 'high competition' },
              keyword_plan_keyword_forecast_metrics: {
                avg_monthly_searches: 15000,
                competition: 'HIGH',
                competition_index: 90,
                low_top_of_page_bid_micros: 8000000,
                high_top_of_page_bid_micros: 12000000,
              },
            },
          ],
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      const result = await provider.getKeywordData(
        ['low competition', 'medium competition', 'high competition'],
        options
      )

      expect(result[0].competition).toBe('low')
      expect(result[1].competition).toBe('medium')
      expect(result[2].competition).toBe('high')
    })

    it('should correctly infer search intent', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            // Informational: low CPC, low competition, high volume
            {
              keyword_plan_ad_group_keyword: { text: 'what is seo' },
              keyword_plan_keyword_forecast_metrics: {
                avg_monthly_searches: 25000,
                competition: 'LOW',
                competition_index: 20,
                low_top_of_page_bid_micros: 300000,
                high_top_of_page_bid_micros: 700000,
              },
            },
            // Commercial: medium CPC, medium competition
            {
              keyword_plan_ad_group_keyword: { text: 'best seo tools' },
              keyword_plan_keyword_forecast_metrics: {
                avg_monthly_searches: 8000,
                competition: 'MEDIUM',
                competition_index: 55,
                low_top_of_page_bid_micros: 2500000,
                high_top_of_page_bid_micros: 3500000,
              },
            },
            // Transactional: high CPC, high competition
            {
              keyword_plan_ad_group_keyword: { text: 'buy seo tools' },
              keyword_plan_keyword_forecast_metrics: {
                avg_monthly_searches: 3000,
                competition: 'HIGH',
                competition_index: 85,
                low_top_of_page_bid_micros: 6000000,
                high_top_of_page_bid_micros: 8000000,
              },
            },
          ],
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      const result = await provider.getKeywordData(
        ['what is seo', 'best seo tools', 'buy seo tools'],
        options
      )

      expect(result[0].intent).toBe('informational')
      expect(result[1].intent).toBe('commercial')
      expect(result[2].intent).toBe('transactional')
    })
  })

  describe('Provider Metadata', () => {
    it('should return correct batch limit', () => {
      expect(provider.getBatchLimit()).toBe(1000)
    })

    it('should return correct rate limit', () => {
      const rateLimit = provider.getRateLimit()
      expect(rateLimit.requests).toBe(1000)
      expect(rateLimit.period).toBe('day')
    })

    it('should have correct provider name', () => {
      expect(provider.name).toBe('Google Ads')
    })
  })
})
