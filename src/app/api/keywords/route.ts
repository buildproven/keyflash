import { NextRequest } from 'next/server';
import { KeywordSearchSchema } from '@/lib/validation/schemas';
import {
  handleAPIError,
  createSuccessResponse,
} from '@/lib/utils/error-handler';
import {
  checkRateLimit,
  getClientId,
  getRateLimitInfo,
} from '@/lib/rate-limit/rate-limiter';
import { getProvider } from '@/lib/api/factory';
import { cache } from '@/lib/cache/redis';
import type { KeywordSearchResponse } from '@/types/keyword';

/**
 * Rate limit configuration from environment
 */
const RATE_LIMIT_CONFIG = {
  requestsPerHour: parseInt(
    process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '10',
    10
  ),
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
};

/**
 * POST /api/keywords
 * Search for keyword data
 */
export async function POST(request: NextRequest) {
  try {
    // Get client identifier for rate limiting
    const clientId = getClientId(request);

    // Check rate limit
    try {
      checkRateLimit(clientId, RATE_LIMIT_CONFIG);
    } catch (error) {
      return handleAPIError(error);
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = KeywordSearchSchema.parse(body);

    // Generate cache key
    const cacheKey = cache.generateKey(
      validated.keywords,
      validated.location,
      validated.language,
      validated.matchType
    );

    // Try to get from cache first
    const cachedData = await cache.get(cacheKey);

    let keywordData;
    let isCached = false;
    let provider;

    if (cachedData) {
      // Cache hit - use cached data
      keywordData = cachedData.data;
      isCached = true;
      // eslint-disable-next-line no-console
      console.log(`[Cache] HIT - ${cacheKey}`);
    } else {
      // Cache miss - fetch from provider
      // eslint-disable-next-line no-console
      console.log(`[Cache] MISS - ${cacheKey}`);
      provider = getProvider();
      keywordData = await provider.getKeywordData(validated.keywords, {
        matchType: validated.matchType,
        location: validated.location,
        language: validated.language,
      });

      // Store in cache (fire and forget - don't wait for completion)
      cache
        .set(cacheKey, keywordData, provider.name)
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('[Cache] Failed to cache data:', error);
        });
    }

    const response: KeywordSearchResponse = {
      data: keywordData,
      cached: isCached,
      timestamp: new Date().toISOString(),
    };

    // Get rate limit info for response headers
    const rateLimitInfo = getRateLimitInfo(clientId, RATE_LIMIT_CONFIG);

    // Return success response with rate limit headers
    const successResponse = createSuccessResponse(response);
    successResponse.headers.set(
      'X-RateLimit-Remaining',
      rateLimitInfo.remaining.toString()
    );
    successResponse.headers.set('X-RateLimit-Reset', rateLimitInfo.resetAt);

    return successResponse;
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * GET /api/keywords
 * Not supported - return 405 Method Not Allowed
 */
export async function GET() {
  return createSuccessResponse(
    {
      error: 'Method Not Allowed',
      message: 'Use POST to search for keywords',
      supportedMethods: ['POST'],
    },
    405
  );
}
