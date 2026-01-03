import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { KeywordSearchSchema } from '@/lib/validation/schemas'
import {
  handleAPIError,
  createSuccessResponse,
} from '@/lib/utils/error-handler'
import { rateLimiter } from '@/lib/rate-limit/redis-rate-limiter'
import { getProvider, getMockProvider } from '@/lib/api/factory'
import { cache } from '@/lib/cache/redis'
import { logger } from '@/lib/utils/logger'
import { userService } from '@/lib/user/user-service'
import type { KeywordSearchResponse } from '@/types/keyword'
import { readJsonWithLimit } from '@/lib/utils/request'

type HttpError = Error & {
  status?: number
  headers?: Record<string, string>
}

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
const LOCATION_MAP = new Map<string, string>([
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['IN', 'India'],
  ['GL', 'Worldwide'], // Global maps to provider-friendly term
])

export function normalizeLocationForProvider(location?: string): string {
  if (!location) return 'United States' // Default fallback
  return LOCATION_MAP.get(location) ?? 'United States'
}

/**
 * Rate limit configuration from environment
 */
const RATE_LIMIT_CONFIG = (() => {
  const raw = process.env.RATE_LIMIT_REQUESTS_PER_HOUR
  const parsed = Number(raw)
  const safeValue =
    Number.isFinite(parsed) && parsed > 0 ? Math.min(10000, parsed) : 10 // default fallback

  if (!Number.isFinite(parsed) && raw) {
    logger.warn(
      `Invalid RATE_LIMIT_REQUESTS_PER_HOUR="${raw}", falling back to ${safeValue}`,
      { module: 'RateLimit' }
    )
  }

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
    const validated = KeywordSearchSchema.parse(body)

    // Check user authentication and tier
    const authResult = await auth()
    const userId = authResult.userId
    let userTier: 'trial' | 'pro' = 'trial'
    let useMockData = true // Default: unauthenticated users get mock data

    if (userId) {
      // Get email from Clerk session
      const sessionClaims = authResult.sessionClaims as
        | { email?: string }
        | undefined
      const email = sessionClaims?.email || `${userId}@keyflash.local`

      // Get user from database (or create if new) - race-condition safe
      const user = await userService.getOrCreateUser(userId, email)

      if (user) {
        // Check keyword limit
        const limitCheck = await userService.checkKeywordLimit(userId)

        if (limitCheck) {
          if (limitCheck.trialExpired) {
            const error: HttpError = new Error(
              'Your 7-day free trial has expired. Upgrade to Pro to continue using KeyFlash.'
            )
            error.status = 403
            return handleAPIError(error)
          }

          if (!limitCheck.allowed) {
            const error: HttpError = new Error(
              `Monthly keyword limit reached (${limitCheck.used}/${limitCheck.limit}). ` +
                (limitCheck.tier === 'trial'
                  ? 'Upgrade to Pro for 1,000 keywords/month.'
                  : 'Your limit resets at the start of next month.')
            )
            error.status = 429
            return handleAPIError(error)
          }

          userTier = limitCheck.tier
          // Pro users get real data, trial users get mock data
          useMockData = userTier === 'trial'
        }
      }
    }

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

    // Try to get from cache first (only for Pro users with real data)
    const cachedData = useMockData ? null : await cache.get(cacheKey)

    let keywordData
    let isCached = false
    let provider
    let cacheWriteSucceeded = true

    if (cachedData) {
      // Cache hit - use cached data
      keywordData = cachedData.data
      isCached = true
      logger.debug(`Cache HIT - ${cacheKey}`, { module: 'Cache' })
    } else {
      // Cache miss - fetch from provider
      logger.debug(`Cache MISS - ${cacheKey}`, { module: 'Cache' })
      // Trial users always get mock data, Pro users get configured provider
      provider = useMockData ? getMockProvider() : getProvider()
      keywordData = await provider.getKeywordData(validated.keywords, {
        matchType: validated.matchType,
        location: normalizedLocation,
        language: validated.language,
      })

      // Store in cache (only for real data from Pro users)
      if (!useMockData) {
        const cacheWrite = cache
          .set(cacheKey, keywordData, provider.name)
          .catch(error => {
            cacheWriteSucceeded = false
            logger.error('Failed to cache data', error, {
              module: 'Cache',
              errorId: 'CACHE_WRITE_FAILED',
              cacheKey,
            })
          })

        const timeout = new Promise(resolve =>
          setTimeout(() => {
            if (cacheWriteSucceeded) {
              cacheWriteSucceeded = false
              logger.warn(`Cache write timeout for key ${cacheKey}`, {
                module: 'Cache',
              })
            }
            resolve(null)
          }, 150)
        )

        await Promise.race([cacheWrite, timeout])
      }
    }

    // Track keyword usage (blocking to ensure accurate usage tracking)
    // If usage tracking fails, the entire request should fail to prevent:
    // - Inaccurate usage data
    // - Users exceeding limits without tracking
    // - Billing discrepancies
    if (userId) {
      await userService.incrementKeywordUsage(userId, validated.keywords.length)
    }

    // Determine provider name and mock status
    const providerName =
      provider?.name || (cachedData?.metadata.provider ?? 'Unknown')
    const isMockData = providerName === 'Mock' || useMockData

    const response: KeywordSearchResponse = {
      data: keywordData,
      cached: isCached,
      cacheHealthy: !isCached ? cacheWriteSucceeded : undefined,
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
