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
      console.warn(
        '[getAppUrl] NEXT_PUBLIC_APP_URL not set in production. Using default:',
        defaultUrl,
        '- This may cause canonical URL and Open Graph issues.'
      )
    }
    return defaultUrl
  }

  // Validate URL format and protocol in production
  if (isProduction) {
    try {
      const url = new URL(envUrl)
      if (url.protocol !== 'https:') {
        console.warn(
          `[getAppUrl] Production URL should use HTTPS: ${envUrl}. Using default instead:`,
          defaultUrl
        )
        return defaultUrl
      }
    } catch (error) {
      console.error(
        `[getAppUrl] Invalid URL in NEXT_PUBLIC_APP_URL: ${envUrl}. Using default:`,
        defaultUrl,
        error
      )
      return defaultUrl
    }
  }

  return envUrl
}
