import { NextRequest } from 'next/server'
import { RelatedKeywordsSchema } from '@/lib/validation/schemas'
import {
  handleAPIError,
  createSuccessResponse,
} from '@/lib/utils/error-handler'
import { rateLimiter } from '@/lib/rate-limit/redis-rate-limiter'
import { getProvider } from '@/lib/api/factory'
import { cache } from '@/lib/cache/redis'
import { logger } from '@/lib/utils/logger'
import { normalizeLocationForProvider } from '../route'
import { readJsonWithLimit } from '@/lib/utils/request'
import type {
  RelatedKeyword,
  RelatedKeywordsResponse,
} from '@/types/related-keywords'

interface CachedRelatedKeywords {
  data: RelatedKeyword[]
  metadata: {
    cachedAt: string
    provider: string
  }
}

type HttpError = Error & {
  status?: number
  headers?: Record<string, string>
}

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

/**
 * Rate limit configuration for related keywords (stricter than main endpoint)
 */
const RATE_LIMIT_CONFIG = (() => {
  const raw = process.env.RELATED_KEYWORDS_RATE_LIMIT_PER_HOUR
  const parsed = Number(raw)
  const safeValue =
    Number.isFinite(parsed) && parsed > 0 ? Math.min(100, parsed) : 30

  return {
    requestsPerHour: safeValue,
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    failSafe:
      process.env.RATE_LIMIT_FAIL_SAFE === 'open'
        ? ('open' as const)
        : ('closed' as const),
  }
})()

/**
 * POST /api/keywords/related
 * Get related keywords for a seed keyword
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
        `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds. Limit: ${RATE_LIMIT_CONFIG.requestsPerHour} requests/hour.`
      )
      error.status = 429
      error.headers = {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
        'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
      }
      return handleAPIError(error)
    }

    // Parse and validate request body
    const body = await readJsonWithLimit(request)
    const validated = RelatedKeywordsSchema.parse(body)

    const normalizedLocation = normalizeLocationForProvider(validated.location)

    // Generate cache key for related keywords
    const cacheKey = `related:${validated.keyword.toLowerCase()}:${normalizedLocation}:${validated.language || 'en'}`

    // Try cache first
    const cachedData = await cache.getRaw<CachedRelatedKeywords>(cacheKey)

    let relatedKeywords: RelatedKeyword[]
    let fullRelatedKeywords: RelatedKeyword[]
    let isCached = false
    let providerName = 'Unknown'

    if (cachedData) {
      fullRelatedKeywords = cachedData.data
      isCached = true
      providerName = cachedData.metadata?.provider ?? 'Unknown'
      logger.debug(`Cache HIT - ${cacheKey}`, { module: 'Cache' })
    } else {
      logger.debug(`Cache MISS - ${cacheKey}`, { module: 'Cache' })
      const provider = getProvider()
      providerName = provider.name

      // Check if provider supports related keywords
      if (!provider.getRelatedKeywords) {
        const error: HttpError = new Error(
          `Provider ${provider.name} does not support related keywords feature`
        )
        error.status = 501
        return handleAPIError(error)
      }

      fullRelatedKeywords = await provider.getRelatedKeywords(
        validated.keyword,
        {
          matchType: 'phrase',
          location: normalizedLocation,
          language: validated.language,
        }
      )

      // Cache results (7 days TTL for related keywords)
      const cacheData: CachedRelatedKeywords = {
        data: fullRelatedKeywords,
        metadata: {
          cachedAt: new Date().toISOString(),
          provider: providerName,
        },
      }
      const cacheWrite = cache.setRaw(cacheKey, cacheData)
      const timeout = new Promise(resolve =>
        setTimeout(() => {
          logger.warn(`Cache write taking too long for key ${cacheKey}`, {
            module: 'Cache',
          })
          resolve(null)
        }, 150)
      )
      await Promise.race([cacheWrite, timeout]).catch(error => {
        logger.error('Failed to cache related keywords', error, {
          module: 'Cache',
        })
      })
    }

    relatedKeywords = validated.limit
      ? fullRelatedKeywords.slice(0, validated.limit)
      : fullRelatedKeywords

    const response: RelatedKeywordsResponse = {
      seedKeyword: validated.keyword,
      relatedKeywords,
      cached: isCached,
      timestamp: new Date().toISOString(),
      provider: providerName,
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
 * GET /api/keywords/related
 * Not supported
 */
export async function GET() {
  return createSuccessResponse(
    {
      error: 'Method Not Allowed',
      message: 'Use POST to get related keywords',
      supportedMethods: ['POST'],
    },
    405
  )
}
