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

    // Get keyword data from configured provider
    const provider = getProvider();
    const keywordData = await provider.getKeywordData(validated.keywords, {
      matchType: validated.matchType,
      location: validated.location,
      language: validated.language,
    });

    const response: KeywordSearchResponse = {
      data: keywordData,
      cached: false, // TODO: Will be true when Redis caching is implemented (Phase 5)
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
