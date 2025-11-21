import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Initialize application configuration at startup
import '@/lib/config/startup'

/**
 * Middleware for security and request validation
 * Runs before all requests
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add HSTS (HTTP Strict Transport Security) in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Request size limit check for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const contentLength = request.headers.get('content-length')

    // Limit request size to 1MB
    if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
      return NextResponse.json(
        {
          error: 'Payload Too Large',
          message: 'Request body must be less than 1MB',
        },
        { status: 413 }
      )
    }
  }

  return response
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
