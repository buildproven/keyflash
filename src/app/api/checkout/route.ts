import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { logger } from '@/lib/utils/logger'
import { getAppUrl } from '@/lib/utils/app-url'
import { userService } from '@/lib/user/user-service'
import {
  rateLimiter,
  type RateLimitConfig,
} from '@/lib/rate-limit/redis-rate-limiter'

const CHECKOUT_RATE_LIMIT: RateLimitConfig = {
  requestsPerHour: 10,
  enabled: true,
  failSafe: 'closed',
}

// Lazy initialization to avoid build-time errors
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  return new Stripe(key, {
    apiVersion: '2025-12-15.clover',
  })
}

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

  if (!headerOrigin) {
    return fallbackOrigin
  }

  const normalizedHeader = normalizeOrigin(headerOrigin)
  if (normalizedHeader && allowedOrigins.has(normalizedHeader)) {
    return normalizedHeader
  }

  return fallbackOrigin
}

export async function POST(request: NextRequest) {
  try {
    // FIX-004: Require authentication
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // FIX-010: Rate limit checkout requests
    const rateLimitResult = await rateLimiter.checkRateLimit(
      request,
      CHECKOUT_RATE_LIMIT
    )
    if (!rateLimitResult.allowed) {
      logger.warn('Checkout rate limit exceeded', {
        module: 'Checkout',
        userId: authResult.userId,
        retryAfter: rateLimitResult.retryAfter,
      })
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 3600),
          },
        }
      )
    }

    const priceId = process.env.STRIPE_PRICE_PRO
    if (!priceId) {
      logger.error('Checkout: STRIPE_PRICE_PRO not configured')
      return NextResponse.json(
        { error: 'Checkout not configured' },
        { status: 500 }
      )
    }

    // Ensure user exists so webhook can link subscription
    const sessionClaims = authResult.sessionClaims as
      | { email?: string }
      | undefined
    const fallbackEmail = `${authResult.userId}@keyflash.local`
    const userEmail = sessionClaims?.email || fallbackEmail
    const user = await userService.getOrCreateUser(authResult.userId, userEmail)
    const customerEmail = user?.email

    const stripe = getStripe()
    const origin = resolveCheckoutOrigin(request)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/search?upgraded=true`,
      cancel_url: `${origin}/search?canceled=true`,
      // Pre-fill email if available for better user experience
      ...(customerEmail && { customer_email: customerEmail }),
      // Create customer if not pre-filled
      customer_creation: customerEmail ? undefined : 'always',
      // Allow promotion codes
      allow_promotion_codes: true,
      // Subscription data with user ID for webhook linking
      subscription_data: {
        metadata: {
          product: 'keyflash-pro',
          clerkUserId: authResult.userId,
        },
      },
      // Store clerk user ID in session metadata for webhook
      metadata: {
        clerkUserId: authResult.userId,
      },
    })

    logger.info('Checkout session created', {
      sessionId: session.id,
      priceId,
      userId: authResult.userId,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Checkout session creation failed', { error: message })
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
