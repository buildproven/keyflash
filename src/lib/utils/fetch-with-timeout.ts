/**
 * Fetch with timeout and AbortController
 *
 * Wraps native fetch with automatic timeout handling to prevent
 * requests from hanging indefinitely on slow APIs.
 *
 * @param url - URL to fetch
 * @param options - Standard fetch options
 * @param timeout - Timeout in milliseconds (default: 30000ms / 30s)
 * @returns Promise<Response>
 * @throws {Error} 'Request timeout' if request exceeds timeout
 */
export async function fetchWithTimeout(
  url: string | URL,
  options: globalThis.RequestInit = {},
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`)
    }
    throw error
  }
}

/**
 * Default timeout values for different API types
 */
export const API_TIMEOUTS = {
  /** Standard API calls (keyword data, etc.) - 30 seconds */
  DEFAULT: 30000,
  /** OAuth token refresh - 10 seconds */
  AUTH: 10000,
  /** Health checks - 5 seconds */
  HEALTH: 5000,
  /** Webhook deliveries - 15 seconds */
  WEBHOOK: 15000,
} as const
