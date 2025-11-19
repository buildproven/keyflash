import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  getRateLimitInfo,
} from '@/lib/rate-limit/rate-limiter';

describe('Rate Limiter', () => {
  const testConfig = {
    requestsPerHour: 3,
    enabled: true,
  };

  beforeEach(() => {
    // Note: In a real scenario, we'd need to clear the rate limit store
    // For now, use unique client IDs per test
  });

  it('should allow first request', () => {
    const clientId = `test-${Date.now()}-1`;
    expect(() => checkRateLimit(clientId, testConfig)).not.toThrow();
  });

  it('should allow requests up to limit', () => {
    const clientId = `test-${Date.now()}-2`;

    // First 3 requests should pass
    expect(() => checkRateLimit(clientId, testConfig)).not.toThrow();
    expect(() => checkRateLimit(clientId, testConfig)).not.toThrow();
    expect(() => checkRateLimit(clientId, testConfig)).not.toThrow();
  });

  it('should block requests exceeding limit', () => {
    const clientId = `test-${Date.now()}-3`;

    // First 3 requests
    checkRateLimit(clientId, testConfig);
    checkRateLimit(clientId, testConfig);
    checkRateLimit(clientId, testConfig);

    // 4th request should fail
    expect(() => checkRateLimit(clientId, testConfig)).toThrow(
      /rate limit exceeded/i
    );
  });

  it('should not limit when disabled', () => {
    const clientId = `test-${Date.now()}-4`;
    const disabledConfig = { ...testConfig, enabled: false };

    // Should allow unlimited requests
    for (let i = 0; i < 10; i++) {
      expect(() => checkRateLimit(clientId, disabledConfig)).not.toThrow();
    }
  });

  it('should provide rate limit info', () => {
    const clientId = `test-${Date.now()}-5`;

    const info = getRateLimitInfo(clientId, testConfig);
    expect(info.remaining).toBe(testConfig.requestsPerHour);
    expect(info.resetAt).toBeDefined();
  });

  it('should track remaining requests', () => {
    const clientId = `test-${Date.now()}-6`;

    checkRateLimit(clientId, testConfig);

    const info = getRateLimitInfo(clientId, testConfig);
    expect(info.remaining).toBe(testConfig.requestsPerHour - 1);
  });
});
