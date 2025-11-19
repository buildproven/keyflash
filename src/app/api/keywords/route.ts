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
import type { KeywordSearchResponse, KeywordData } from '@/types/keyword';

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

    // TODO: Phase 4 - Replace with real API provider (Google Ads / DataForSEO)
    // For now, return mock data
    const mockData: KeywordData[] = validated.keywords.map((keyword) => ({
      keyword,
      searchVolume: Math.floor(Math.random() * 100000),
      difficulty: Math.floor(Math.random() * 100),
      cpc: Math.random() * 10,
      competition: ['low', 'medium', 'high'][
        Math.floor(Math.random() * 3)
      ] as 'low' | 'medium' | 'high',
      intent: ['informational', 'commercial', 'transactional', 'navigational'][
        Math.floor(Math.random() * 4)
      ] as KeywordData['intent'],
    }));

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const response: KeywordSearchResponse = {
      data: mockData,
      cached: false,
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
