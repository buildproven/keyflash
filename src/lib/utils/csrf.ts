/**
 * CSRF Token Utilities
 * Provides helper functions for CSRF protection in client-side code
 */

/**
 * Get CSRF token from cookie
 * The token is set by middleware on GET requests
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'csrf-token') {
      return decodeURIComponent(value)
    }
  }
  return null
}

/**
 * Create headers object with CSRF token for API requests
 * Use this for all POST/PUT/DELETE/PATCH requests
 */
export function getCsrfHeaders(): Record<string, string> {
  const token = getCsrfToken()
  if (!token) {
    console.warn('CSRF token not found in cookies')
    return {}
  }
  return {
    'X-CSRF-Token': token,
  }
}

/**
 * Enhanced fetch wrapper that automatically includes CSRF token
 * for state-changing requests
 */
export async function fetchWithCsrf(
  url: string,
  options: Parameters<typeof fetch>[1] = {}
): Promise<Response> {
  const method = options?.method?.toUpperCase() || 'GET'
  const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)

  if (needsCsrf) {
    const csrfHeaders = getCsrfHeaders()
    options = {
      ...options,
      headers: {
        ...options.headers,
        ...csrfHeaders,
      },
    }
  }

  return fetch(url, options)
}
