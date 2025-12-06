import { NextRequest } from 'next/server'
import { KeywordSearchSchema } from '@/lib/validation/schemas'
import {
  handleAPIError,
  createSuccessResponse,
} from '@/lib/utils/error-handler'
import { rateLimiter } from '@/lib/rate-limit/redis-rate-limiter'
import { getProvider } from '@/lib/api/factory'
import { cache } from '@/lib/cache/redis'
import { logger } from '@/lib/utils/logger'
import type { KeywordSearchResponse } from '@/types/keyword'

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
 * Safely read and parse JSON body with an explicit size cap.
 * Next.js App Router doesn't enforce the legacy bodyParser.sizeLimit config,
 * so we guard against oversized payloads here.
 */
async function readJsonWithLimit(
  request: NextRequest,
  maxBytes: number = 1_000_000 // 1 MB
): Promise<unknown> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > maxBytes) {
    const error: HttpError = new Error(
      `Request body too large. Limit is ${Math.floor(maxBytes / 1024)} KB.`
    )
    error.status = 413
    error.headers = {
      'Content-Length': contentLength,
    }
    throw error
  }

  const reader = request.body?.getReader()
  if (!reader) {
    return {}
  }

  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      if (received > maxBytes) {
        const error: HttpError = new Error(
          `Request body too large. Limit is ${Math.floor(maxBytes / 1024)} KB.`
        )
        error.status = 413
        throw error
      }
      chunks.push(value)
    }
  }

  // Combine chunks without Buffer to keep compatibility with edge/node runtimes
  const combined = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  const decoder = new TextDecoder()
  const jsonString = decoder.decode(combined)
  try {
    return JSON.parse(jsonString || '{}')
  } catch {
    const error: HttpError = new Error('Invalid JSON payload')
    error.status = 400
    throw error
  }
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
      logger.debug(`Cache HIT - ${cacheKey}`, { module: 'Cache' })
    } else {
      // Cache miss - fetch from provider
      logger.debug(`Cache MISS - ${cacheKey}`, { module: 'Cache' })
      provider = getProvider()
      keywordData = await provider.getKeywordData(validated.keywords, {
        matchType: validated.matchType,
        location: normalizedLocation,
        language: validated.language,
      })

      // Store in cache with short timeout to avoid hanging request
      const cacheWrite = cache.set(cacheKey, keywordData, provider.name)
      const timeout = new Promise(resolve =>
        setTimeout(() => {
          logger.warn(`Cache write taking too long for key ${cacheKey}`, {
            module: 'Cache',
          })
          resolve(null)
        }, 150)
      )
      await Promise.race([cacheWrite, timeout]).catch(error => {
        logger.error('Failed to cache data', error, { module: 'Cache' })
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
