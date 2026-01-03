import { NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import {
  handleAPIError,
  createSuccessResponse,
} from '@/lib/utils/error-handler'
import { rateLimiter } from '@/lib/rate-limit/redis-rate-limiter'
import { serpService } from '@/lib/api/serp-service'
import { cache } from '@/lib/cache/redis'
import { logger } from '@/lib/utils/logger'
import type { ContentBriefResponse } from '@/types/content-brief'
import { readJsonWithLimit } from '@/lib/utils/request'

type HttpError = Error & {
  status?: number
  headers?: Record<string, string>
}

// Route segment config
export const runtime = 'nodejs'
export const maxDuration = 60 // Content briefs may take longer
export const dynamic = 'force-dynamic'

/**
 * Request validation schema
 */
const ContentBriefRequestSchema = z.object({
  keyword: z
    .string()
    .min(1, 'Keyword is required')
    .max(100, 'Keyword must be less than 100 characters')
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      'Keyword can only contain letters, numbers, spaces, hyphens, and underscores'
    ),
  location: z
    .enum(['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IN', 'GL'], {
      message:
        'Location must be one of US, GB, CA, AU, DE, FR, IN, or GL for Global',
    })
    .optional()
    .default('US'),
  language: z.string().min(2).max(5).optional().default('en'),
})

/**
 * Rate limit configuration - more restrictive for content briefs
 * (they're more expensive API calls)
 */
const RATE_LIMIT_CONFIG = {
  requestsPerHour: 20, // Fewer allowed than keyword searches
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  failSafe:
    process.env.RATE_LIMIT_FAIL_SAFE === 'open'
      ? ('open' as const)
      : ('closed' as const),
}

/**
 * Generate cache key for content brief
 */
function generateCacheKey(
  keyword: string,
  location: string,
  language: string
): string {
  const normalizedKeyword = keyword.toLowerCase().trim()
  const hash = createHash('sha256').update(normalizedKeyword).digest('hex')
  return `brief:${location}:${language}:${hash}`
}

/**
 * POST /api/content-brief
 * Generate a content brief for a keyword
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await rateLimiter.checkRateLimit(
      request,
      RATE_LIMIT_CONFIG
    )

    if (!rateLimitResult.allowed) {
      const error: HttpError = new Error(
        `Rate limit exceeded. Content briefs are limited to ${RATE_LIMIT_CONFIG.requestsPerHour} per hour. Try again in ${rateLimitResult.retryAfter} seconds.`
      )
      error.status = 429
      error.headers = {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
        'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
      }
      return handleAPIError(error)
    }

    // Parse and validate request
    const body = await readJsonWithLimit(request)
    const validated = ContentBriefRequestSchema.parse(body)

    const { keyword, location, language } = validated

    // Check cache first
    const cacheKey = generateCacheKey(keyword, location, language)
    const cachedBrief =
      await cache.getRaw<ContentBriefResponse['brief']>(cacheKey)

    if (cachedBrief) {
      logger.debug(`Content brief cache HIT - ${cacheKey}`, {
        module: 'ContentBrief',
      })
      const response: ContentBriefResponse = {
        brief: cachedBrief,
        cached: true,
        timestamp: new Date().toISOString(),
      }

      const successResponse = createSuccessResponse(response)
      successResponse.headers.set(
        'X-RateLimit-Remaining',
        rateLimitResult.remaining.toString()
      )
      return successResponse
    }

    logger.debug(`Content brief cache MISS - ${cacheKey}`, {
      module: 'ContentBrief',
    })

    // Generate the content brief
    const brief = await serpService.generateContentBrief(
      keyword,
      location,
      language
    )

    // Cache the brief (1 day TTL) only when using live data
    if (!brief.mockData) {
      const briefCacheTTL = 24 * 60 * 60 // 1 day in seconds

      // Fire-and-forget: cache write runs in background without blocking response
      cache.setRaw(cacheKey, brief, briefCacheTTL).catch(error => {
        logger.error('Failed to cache content brief', error, {
          module: 'Cache',
          errorId: 'CACHE_WRITE_FAILED',
          cacheKey,
        })
      })
    } else {
      logger.warn('Skipping cache write for mock content brief', {
        module: 'ContentBrief',
      })
    }

    const response: ContentBriefResponse = {
      brief,
      cached: false,
      timestamp: new Date().toISOString(),
    }

    const successResponse = createSuccessResponse(response)
    successResponse.headers.set(
      'X-RateLimit-Remaining',
      rateLimitResult.remaining.toString()
    )
    successResponse.headers.set(
      'X-RateLimit-Reset',
      rateLimitResult.resetAt.toISOString()
    )

    return successResponse
  } catch (error) {
    return handleAPIError(error)
  }
}

/**
 * GET /api/content-brief
 * Not supported - return 405
 */
export async function GET() {
  return createSuccessResponse(
    {
      error: 'Method Not Allowed',
      message: 'Use POST to generate a content brief',
      supportedMethods: ['POST'],
    },
    405
  )
}
