import type { NextRequest } from 'next/server'

import { getAppUrl } from './app-url'

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

export function resolveCheckoutOrigin(request: NextRequest): string {
  const headerOrigin = request.headers.get('origin')
  const allowedOrigins = new Set<string>()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    const normalized = normalizeOrigin(appUrl)
    if (normalized) allowedOrigins.add(normalized)
  }

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) {
    const normalized = normalizeOrigin(`https://${vercelUrl}`)
    if (normalized) allowedOrigins.add(normalized)
  }

  const fallbackOrigin = Array.from(allowedOrigins)[0] || getAppUrl()
  if (!headerOrigin) return fallbackOrigin

  const normalizedHeader = normalizeOrigin(headerOrigin)
  return normalizedHeader && allowedOrigins.has(normalizedHeader)
    ? normalizedHeader
    : fallbackOrigin
}
