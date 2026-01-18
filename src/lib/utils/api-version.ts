/**
 * API Versioning Utilities
 * ARCH-001: API versioning strategy for production maturity
 *
 * Current version: v1
 * Versioning strategy:
 * - URL-based versioning: /api/v1/*, /api/v2/*, etc.
 * - API-Version header for client identification
 * - Backwards compatibility: /api/* routes map to /api/v1/* (implicit v1)
 * - Deprecation policy: minimum 6 months notice before removal
 */

export const CURRENT_API_VERSION = 'v1'
export const SUPPORTED_API_VERSIONS = ['v1'] as const
export type APIVersion = (typeof SUPPORTED_API_VERSIONS)[number]

/**
 * API version metadata added to responses
 */
export interface APIVersionMetadata {
  version: string
  deprecated?: boolean
  deprecationDate?: string
  sunsetDate?: string
  upgradeUrl?: string
}

/**
 * Get API version from request path or headers
 * @param pathname - Request pathname (e.g., /api/v1/keywords)
 * @param versionHeader - Optional API-Version header value
 * @returns API version (e.g., 'v1') or null if not versioned
 */
export function getAPIVersion(
  pathname: string,
  versionHeader?: string | null
): APIVersion | null {
  // Extract version from URL path: /api/v1/... → 'v1'
  const pathMatch = pathname.match(/^\/api\/(v\d+)\//)
  if (pathMatch) {
    const version = pathMatch[1] as APIVersion
    if (SUPPORTED_API_VERSIONS.includes(version)) {
      return version
    }
  }

  // Check API-Version header as fallback
  if (versionHeader) {
    const normalized = versionHeader.toLowerCase().trim()
    const headerVersion = normalized.startsWith('v')
      ? normalized
      : `v${normalized}`
    if (SUPPORTED_API_VERSIONS.includes(headerVersion as APIVersion)) {
      return headerVersion as APIVersion
    }
  }

  // Unversioned paths /api/* default to v1 for backwards compatibility
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/v')) {
    return 'v1'
  }

  return null
}

/**
 * Create API version headers for response
 * @param version - API version used for this request
 * @param metadata - Optional deprecation/sunset metadata
 */
export function createVersionHeaders(
  version: APIVersion,
  metadata?: Partial<APIVersionMetadata>
): Record<string, string> {
  const headers: Record<string, string> = {
    'API-Version': version,
  }

  if (metadata?.deprecated) {
    headers['Deprecation'] = 'true'
  }

  if (metadata?.deprecationDate) {
    headers['Deprecation-Date'] = metadata.deprecationDate
  }

  if (metadata?.sunsetDate) {
    headers['Sunset'] = metadata.sunsetDate
  }

  if (metadata?.upgradeUrl) {
    headers['Link'] = `<${metadata.upgradeUrl}>; rel="successor-version"`
  }

  return headers
}

/**
 * Check if an API version is supported
 */
export function isVersionSupported(version: string): boolean {
  return SUPPORTED_API_VERSIONS.includes(version as APIVersion)
}

/**
 * Get version metadata (for deprecation notices)
 * @param version - API version to check
 * @returns Metadata or null if not deprecated
 */
export function getVersionMetadata(
  version: APIVersion
): APIVersionMetadata | null {
  // v1 is current, not deprecated
  if (version === 'v1') {
    return {
      version: 'v1',
      deprecated: false,
    }
  }

  // Future versions would have deprecation metadata here
  return null
}
