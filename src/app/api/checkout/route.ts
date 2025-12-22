import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logger } from '@/lib/utils/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
})

// KeyFlash Pro subscription price ID
const PRICE_ID = process.env.STRIPE_PRICE_PRO

export async function POST(request: NextRequest) {
  try {
    if (!PRICE_ID) {
      logger.error('Checkout: STRIPE_PRICE_PRO not configured')
      return NextResponse.json(
        { error: 'Checkout not configured' },
        { status: 500 }
      )
    }

    const origin =
      request.headers.get('origin') || 'https://keyflash.vibebuildlab.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: PRICE_ID,
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
      priceId: PRICE_ID,
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
