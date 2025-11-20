import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('/api/health', () => {
  it('should return healthy status', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
  });

  it('should include timestamp', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(typeof data.timestamp).toBe('string');
  });

  it('should include version', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.version).toBeDefined();
  });

  it('should include environment', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.environment).toBeDefined();
    expect(['development', 'production', 'test']).toContain(data.environment);
  });
});
