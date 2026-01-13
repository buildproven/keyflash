import { logger } from './logger'

/**
 * Get the application URL from environment variables
 * Falls back to localhost in development or Vercel URL in production
 * Validates URL format and protocol in production
 */
export function getAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  const isProduction = process.env.NODE_ENV === 'production'

  // Use VERCEL_URL if available in production (automatically set by Vercel)
  const vercelUrl = process.env.VERCEL_URL
  const defaultUrl =
    isProduction && vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000'

  if (!envUrl) {
    if (isProduction && !vercelUrl) {
      // In production without VERCEL_URL, log warning
      // This prevents build failures while alerting to misconfiguration
      logger.warn(
        'NEXT_PUBLIC_APP_URL not set in production. Using default - this may cause canonical URL and Open Graph issues.',
        {
          module: 'AppUrl',
          defaultUrl,
        }
      )
    }
    return defaultUrl
  }

  // Validate URL format and protocol in production
  if (isProduction) {
    try {
      const url = new URL(envUrl)
      if (url.protocol !== 'https:') {
        logger.warn('Production URL should use HTTPS. Using default instead.', {
          module: 'AppUrl',
          providedUrl: envUrl,
          defaultUrl,
        })
        return defaultUrl
      }
    } catch (error) {
      logger.error(
        'Invalid URL in NEXT_PUBLIC_APP_URL. Using default.',
        error,
        {
          module: 'AppUrl',
          providedUrl: envUrl,
          defaultUrl,
        }
      )
      return defaultUrl
    }
  }

  return envUrl
}
