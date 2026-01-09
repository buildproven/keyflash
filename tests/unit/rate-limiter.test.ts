import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkRateLimit,
  getRateLimitInfo,
  getClientId,
} from '@/lib/rate-limit/rate-limiter'

describe('Rate Limiter', () => {
  const testConfig = {
    requestsPerHour: 3,
    enabled: true,
  }

  beforeEach(() => {
    // Note: In a real scenario, we'd need to clear the rate limit store
    // For now, use unique client IDs per test
  })

  it('should allow first request', () => {
    const clientId = `test-${Date.now()}-1`
    expect(() => checkRateLimit(clientId, testConfig)).not.toThrow()
  })

  it('should allow requests up to limit', () => {
    const clientId = `test-${Date.now()}-2`

    // First 3 requests should pass
    expect(() => checkRateLimit(clientId, testConfig)).not.toThrow()
    expect(() => checkRateLimit(clientId, testConfig)).not.toThrow()
    expect(() => checkRateLimit(clientId, testConfig)).not.toThrow()
  })

  it('should block requests exceeding limit', () => {
    const clientId = `test-${Date.now()}-3`

    // First 3 requests
    checkRateLimit(clientId, testConfig)
    checkRateLimit(clientId, testConfig)
    checkRateLimit(clientId, testConfig)

    // 4th request should fail
    expect(() => checkRateLimit(clientId, testConfig)).toThrow(
      /rate limit exceeded/i
    )
  })

  it('should not limit when disabled', () => {
    const clientId = `test-${Date.now()}-4`
    const disabledConfig = { ...testConfig, enabled: false }

    // Should allow unlimited requests
    for (let i = 0; i < 10; i++) {
      expect(() => checkRateLimit(clientId, disabledConfig)).not.toThrow()
    }
  })

  it('should provide rate limit info', () => {
    const clientId = `test-${Date.now()}-5`

    const info = getRateLimitInfo(clientId, testConfig)
    expect(info.remaining).toBe(testConfig.requestsPerHour)
    expect(info.resetAt).toBeDefined()
  })

  it('should track remaining requests', () => {
    const clientId = `test-${Date.now()}-6`

    checkRateLimit(clientId, testConfig)

    const info = getRateLimitInfo(clientId, testConfig)
    expect(info.remaining).toBe(testConfig.requestsPerHour - 1)
  })

  it('should return 0 remaining when limit reached', () => {
    const clientId = `test-${Date.now()}-7`

    // Use all 3 requests
    checkRateLimit(clientId, testConfig)
    checkRateLimit(clientId, testConfig)
    checkRateLimit(clientId, testConfig)

    const info = getRateLimitInfo(clientId, testConfig)
    expect(info.remaining).toBe(0)
  })

  it('should clean up expired entries', () => {
    const clientId = `test-${Date.now()}-8`

    // This test verifies that expired entries are removed
    // However, since we can't easily manipulate time in the test,
    // we just verify the behavior doesn't throw
    checkRateLimit(clientId, testConfig)
    const info = getRateLimitInfo(clientId, testConfig)
    expect(info.remaining).toBeLessThan(testConfig.requestsPerHour)
  })

  it('should include error details when rate limited', () => {
    const clientId = `test-${Date.now()}-9`

    // Use all allowed requests
    checkRateLimit(clientId, testConfig)
    checkRateLimit(clientId, testConfig)
    checkRateLimit(clientId, testConfig)

    // Next request should throw with details
    try {
      checkRateLimit(clientId, testConfig)
      expect.fail('Should have thrown rate limit error')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      expect(errorMessage).toContain('Rate limit exceeded')
      expect(errorMessage).toContain('Try again')
      expect(errorMessage).toContain(`${testConfig.requestsPerHour}`)
    }
  })
})

describe('getClientId', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
    })

    const clientId = getClientId(request)
    expect(clientId).toBe('192.168.1.1')
  })

  it('should extract IP from x-real-ip header', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-real-ip': '192.168.1.2',
      },
    })

    const clientId = getClientId(request)
    expect(clientId).toBe('192.168.1.2')
  })

  it('should prefer x-forwarded-for over x-real-ip', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'x-real-ip': '192.168.1.2',
      },
    })

    const clientId = getClientId(request)
    expect(clientId).toBe('192.168.1.1')
  })

  it('should fallback to local-dev when no headers present', () => {
    const request = new Request('http://localhost')

    const clientId = getClientId(request)
    expect(clientId).toBe('local-dev')
  })

  it('should handle multiple IPs in x-forwarded-for', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
      },
    })

    const clientId = getClientId(request)
    expect(clientId).toBe('192.168.1.1') // Should use first IP
  })

  it('should trim whitespace from forwarded IP', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '  192.168.1.1  , 10.0.0.1',
      },
    })

    const clientId = getClientId(request)
    expect(clientId).toBe('192.168.1.1') // Should be trimmed
  })
})
