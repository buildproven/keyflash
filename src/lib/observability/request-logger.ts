/**
 * Request Logger Middleware
 * ARCH-005: Automatic request/response logging for all API routes
 *
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return withRequestLogging(request, async (context) => {
 *     // Your route logic here
 *     return NextResponse.json({ data: 'example' })
 *   })
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createRequestContext,
  logRequestStart,
  logRequestEnd,
  type RequestContext,
} from './telemetry'

/**
 * Wrapper for API routes that adds automatic request/response logging
 *
 * @param request - Next.js request object
 * @param handler - Async function that handles the request
 * @returns Response from handler with added logging
 */
export async function withRequestLogging<T>(
  request: NextRequest,
  handler: (context: RequestContext) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  // Create request context
  const context = createRequestContext(
    request.method,
    request.nextUrl.pathname,
    request.headers
  )

  // Log request start
  logRequestStart(context)

  try {
    // Execute handler
    const response = await handler(context)

    // Log successful completion
    logRequestEnd(context, response.status)

    // Add request ID to response headers for client-side correlation
    response.headers.set('X-Request-ID', context.requestId)

    return response
  } catch (error) {
    // Log error
    logRequestEnd(context, 500, {
      error: error instanceof Error ? error : new Error('Unknown error'),
    })

    // Re-throw to be handled by error handler
    throw error
  }
}

/**
 * Extract user ID from Clerk auth result
 */
export function addUserIdToContext(
  context: RequestContext,
  userId: string | null
): void {
  if (userId) {
    context.userId = userId
  }
}

/**
 * Add provider information to context for logging
 */
export function addProviderToContext(
  context: RequestContext,
  provider: string
): void {
  // Store in a way that can be retrieved for logging
  ;(context as unknown as { provider?: string }).provider = provider
}

/**
 * Add cache hit information to context
 */
export function addCacheHitToContext(
  context: RequestContext,
  cacheHit: boolean
): void {
  ;(context as unknown as { cacheHit?: boolean }).cacheHit = cacheHit
}
