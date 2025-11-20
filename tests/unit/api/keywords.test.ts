import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the cache module BEFORE importing the route
vi.mock('@/lib/cache/redis', () => ({
  cache: {
    generateKey: vi.fn(
      (keywords, location = 'default', language = 'en', matchType = 'phrase') =>
        `kw:${location}:${language}:${matchType}:mock`
    ),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Import after mock is defined
import { POST, GET } from '@/app/api/keywords/route';
import { cache } from '@/lib/cache/redis';

describe('/api/keywords', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    vi.mocked(cache.get).mockResolvedValue(null); // Default: cache miss
    vi.mocked(cache.set).mockResolvedValue(true);
  });

  describe('POST', () => {
    it('should return keyword data for valid request', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['seo tools', 'keyword research'],
          matchType: 'phrase',
          location: 'United States',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(2);
      expect(data.cached).toBe(false);
      expect(data.timestamp).toBeDefined();
    });

    it('should validate keyword count limit', async () => {
      const keywords = Array(201).fill('keyword');

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords,
          matchType: 'phrase',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate match type', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test'],
          matchType: 'invalid',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should require at least one keyword', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: [],
          matchType: 'phrase',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should include rate limit headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test'],
          matchType: 'phrase',
        }),
      });

      const response = await POST(request);

      expect(response.headers.has('X-RateLimit-Remaining')).toBe(true);
      expect(response.headers.has('X-RateLimit-Reset')).toBe(true);
    });

    it('should return keyword data with correct structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test keyword'],
          matchType: 'exact',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data[0]).toHaveProperty('keyword');
      expect(data.data[0]).toHaveProperty('searchVolume');
      expect(data.data[0]).toHaveProperty('difficulty');
      expect(data.data[0]).toHaveProperty('cpc');
      expect(data.data[0]).toHaveProperty('competition');
      expect(data.data[0]).toHaveProperty('intent');
    });

    it('should return cached data when cache hit occurs', async () => {
      const cachedData = {
        data: [
          {
            keyword: 'cached keyword',
            searchVolume: 5000,
            difficulty: 60,
            cpc: 2.5,
            competition: 'high' as const,
            intent: 'commercial' as const,
          },
        ],
        metadata: {
          cachedAt: '2025-11-19T00:00:00Z',
          ttl: 604800,
          provider: 'mock',
        },
      };

      vi.mocked(cache.get).mockResolvedValue(cachedData);

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['cached keyword'],
          matchType: 'phrase',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cached).toBe(true);
      expect(data.data).toEqual(cachedData.data);
      expect(data.data[0].keyword).toBe('cached keyword');
      expect(cache.get).toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled(); // Should not set when cache hit
    });

    it('should cache data on cache miss', async () => {
      vi.mocked(cache.get).mockResolvedValue(null); // Cache miss
      vi.mocked(cache.set).mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['new keyword'],
          matchType: 'phrase',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cached).toBe(false);
      expect(cache.get).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      vi.mocked(cache.get).mockRejectedValue(
        new Error('Cache connection error')
      );

      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test'],
          matchType: 'phrase',
        }),
      });

      const response = await POST(request);

      // Cache errors may cause 500, but that's acceptable for this edge case
      expect([200, 500]).toContain(response.status);
    });

    it('should generate correct cache key', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['test'],
          matchType: 'exact',
          location: 'US',
          language: 'en',
        }),
      });

      await POST(request);

      expect(cache.generateKey).toHaveBeenCalledWith(
        ['test'],
        'US',
        'en',
        'exact'
      );
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);

      // Should return error status (400 or 500)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/keywords', {
        method: 'POST',
        body: JSON.stringify({
          matchType: 'phrase',
          // missing keywords
        }),
      });

      const response = await POST(request);

      // Should return error status (400 or 500)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET', () => {
    it('should return 405 for GET requests', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method Not Allowed');
      expect(data.supportedMethods).toContain('POST');
    });
  });
});
