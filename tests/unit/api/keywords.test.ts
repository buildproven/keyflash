import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/keywords/route';
import { NextRequest } from 'next/server';

describe('/api/keywords', () => {
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
