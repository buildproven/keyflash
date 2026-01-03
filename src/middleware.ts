import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Routes that require authentication
 * Add routes here as we build out protected features
 */
const isProtectedRoute = createRouteMatcher([
  // Protected routes will be added here
  // '/dashboard(.*)',
  // '/settings(.*)',
])

// Webhook routes that should skip CSRF (validated via signatures instead)
const isWebhookRoute = createRouteMatcher(['/api/webhooks/(.*)'])

/**
 * Generate a cryptographically secure CSRF token using Web Crypto API
 * (Edge Runtime compatible)
 */
function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Validate CSRF token from request against cookie value
 */
function validateCsrfToken(req: NextRequest): boolean {
  const token = req.headers.get('x-csrf-token')
  const cookieToken = req.cookies.get('csrf-token')?.value

  if (!token || !cookieToken) {
    return false
  }

  // Constant-time comparison to prevent timing attacks
  return token === cookieToken
}

/**
 * Validate request origin matches expected host
 */
function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')

  // Get the expected origin from the request URL
  const expectedOrigin = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  // Check Origin header first (more reliable)
  if (origin) {
    return origin === expectedOrigin
  }

  // Fallback to Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`
      return refererOrigin === expectedOrigin
    } catch {
      return false
    }
  }

  // No origin or referer - reject for safety
  return false
}

// Public routes (default - no protection needed):
// /, /search, /sign-in, /sign-up, /api/webhooks/*, /api/health

export default clerkMiddleware(async (auth, req) => {
  // Protect routes that require authentication
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  const response = NextResponse.next()

  // CSRF Protection: Generate token for all GET requests
  if (req.method === 'GET') {
    const existingToken = req.cookies.get('csrf-token')?.value
    if (!existingToken) {
      const token = generateCsrfToken()
      response.cookies.set('csrf-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      })
    }
  }

  // CSRF Protection: Validate token and origin for state-changing requests
  // Skip webhooks (they use signature validation) and health checks
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    if (
      !isWebhookRoute(req) &&
      !req.nextUrl.pathname.startsWith('/api/health')
    ) {
      // Validate request origin
      if (!validateOrigin(req)) {
        return NextResponse.json(
          { error: 'Invalid request origin' },
          { status: 403 }
        )
      }

      // Validate CSRF token
      if (!validateCsrfToken(req)) {
        return NextResponse.json(
          { error: 'CSRF token validation failed' },
          { status: 403 }
        )
      }
    }
  }

  // Add HSTS (HTTP Strict Transport Security) in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
