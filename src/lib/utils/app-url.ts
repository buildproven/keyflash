/**
 * Get the application URL from environment variables
 * Falls back to production domain if not configured
 */
export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL || 'https://keyflash.vibebuildlab.com'

  // Warn in production if using fallback
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.NEXT_PUBLIC_APP_URL
  ) {
    console.warn(
      'NEXT_PUBLIC_APP_URL not configured, using fallback domain. This may cause canonical URL issues.'
    )
  }

  return url
}
