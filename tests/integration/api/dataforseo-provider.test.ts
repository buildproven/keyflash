import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataForSEOProvider } from '@/lib/api/providers/dataforseo'
import type { SearchOptions } from '@/lib/api/types'

/**
 * Integration tests for DataForSEO API Provider
 *
 * These tests verify the provider's integration with the DataForSEO API
 * using mocked fetch responses to avoid requiring real API credentials in CI/CD.
 */
describe('DataForSEOProvider Integration Tests', () => {
  let provider: DataForSEOProvider
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Set up environment variables
    process.env.DATAFORSEO_API_LOGIN = 'test-login'
    process.env.DATAFORSEO_API_PASSWORD = 'test-password'

    provider = new DataForSEOProvider()

    // Mock global fetch
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Clean up environment variables
    delete process.env.DATAFORSEO_API_LOGIN
    delete process.env.DATAFORSEO_API_PASSWORD
  })

  describe('Configuration Validation', () => {
    it('should validate configuration successfully with all required env vars', () => {
      expect(() => provider.validateConfiguration()).not.toThrow()
    })

    it('should throw error when LOGIN is missing', () => {
      delete process.env.DATAFORSEO_API_LOGIN
      provider = new DataForSEOProvider()

      expect(() => provider.validateConfiguration()).toThrow(
        /DATAFORSEO_API_LOGIN/
      )
    })

    it('should throw error when PASSWORD is missing', () => {
      delete process.env.DATAFORSEO_API_PASSWORD
      provider = new DataForSEOProvider()

      expect(() => provider.validateConfiguration()).toThrow(
        /DATAFORSEO_API_PASSWORD/
      )
    })

    it('should throw error when both variables are missing', () => {
      delete process.env.DATAFORSEO_API_LOGIN
      delete process.env.DATAFORSEO_API_PASSWORD
      provider = new DataForSEOProvider()

      expect(() => provider.validateConfiguration()).toThrow(
        /DATAFORSEO_API_LOGIN, DATAFORSEO_API_PASSWORD/
      )
    })
  })

  describe('API Integration', () => {
    it('should make successful API request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 20000,
          status_message: 'Ok.',
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  keyword: 'seo tools',
                  search_volume_info: {
                    search_volume: 12500,
                    competition: 0.85,
                    competition_level: 'HIGH',
                    cpc: 8.5,
                    low_top_of_page_bid: 7.5,
                    high_top_of_page_bid: 9.5,
                  },
                  keyword_properties: {
                    keyword_difficulty: 85,
                  },
                },
              ],
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
        cpc: 8.5,
        competition: 'high',
      })
    })

    it('should handle API error response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      await expect(provider.getKeywordData(['test'], options)).rejects.toThrow(
        /DataForSEO API request failed/
      )
    })

    it('should handle DataForSEO API-level errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 40101,
          status_message: 'Authentication failed',
          tasks: [],
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      await expect(provider.getKeywordData(['test'], options)).rejects.toThrow(
        /DataForSEO API error \(40101\)/
      )
    })

    it('should handle keywords with no data', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [], // No results
            },
          ],
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
        json: async () => ({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  keyword: 'seo tools',
                  search_volume_info: {
                    search_volume: 12500,
                    competition: 0.85,
                    competition_level: 'HIGH',
                    cpc: 8.5,
                  },
                  keyword_properties: {
                    keyword_difficulty: 85,
                  },
                },
                {
                  keyword: 'keyword research',
                  search_volume_info: {
                    search_volume: 8200,
                    competition: 0.54,
                    competition_level: 'MEDIUM',
                    cpc: 6.25,
                  },
                  keyword_properties: {
                    keyword_difficulty: 54,
                  },
                },
              ],
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

    it('should correctly handle keyword from different response locations', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                // Keyword at top level
                {
                  keyword: 'top level keyword',
                  search_volume_info: {
                    search_volume: 5000,
                    competition: 0.5,
                    competition_level: 'MEDIUM',
                    cpc: 3.0,
                  },
                  keyword_properties: {
                    keyword_difficulty: 50,
                  },
                },
                // Keyword in keyword_info
                {
                  keyword_info: {
                    keyword: 'keyword info keyword',
                    monthly_searches: [
                      { month: 1, year: 2025, search_volume: 6000 },
                    ],
                  },
                  search_volume_info: {
                    competition: 0.4,
                    competition_level: 'LOW',
                    cpc: 2.0,
                  },
                  keyword_properties: {
                    keyword_difficulty: 40,
                  },
                },
              ],
            },
          ],
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      const result = await provider.getKeywordData(
        ['top level keyword', 'keyword info keyword'],
        options
      )

      expect(result).toHaveLength(2)
      expect(result[0].keyword).toBe('top level keyword')
      expect(result[0].searchVolume).toBe(5000)
      expect(result[1].keyword).toBe('keyword info keyword')
      expect(result[1].searchVolume).toBe(6000) // From monthly_searches
    })
  })

  describe('Response Transformation', () => {
    it('should correctly map competition levels from competition_level', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  keyword: 'low competition',
                  search_volume_info: {
                    search_volume: 1000,
                    competition_level: 'LOW',
                    cpc: 0.5,
                  },
                  keyword_properties: {
                    keyword_difficulty: 20,
                  },
                },
                {
                  keyword: 'medium competition',
                  search_volume_info: {
                    search_volume: 5000,
                    competition_level: 'MEDIUM',
                    cpc: 3.0,
                  },
                  keyword_properties: {
                    keyword_difficulty: 50,
                  },
                },
                {
                  keyword: 'high competition',
                  search_volume_info: {
                    search_volume: 15000,
                    competition_level: 'HIGH',
                    cpc: 10.0,
                  },
                  keyword_properties: {
                    keyword_difficulty: 90,
                  },
                },
              ],
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

    it('should correctly map competition levels from competition index', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  keyword: 'low index',
                  search_volume_info: {
                    search_volume: 1000,
                    competition: 0.2, // < 0.33 = low
                    cpc: 0.5,
                  },
                  keyword_properties: {
                    keyword_difficulty: 20,
                  },
                },
                {
                  keyword: 'medium index',
                  search_volume_info: {
                    search_volume: 5000,
                    competition: 0.5, // 0.33-0.67 = medium
                    cpc: 3.0,
                  },
                  keyword_properties: {
                    keyword_difficulty: 50,
                  },
                },
                {
                  keyword: 'high index',
                  search_volume_info: {
                    search_volume: 15000,
                    competition: 0.9, // > 0.67 = high
                    cpc: 10.0,
                  },
                  keyword_properties: {
                    keyword_difficulty: 90,
                  },
                },
              ],
            },
          ],
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      const result = await provider.getKeywordData(
        ['low index', 'medium index', 'high index'],
        options
      )

      expect(result[0].competition).toBe('low')
      expect(result[1].competition).toBe('medium')
      expect(result[2].competition).toBe('high')
    })

    it('should correctly infer search intent', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                // Informational: low CPC, low competition, high volume
                {
                  keyword: 'what is seo',
                  search_volume_info: {
                    search_volume: 25000,
                    competition: 0.2,
                    competition_level: 'LOW',
                    cpc: 0.5,
                  },
                  keyword_properties: {
                    keyword_difficulty: 20,
                  },
                },
                // Commercial: medium CPC, medium competition
                {
                  keyword: 'best seo tools',
                  search_volume_info: {
                    search_volume: 8000,
                    competition: 0.5,
                    competition_level: 'MEDIUM',
                    cpc: 3.0,
                  },
                  keyword_properties: {
                    keyword_difficulty: 55,
                  },
                },
                // Transactional: high CPC, high competition
                {
                  keyword: 'buy seo tools',
                  search_volume_info: {
                    search_volume: 3000,
                    competition: 0.9,
                    competition_level: 'HIGH',
                    cpc: 7.0,
                  },
                  keyword_properties: {
                    keyword_difficulty: 85,
                  },
                },
                // Navigational: low volume
                {
                  keyword: 'ahrefs login',
                  search_volume_info: {
                    search_volume: 500,
                    competition: 0.3,
                    competition_level: 'LOW',
                    cpc: 1.0,
                  },
                  keyword_properties: {
                    keyword_difficulty: 30,
                  },
                },
              ],
            },
          ],
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      const result = await provider.getKeywordData(
        ['what is seo', 'best seo tools', 'buy seo tools', 'ahrefs login'],
        options
      )

      expect(result[0].intent).toBe('informational')
      expect(result[1].intent).toBe('commercial')
      expect(result[2].intent).toBe('transactional')
      expect(result[3].intent).toBe('navigational')
    })
  })

  describe('Provider Metadata', () => {
    it('should return correct batch limit', () => {
      expect(provider.getBatchLimit()).toBe(10000)
    })

    it('should return correct rate limit', () => {
      const rateLimit = provider.getRateLimit()
      expect(rateLimit.requests).toBe(2000)
      expect(rateLimit.period).toBe('day')
    })

    it('should have correct provider name', () => {
      expect(provider.name).toBe('DataForSEO')
    })
  })

  describe('Authentication', () => {
    it('should send correct Basic Auth header', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status_code: 20000,
          tasks: [{ status_code: 20000, result: [] }],
        }),
      })

      const options: SearchOptions = {
        matchType: 'phrase',
      }

      await provider.getKeywordData(['test'], options)

      // Verify fetch was called with correct auth header
      expect(fetchMock).toHaveBeenCalled()
      const fetchCall = fetchMock.mock.calls[0]
      const headers = fetchCall[1]?.headers

      expect(headers).toHaveProperty('Authorization')
      expect(headers.Authorization).toMatch(/^Basic /)

      // Decode and verify credentials
      const base64Creds = headers.Authorization.replace('Basic ', '')
      const decodedCreds = Buffer.from(base64Creds, 'base64').toString('utf-8')
      expect(decodedCreds).toBe('test-login:test-password')
    })
  })
})
