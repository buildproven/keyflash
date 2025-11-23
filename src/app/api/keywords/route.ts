import { NextRequest } from 'next/server'
import { KeywordSearchSchema } from '@/lib/validation/schemas'
import {
  handleAPIError,
  createSuccessResponse,
} from '@/lib/utils/error-handler'
import { rateLimiter } from '@/lib/rate-limit/redis-rate-limiter'
import { getProvider } from '@/lib/api/factory'
import { cache } from '@/lib/cache/redis'
import type { KeywordSearchResponse } from '@/types/keyword'

// Route segment config for security and performance
export const runtime = 'nodejs'
export const maxDuration = 30 // 30 second timeout
export const dynamic = 'force-dynamic'

// CRITICAL: Enforce request body size limit to prevent abuse
// This is enforced at the Next.js level, preventing bypass via header spoofing
export const bodyParser = {
  sizeLimit: '1mb', // 1MB maximum request size
}

/**
 * Normalize location codes for provider and cache compatibility
 * UI uses ISO codes (US, GB, GL) but providers expect descriptive names
 */
export function normalizeLocationForProvider(location?: string): string {
  if (!location) return 'United States' // Default fallback

  const locationMap: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    DE: 'Germany',
    FR: 'France',
    IN: 'India',
    GL: 'Worldwide', // Global maps to provider-friendly term
  }

  // eslint-disable-next-line security/detect-object-injection -- location is validated input from API request, locationMap is controlled object
  return locationMap[location] || location
}

/**
 * Rate limit configuration from environment
 */
const RATE_LIMIT_CONFIG = {
  requestsPerHour: parseInt(
    process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '10',
    10
  ),
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
}

/**
 * POST /api/keywords
 * Search for keyword data
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit with Redis-based limiter
    const rateLimitResult = await rateLimiter.checkRateLimit(
      request,
      RATE_LIMIT_CONFIG
    )

    if (!rateLimitResult.allowed) {
      const error = new Error(
        `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds. Limit: ${RATE_LIMIT_CONFIG.requestsPerHour} requests/hour.`
      )
      ;(error as any).status = 429
      ;(error as any).headers = {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
        'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
      }
      return handleAPIError(error)
    }

    // Parse and validate request body
    const body = await request.json()
    const validated = KeywordSearchSchema.parse(body)

    // Normalize location codes for provider compatibility
    // UI uses ISO codes (US, GB, GL) but providers expect descriptive names
    const normalizedLocation = normalizeLocationForProvider(validated.location)

    // Generate cache key
    const cacheKey = cache.generateKey(
      validated.keywords,
      normalizedLocation,
      validated.language,
      validated.matchType
    )

    // Try to get from cache first
    const cachedData = await cache.get(cacheKey)

    let keywordData
    let isCached = false
    let provider

    if (cachedData) {
      // Cache hit - use cached data
      keywordData = cachedData.data
      isCached = true
      // eslint-disable-next-line no-console
      console.log(`[Cache] HIT - ${cacheKey}`)
    } else {
      // Cache miss - fetch from provider
      // eslint-disable-next-line no-console
      console.log(`[Cache] MISS - ${cacheKey}`)
      provider = getProvider()
      keywordData = await provider.getKeywordData(validated.keywords, {
        matchType: validated.matchType,
        location: normalizedLocation,
        language: validated.language,
      })

      // Store in cache (fire and forget - don't wait for completion)
      cache.set(cacheKey, keywordData, provider.name).catch(error => {
        // eslint-disable-next-line no-console
        console.error('[Cache] Failed to cache data:', error)
      })
    }

    // Determine provider name and mock status
    const providerName =
      provider?.name || (cachedData?.metadata.provider ?? 'Unknown')
    const isMockData = providerName === 'Mock'

    const response: KeywordSearchResponse = {
      data: keywordData,
      cached: isCached,
      timestamp: new Date().toISOString(),
      mockData: isMockData,
      provider: providerName,
    }

    // Return success response with rate limit headers
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
  )
}
