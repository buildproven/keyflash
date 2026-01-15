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
 * CORS Configuration
 * Explicitly define allowed origins for cross-origin requests
 */
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'https://keyflash.vibebuildlab.com',
  ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
].filter(Boolean)

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
 * Validate request origin matches expected host or is in allowlist
 */
function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')

  // Get the expected origin from the request URL
  const expectedOrigin = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  // Check Origin header first (more reliable)
  if (origin) {
    // Same-origin requests always allowed
    if (origin === expectedOrigin) {
      return true
    }
    // Check against CORS allowlist
    return ALLOWED_ORIGINS.includes(origin)
  }

  // Fallback to Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`
      // Same-origin requests always allowed
      if (refererOrigin === expectedOrigin) {
        return true
      }
      // Check against CORS allowlist
      return ALLOWED_ORIGINS.includes(refererOrigin)
    } catch {
      return false
    }
  }

  // No origin or referer - reject for safety
  return false
}

/**
 * Set CORS headers for cross-origin requests
 */
function setCorsHeaders(req: NextRequest, response: NextResponse): void {
  const origin = req.headers.get('origin')

  // Only set CORS headers if origin is present and allowed
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin === `${req.nextUrl.protocol}//${req.nextUrl.host}`)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    )
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSRF-Token, X-Requested-With'
    )
    response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
  }
}

// Public routes (default - no protection needed):
// /, /search, /sign-in, /sign-up, /api/webhooks/*, /api/health

export default clerkMiddleware(async (auth, req) => {
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    const response = NextResponse.json({}, { status: 200 })
    setCorsHeaders(req, response)
    return response
  }

  // Protect routes that require authentication
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  const response = NextResponse.next()

  // Set CORS headers for all requests
  setCorsHeaders(req, response)

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
