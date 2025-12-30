import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logger } from '@/lib/utils/logger'

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

  const fallbackOrigin =
    Array.from(allowedOrigins)[0] || 'https://keyflash.vibebuildlab.com'

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
    const priceId = process.env.STRIPE_PRICE_PRO
    if (!priceId) {
      logger.error('Checkout: STRIPE_PRICE_PRO not configured')
      return NextResponse.json(
        { error: 'Checkout not configured' },
        { status: 500 }
      )
    }

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
      // Collect email for account creation
      customer_creation: 'always',
      // Allow promotion codes
      allow_promotion_codes: true,
      // Subscription data
      subscription_data: {
        metadata: {
          product: 'keyflash-pro',
        },
      },
    })

    logger.info('Checkout session created', {
      sessionId: session.id,
      priceId,
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
