import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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

    // Reset environment - clear all env vars first
    process.env = { NODE_ENV: 'test' } as NodeJS.ProcessEnv

    // Reset module cache to ensure fresh import
    vi.resetModules()
  })

  afterEach(() => {
    // Restore environment
    process.env = originalEnv
  })

  it('should validate successfully with valid mock provider configuration', async () => {
    // Setup valid environment
    process.env.KEYWORD_API_PROVIDER = 'mock'
    ;(process.env as Record<string, string>).NODE_ENV = 'test'

    // Dynamic import to trigger validation
    const { validateEnvironment } = await import('@/lib/config/env-validation')

    // Should not throw and should return validated config
    const result = validateEnvironment()
    expect(result).toBeDefined()
    expect(result.KEYWORD_API_PROVIDER).toBe('mock')
    expect(mockProcessExit).not.toHaveBeenCalled()
  })

  it('should fail validation when google-ads provider is missing required variables', async () => {
    // Setup invalid environment
    process.env.KEYWORD_API_PROVIDER = 'google-ads'
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    // Missing GOOGLE_ADS_* variables

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).toThrow(/Google Ads provider selected/)
  })

  it('should fail validation when dataforseo provider is missing required variables', async () => {
    // Setup invalid environment
    process.env.KEYWORD_API_PROVIDER = 'dataforseo'
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    // Missing DATAFORSEO_* variables

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).toThrow(/DataForSEO provider selected/)
  })

  it('should warn about missing Redis in production without privacy mode', async () => {
    // Setup production environment without Redis
    process.env.KEYWORD_API_PROVIDER = 'mock'
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    process.env.PRIVACY_MODE = 'false'
    process.env.RATE_LIMIT_HMAC_SECRET = 'test-secret-at-least-16-chars'
    process.env.RATE_LIMIT_TRUST_PROXY = 'true'
    delete process.env.UPSTASH_REDIS_REST_URL

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    // Should not throw even without Redis in production
    const result = validateEnvironment()
    expect(result).toBeDefined()
    expect(result.NODE_ENV).toBe('production')
  })

  it('should validate google-ads provider with all required variables', async () => {
    // Setup complete Google Ads configuration
    process.env.KEYWORD_API_PROVIDER = 'google-ads'
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-dev-token'
    process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh-token'
    process.env.GOOGLE_ADS_CUSTOMER_ID = 'test-customer-id'

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    const result = validateEnvironment()
    expect(result).toBeDefined()
    expect(result.KEYWORD_API_PROVIDER).toBe('google-ads')
    expect(result.GOOGLE_ADS_CLIENT_ID).toBe('test-client-id')
  })

  it('should validate dataforseo provider with all required variables', async () => {
    // Setup complete DataForSEO configuration
    process.env.KEYWORD_API_PROVIDER = 'dataforseo'
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    process.env.DATAFORSEO_API_LOGIN = 'test-login'
    process.env.DATAFORSEO_API_PASSWORD = 'test-password'

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    const result = validateEnvironment()
    expect(result).toBeDefined()
    expect(result.KEYWORD_API_PROVIDER).toBe('dataforseo')
    expect(result.DATAFORSEO_API_LOGIN).toBe('test-login')
  })

  it('should handle invalid rate limit values', async () => {
    // Setup environment with invalid rate limit
    process.env.KEYWORD_API_PROVIDER = 'mock'
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    process.env.RATE_LIMIT_REQUESTS_PER_HOUR = 'invalid'

    const { validateEnvironment } = await import('@/lib/config/env-validation')

    expect(() => validateEnvironment()).toThrow(/expected number, received NaN/)
  })
})
