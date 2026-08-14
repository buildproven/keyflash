/** Normalize UI location codes for keyword providers and cache keys. */
const LOCATION_MAP = new Map<string, string>([
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['IN', 'India'],
  ['GL', 'Worldwide'],
])

export function normalizeLocationForProvider(location?: string): string {
  if (!location) return 'United States'
  return LOCATION_MAP.get(location) ?? 'United States'
}
