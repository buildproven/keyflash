import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logger } from '@/lib/utils/logger'
import { userService } from '@/lib/user/user-service'

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

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    logger.error('Stripe webhook: STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    )
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    logger.warn('Stripe webhook: Missing signature')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Stripe webhook signature verification failed', {
      error: message,
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated(subscription)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      default:
        logger.info('Unhandled webhook event type', { type: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Stripe webhook handler error', {
      type: event.type,
      error: message,
    })
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  logger.info('Checkout completed', {
    sessionId: session.id,
    customerId: session.customer,
    email: session.customer_email,
    subscriptionId: session.subscription,
  })

  const email = session.customer_email
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!email) {
    logger.warn('Checkout completed but no email provided', {
      sessionId: session.id,
    })
    return
  }

  // Look up user by email
  const user = await userService.getUserByEmail(email)

  if (!user) {
    logger.warn('Checkout completed but user not found', { email })
    return
  }

  // Upgrade user to Pro
  await userService.upgradeToProTier(
    user.clerkUserId,
    customerId,
    subscriptionId
  )
  logger.info('User upgraded to Pro', {
    clerkUserId: user.clerkUserId,
    email,
    subscriptionId,
  })
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  logger.info('Subscription created', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  })

  const customerId = subscription.customer as string

  // Look up user by Stripe customer ID
  const user = await userService.getUserByStripeCustomerId(customerId)

  if (!user) {
    logger.warn('Subscription created but user not found', { customerId })
    return
  }

  // Ensure user is on Pro tier
  if (subscription.status === 'active') {
    await userService.upgradeToProTier(
      user.clerkUserId,
      customerId,
      subscription.id
    )
    logger.info('User subscription confirmed', {
      clerkUserId: user.clerkUserId,
      subscriptionId: subscription.id,
    })
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  logger.info('Subscription updated', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  })

  const customerId = subscription.customer as string

  // Look up user by Stripe customer ID
  const user = await userService.getUserByStripeCustomerId(customerId)

  if (!user) {
    logger.warn('Subscription updated but user not found', { customerId })
    return
  }

  // Update subscription status
  const status = subscription.status as
    | 'active'
    | 'canceled'
    | 'past_due'
    | 'unpaid'

  if (status === 'active') {
    await userService.updateUser(user.clerkUserId, {
      tier: 'pro',
      subscriptionStatus: 'active',
    })
  } else if (status === 'canceled' || status === 'unpaid') {
    await userService.downgradeToTrialTier(user.clerkUserId)
  } else {
    await userService.updateUser(user.clerkUserId, {
      subscriptionStatus: status,
    })
  }

  logger.info('User subscription status updated', {
    clerkUserId: user.clerkUserId,
    status,
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  logger.info('Subscription deleted', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  })

  const customerId = subscription.customer as string

  // Look up user by Stripe customer ID
  const user = await userService.getUserByStripeCustomerId(customerId)

  if (!user) {
    logger.warn('Subscription deleted but user not found', { customerId })
    return
  }

  // Downgrade user to trial tier
  await userService.downgradeToTrialTier(user.clerkUserId)
  logger.info('User downgraded to trial', {
    clerkUserId: user.clerkUserId,
  })
}
