import { logger } from './logger'

/**
 * Get the application URL from environment variables
 * Falls back to production domain if not configured
 * Validates URL format and protocol in production
 */
export function getAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  const defaultUrl = 'https://keyflash.vibebuildlab.com'
  const isProduction = process.env.NODE_ENV === 'production'

  if (!envUrl) {
    if (isProduction) {
      // In production, log warning but still return default
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
