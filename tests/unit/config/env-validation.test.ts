import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock console methods to test logging
const originalConsole = { ...console }
const mockConsoleInfo = vi.fn()
const mockConsoleError = vi.fn()
const mockProcessExit = vi.fn()

// Mock process.exit
vi.stubGlobal('process', {
  ...process,
  exit: mockProcessExit,
})

describe('Environment Validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console methods for testing
    /* eslint-disable no-console -- Necessary for testing console output */
    console.info = mockConsoleInfo
    console.error = mockConsoleError
    /* eslint-enable no-console */

    // Reset environment - clear all env vars first
    process.env = {}

    // Reset module cache to ensure fresh import
    vi.resetModules()
  })

  afterEach(() => {
    // Restore environment
    process.env = originalEnv
    // Restore console
    Object.assign(console, originalConsole)
  })

  it('should validate successfully with valid mock provider configuration', async () => {
    // Setup valid environment
    process.env.KEYWORD_API_PROVIDER = 'mock'
    process.env.NODE_ENV = 'test'

    // Dynamic import to trigger validation
    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).not.toThrow()
    expect(mockProcessExit).not.toHaveBeenCalled()
    expect(mockConsoleInfo).toHaveBeenCalledWith(
      '✅ Environment configuration validated successfully'
    )
  })

  it('should fail validation when google-ads provider is missing required variables', async () => {
    // Setup invalid environment
    process.env.KEYWORD_API_PROVIDER = 'google-ads'
    process.env.NODE_ENV = 'test'
    // Missing GOOGLE_ADS_* variables

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).toThrow()
    expect(mockConsoleError).toHaveBeenCalledWith(
      '❌ Environment configuration validation failed:'
    )
  })

  it('should fail validation when dataforseo provider is missing required variables', async () => {
    // Setup invalid environment
    process.env.KEYWORD_API_PROVIDER = 'dataforseo'
    process.env.NODE_ENV = 'test'
    // Missing DATAFORSEO_* variables

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).toThrow()
    expect(mockConsoleError).toHaveBeenCalledWith(
      '❌ Environment configuration validation failed:'
    )
  })

  it('should warn about missing Redis in production without privacy mode', async () => {
    // Setup production environment without Redis
    process.env.KEYWORD_API_PROVIDER = 'mock'
    process.env.NODE_ENV = 'production'
    process.env.PRIVACY_MODE = 'false'
    process.env.RATE_LIMIT_HMAC_SECRET = 'test-secret-at-least-16-chars'
    delete process.env.UPSTASH_REDIS_REST_URL

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).not.toThrow()
    // Check if warning was logged (it should be among the console.info calls)
    expect(mockConsoleInfo).toHaveBeenCalled()
    const calls = mockConsoleInfo.mock.calls.flat()
    expect(
      calls.some((call: string) =>
        call.includes('Production environment detected without Redis')
      )
    ).toBe(true)
  })

  it('should validate google-ads provider with all required variables', async () => {
    // Setup complete Google Ads configuration
    process.env.KEYWORD_API_PROVIDER = 'google-ads'
    process.env.NODE_ENV = 'test'
    process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-dev-token'
    process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh-token'
    process.env.GOOGLE_ADS_CUSTOMER_ID = 'test-customer-id'

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).not.toThrow()
    expect(mockConsoleInfo).toHaveBeenCalledWith(
      '✅ Environment configuration validated successfully'
    )
    expect(mockConsoleInfo).toHaveBeenCalledWith('📦 Provider: google-ads')
  })

  it('should validate dataforseo provider with all required variables', async () => {
    // Setup complete DataForSEO configuration
    process.env.KEYWORD_API_PROVIDER = 'dataforseo'
    process.env.NODE_ENV = 'test'
    process.env.DATAFORSEO_API_LOGIN = 'test-login'
    process.env.DATAFORSEO_API_PASSWORD = 'test-password'

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).not.toThrow()
    expect(mockConsoleInfo).toHaveBeenCalledWith(
      '✅ Environment configuration validated successfully'
    )
    expect(mockConsoleInfo).toHaveBeenCalledWith('📦 Provider: dataforseo')
  })

  it('should handle invalid rate limit values', async () => {
    // Setup environment with invalid rate limit
    process.env.KEYWORD_API_PROVIDER = 'mock'
    process.env.NODE_ENV = 'test'
    process.env.RATE_LIMIT_REQUESTS_PER_HOUR = 'invalid'

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).toThrow()
    expect(mockConsoleError).toHaveBeenCalledWith(
      '❌ Environment configuration validation failed:'
    )
  })
})
