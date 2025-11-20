import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProvider,
  getProvider,
  isProviderAvailable,
  type ProviderName,
} from '@/lib/api/factory';
import type { KeywordAPIProvider } from '@/lib/api/types';

describe('API Provider Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createProvider', () => {
    it('should create mock provider by default', () => {
      delete process.env.KEYWORD_API_PROVIDER;
      const provider = createProvider();

      expect(provider.name).toBe('Mock');
      expect(provider.getBatchLimit()).toBe(200);
    });

    it('should create mock provider when explicitly specified', () => {
      process.env.KEYWORD_API_PROVIDER = 'mock';
      const provider = createProvider();

      expect(provider.name).toBe('Mock');
    });

    it('should create Google Ads provider when specified', () => {
      process.env.KEYWORD_API_PROVIDER = 'google-ads';
      const provider = createProvider();

      expect(provider.name).toBe('Google Ads');
    });

    it('should create DataForSEO provider when specified', () => {
      process.env.KEYWORD_API_PROVIDER = 'dataforseo';
      const provider = createProvider();

      expect(provider.name).toBe('DataForSEO');
    });

    it('should handle case-insensitive provider names', () => {
      process.env.KEYWORD_API_PROVIDER = 'GOOGLE-ADS';
      const provider = createProvider();

      expect(provider.name).toBe('Google Ads');
    });

    it('should fall back to mock provider for unknown provider', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.KEYWORD_API_PROVIDER = 'unknown-provider';

      const provider = createProvider();

      expect(provider.name).toBe('Mock');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider "unknown-provider"')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should return provider with correct interface', async () => {
      const provider = createProvider();

      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('validateConfiguration');
      expect(provider).toHaveProperty('getKeywordData');
      expect(provider).toHaveProperty('getBatchLimit');
      expect(provider).toHaveProperty('getRateLimit');
    });

    it('should generate randomized mock data', async () => {
      const provider = createProvider();
      const keywords = ['test keyword 1', 'test keyword 2'];

      const data = await provider.getKeywordData(keywords);

      expect(data).toHaveLength(2);
      expect(data[0].keyword).toBe('test keyword 1');
      expect(data[0].searchVolume).toBeGreaterThanOrEqual(0);
      expect(data[0].searchVolume).toBeLessThanOrEqual(100000);
      expect(data[0].difficulty).toBeGreaterThanOrEqual(0);
      expect(data[0].difficulty).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high']).toContain(data[0].competition);
      expect(['informational', 'commercial', 'transactional', 'navigational']).toContain(
        data[0].intent
      );
    });
  });

  describe('getProvider', () => {
    it('should return validated mock provider', () => {
      process.env.KEYWORD_API_PROVIDER = 'mock';
      const provider = getProvider();

      expect(provider.name).toBe('Mock');
    });

    it('should throw descriptive error when provider validation fails', () => {
      process.env.KEYWORD_API_PROVIDER = 'google-ads';

      expect(() => getProvider()).toThrow(/Google Ads provider configuration error/);
      expect(() => getProvider()).toThrow(/Copy .env.example to .env.local/);
      expect(() => getProvider()).toThrow(/KEYWORD_API_PROVIDER=mock/);
    });

    it('should handle Error instances from validation', () => {
      process.env.KEYWORD_API_PROVIDER = 'dataforseo';

      expect(() => getProvider()).toThrow(/DataForSEO provider configuration error/);
    });

    it('should provide helpful setup instructions on configuration errors', () => {
      process.env.KEYWORD_API_PROVIDER = 'google-ads';

      try {
        getProvider();
        expect.fail('Should have thrown configuration error');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('Google Ads provider configuration error');
          expect(error.message).toContain('To fix this:');
          expect(error.message).toContain('Copy .env.example to .env.local');
          expect(error.message).toContain('Add your API credentials');
          expect(error.message).toContain('Restart the development server');
          expect(error.message).toContain('KEYWORD_API_PROVIDER=mock');
        }
      }
    });
  });

  describe('isProviderAvailable', () => {
    it('should return true for mock provider', () => {
      expect(isProviderAvailable('mock')).toBe(true);
    });

    it('should return false for google-ads without credentials', () => {
      delete process.env.GOOGLE_ADS_CLIENT_ID;
      delete process.env.GOOGLE_ADS_CLIENT_SECRET;
      delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      delete process.env.GOOGLE_ADS_REFRESH_TOKEN;
      delete process.env.GOOGLE_ADS_CUSTOMER_ID;

      expect(isProviderAvailable('google-ads')).toBe(false);
    });

    it('should return false for dataforseo without credentials', () => {
      delete process.env.DATAFORSEO_API_LOGIN;
      delete process.env.DATAFORSEO_API_PASSWORD;

      expect(isProviderAvailable('dataforseo')).toBe(false);
    });

    it('should return false when provider name does not match current provider', () => {
      process.env.KEYWORD_API_PROVIDER = 'mock';

      // Trying to check if google-ads is available, but current provider is mock
      expect(isProviderAvailable('google-ads')).toBe(false);
    });

    it('should handle validation errors gracefully', () => {
      process.env.KEYWORD_API_PROVIDER = 'google-ads';

      // Should catch validation error and return false (lines 130-133)
      expect(isProviderAvailable('google-ads')).toBe(false);
    });

    it('should return true when provider is properly configured', () => {
      process.env.KEYWORD_API_PROVIDER = 'mock';

      expect(isProviderAvailable('mock')).toBe(true);
    });
  });

  describe('MockProvider', () => {
    it('should simulate API delay', async () => {
      const provider = createProvider();
      const startTime = Date.now();

      await provider.getKeywordData(['test']);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(750); // Allow some margin
    });

    it('should return correct rate limit', () => {
      const provider = createProvider();
      const rateLimit = provider.getRateLimit();

      expect(rateLimit.requests).toBe(1000);
      expect(rateLimit.period).toBe('hour');
    });

    it('should not throw on validateConfiguration', () => {
      const provider = createProvider();

      expect(() => provider.validateConfiguration()).not.toThrow();
    });
  });
});
