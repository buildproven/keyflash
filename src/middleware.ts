import { NextResponse } from 'next/server'

// Initialize application configuration at startup
import '@/lib/config/startup'

/**
 * Middleware for security and request validation
 * Runs before all requests
 */
export function middleware() {
  const response = NextResponse.next()

  // Add HSTS (HTTP Strict Transport Security) in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Note: Request size limits are now enforced at the route level
  // via Next.js route segment config (bodyParser.sizeLimit) to prevent header spoofing

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
