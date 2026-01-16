import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Redis } from '@upstash/redis'
import https from 'https'
import { logger } from '@/lib/utils/logger'
import {
  userService,
  UserServiceUnavailableError,
  UserServiceOperationError,
} from '@/lib/user/user-service'
import {
  StripeCheckoutSessionSchema,
  StripeSubscriptionSchema,
} from '@/lib/validation/domain-schemas'
import { isBillingEnabled } from '@/lib/billing'
import { handleAPIError, type HttpError } from '@/lib/utils/error-handler'

// FIX-005: Custom error for infrastructure failures that should trigger retry
class InfrastructureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InfrastructureError'
  }
}

// Webhook idempotency: track processed event IDs to prevent duplicates
// Stripe can retry webhooks for up to 3 days, so we use 72-hour TTL
const WEBHOOK_EVENT_TTL_SECONDS = 72 * 60 * 60 // 72 hours
const WEBHOOK_EVENT_PREFIX = 'stripe-webhook:'

// CODE-001: Redis connection pooling for webhook handler
// Lazy Redis initialization with keepAlive agent to reuse HTTP connections
let webhookRedis: Redis | null = null
function getWebhookRedis(): Redis | null {
  if (webhookRedis) return webhookRedis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    webhookRedis = new Redis({
      url,
      token,
      // CODE-001: Configure HTTPS agent with connection pooling
      // - keepAlive: reuse TCP connections across requests
      // - maxSockets: allow up to 50 concurrent connections
      agent: new https.Agent({
        keepAlive: true,
        maxSockets: 50,
      }),
    })
    return webhookRedis
  } catch (error) {
    logger.error('Failed to initialize webhook Redis client', error, {
      module: 'StripeWebhook',
      errorId: 'WEBHOOK_REDIS_INIT_FAILED',
    })

    // FAIL FAST in production - webhooks cannot work without Redis
    if (process.env.NODE_ENV === 'production') {
      throw error
    }
    return null
  }
}

/**
 * Check if a webhook event was already processed
 * @returns true if already processed, false if new
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const redis = getWebhookRedis()
  if (!redis) return false // Skip check if Redis unavailable (dev mode only)
  try {
    const exists = await redis.exists(`${WEBHOOK_EVENT_PREFIX}${eventId}`)
    return exists === 1
  } catch (error) {
    logger.error('Failed to check webhook event idempotency', error, {
      eventId,
      module: 'StripeWebhook',
    })
    // FAIL CLOSED: Assume processed to prevent duplicate billing
    return true
  }
}

/**
 * Mark a webhook event as processed (optimistic locking)
 * @throws InfrastructureError if Redis unavailable or operation fails
 */
async function markEventProcessed(eventId: string): Promise<void> {
  const redis = getWebhookRedis()
  if (!redis) {
    throw new InfrastructureError('Redis unavailable for webhook idempotency')
  }

  // No try-catch - let errors propagate to trigger 503 response
  await redis.set(`${WEBHOOK_EVENT_PREFIX}${eventId}`, '1', {
    ex: WEBHOOK_EVENT_TTL_SECONDS,
  })
}

/**
 * Delete processed mark (rollback for failed processing)
 * Used when business logic fails and we want Stripe to retry
 */
async function deleteEventProcessedMark(eventId: string): Promise<void> {
  const redis = getWebhookRedis()
  if (!redis) return // Can't rollback if Redis unavailable

  try {
    await redis.del(`${WEBHOOK_EVENT_PREFIX}${eventId}`)
  } catch (error) {
    logger.error('Failed to delete webhook processed mark', error, {
      eventId,
      module: 'StripeWebhook',
    })
    // Don't throw - this is a rollback operation
  }
}

// FIX-007: Helper to safely extract customer ID from Stripe objects
function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null
  if (typeof customer === 'string') return customer
  return customer.id
}

// FIX-007: Helper to safely extract subscription ID
function getSubscriptionId(
  subscription: string | Stripe.Subscription | null
): string | null {
  if (!subscription) return null
  if (typeof subscription === 'string') return subscription
  return subscription.id
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

export async function POST(request: NextRequest) {
  // Check if billing is enabled
  if (!isBillingEnabled()) {
    const error: HttpError = new Error(
      'This is an open source instance with billing disabled.'
    )
    error.status = 503
    return handleAPIError(error)
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    logger.error('Stripe webhook: STRIPE_WEBHOOK_SECRET not configured')
    const error: HttpError = new Error('Webhook not configured')
    error.status = 500
    return handleAPIError(error)
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    logger.warn('Stripe webhook: Missing signature')
    const error: HttpError = new Error('Missing signature')
    error.status = 400
    return handleAPIError(error)
  }

  let event: Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    logger.error('Stripe webhook signature verification failed', { error: err })
    const error: HttpError = new Error('Invalid signature')
    error.status = 400
    return handleAPIError(error)
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id })

  // Idempotency check: skip if event already processed
  if (await isEventProcessed(event.id)) {
    logger.info('Stripe webhook event already processed (idempotent)', {
      type: event.type,
      id: event.id,
    })
    return NextResponse.json({ received: true, duplicate: true })
  }

  // SEC-011 FIX: Mark event as processed BEFORE business logic (optimistic locking)
  // This prevents duplicate processing if Redis fails during business logic
  await markEventProcessed(event.id)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // TYPE-001 FIX: Validate with Zod instead of type assertion
        const session = StripeCheckoutSessionSchema.parse(event.data.object)
        await handleCheckoutCompleted(
          session as unknown as Stripe.Checkout.Session
        )
        break
      }

      case 'customer.subscription.created': {
        // TYPE-001 FIX: Validate with Zod instead of type assertion
        const subscription = StripeSubscriptionSchema.parse(event.data.object)
        await handleSubscriptionCreated(
          subscription as unknown as Stripe.Subscription
        )
        break
      }

      case 'customer.subscription.updated': {
        // TYPE-001 FIX: Validate with Zod instead of type assertion
        const subscription = StripeSubscriptionSchema.parse(event.data.object)
        await handleSubscriptionUpdated(
          subscription as unknown as Stripe.Subscription
        )
        break
      }

      case 'customer.subscription.deleted': {
        // TYPE-001 FIX: Validate with Zod instead of type assertion
        const subscription = StripeSubscriptionSchema.parse(event.data.object)
        await handleSubscriptionDeleted(
          subscription as unknown as Stripe.Subscription
        )
        break
      }

      default:
        logger.info('Unhandled webhook event type', { type: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    // FIX-005: Return 503 for infrastructure errors so Stripe retries
    if (
      err instanceof InfrastructureError ||
      err instanceof UserServiceUnavailableError ||
      err instanceof UserServiceOperationError
    ) {
      // SEC-011 FIX: Delete processed mark so Stripe can retry
      await deleteEventProcessedMark(event.id)

      logger.error('Stripe webhook infrastructure error (will retry)', {
        type: event.type,
        error: err,
      })
      const error: HttpError = new Error('Service temporarily unavailable')
      error.status = 503
      return handleAPIError(error)
    }

    logger.error('Stripe webhook handler error', {
      type: event.type,
      error: err,
    })
    const error: HttpError = new Error('Webhook handler failed')
    error.status = 500
    return handleAPIError(error)
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // FIX-007: Safely extract IDs using type-safe helpers
  const customerId = getCustomerId(session.customer)
  const subscriptionId = getSubscriptionId(session.subscription)
  const email = session.customer_email
  // Get clerkUserId from metadata (set during checkout)
  const clerkUserId = session.metadata?.clerkUserId

  logger.info('Checkout completed', {
    sessionId: session.id,
    customerId,
    email,
    subscriptionId,
    clerkUserId,
  })

  if (!customerId || !subscriptionId) {
    logger.error('Checkout completed but missing customer or subscription ID', {
      sessionId: session.id,
      customerId,
      subscriptionId,
    })
    return
  }

  // Try to find user by clerkUserId from metadata first (most reliable)
  // Note: getUser now throws UserServiceUnavailableError/UserServiceOperationError on Redis issues
  let user = clerkUserId ? await userService.getUser(clerkUserId) : null

  // Fallback to email lookup if no clerkUserId or user not found
  if (!user && email) {
    user = await userService.getUserByEmail(email)
  }

  if (!user) {
    logger.warn('Checkout completed but user not found', { email, clerkUserId })
    return
  }

  // Upgrade user to Pro
  // Note: upgradeToProTier now throws on Redis errors, returns null only if user not found
  const upgraded = await userService.upgradeToProTier(
    user.clerkUserId,
    customerId,
    subscriptionId
  )

  if (!upgraded) {
    // User not found during upgrade (unlikely since we just retrieved them)
    logger.warn('User not found during upgrade', {
      clerkUserId: user.clerkUserId,
    })
    return
  }

  logger.info('User upgraded to Pro', {
    clerkUserId: user.clerkUserId,
    email,
    subscriptionId,
  })
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  // FIX-007: Safely extract customer ID
  const customerId = getCustomerId(subscription.customer)

  logger.info('Subscription created', {
    subscriptionId: subscription.id,
    customerId,
    status: subscription.status,
  })

  if (!customerId) {
    logger.error('Subscription created but no customer ID', {
      subscriptionId: subscription.id,
    })
    return
  }

  // Look up user by Stripe customer ID
  // Note: getUserByStripeCustomerId throws on Redis errors, returns null only if not found
  const user = await userService.getUserByStripeCustomerId(customerId)

  if (!user) {
    logger.warn('Subscription created but user not found', { customerId })
    return
  }

  // Ensure user is on Pro tier
  if (subscription.status === 'active') {
    const upgraded = await userService.upgradeToProTier(
      user.clerkUserId,
      customerId,
      subscription.id
    )
    if (!upgraded) {
      logger.warn('User not found during subscription upgrade', {
        clerkUserId: user.clerkUserId,
      })
      return
    }
    logger.info('User subscription confirmed', {
      clerkUserId: user.clerkUserId,
      subscriptionId: subscription.id,
    })
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // FIX-007: Safely extract customer ID
  const customerId = getCustomerId(subscription.customer)

  logger.info('Subscription updated', {
    subscriptionId: subscription.id,
    customerId,
    status: subscription.status,
  })

  if (!customerId) {
    logger.error('Subscription updated but no customer ID', {
      subscriptionId: subscription.id,
    })
    return
  }

  // Look up user by Stripe customer ID
  // Note: getUserByStripeCustomerId throws on Redis errors, returns null only if not found
  const user = await userService.getUserByStripeCustomerId(customerId)

  if (!user) {
    logger.warn('Subscription updated but user not found', { customerId })
    return
  }

  // FIX-007: Type-safe status handling
  // Note: updateUser/downgradeToTrialTier throw on Redis errors, return null only if user not found
  const status = subscription.status
  let updateResult

  if (status === 'active') {
    updateResult = await userService.updateUser(user.clerkUserId, {
      tier: 'pro',
      subscriptionStatus: 'active',
    })
  } else if (status === 'canceled' || status === 'unpaid') {
    updateResult = await userService.downgradeToTrialTier(user.clerkUserId)
  } else if (status === 'past_due') {
    updateResult = await userService.updateUser(user.clerkUserId, {
      subscriptionStatus: 'past_due',
    })
  } else {
    // For other statuses, just log
    logger.info('Subscription status not handled', { status })
    return
  }

  if (!updateResult) {
    logger.warn('User not found during subscription update', {
      clerkUserId: user.clerkUserId,
    })
    return
  }

  logger.info('User subscription status updated', {
    clerkUserId: user.clerkUserId,
    status,
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // FIX-007: Safely extract customer ID
  const customerId = getCustomerId(subscription.customer)

  logger.info('Subscription deleted', {
    subscriptionId: subscription.id,
    customerId,
  })

  if (!customerId) {
    logger.error('Subscription deleted but no customer ID', {
      subscriptionId: subscription.id,
    })
    return
  }

  // Look up user by Stripe customer ID
  // Note: getUserByStripeCustomerId throws on Redis errors, returns null only if not found
  const user = await userService.getUserByStripeCustomerId(customerId)

  if (!user) {
    logger.warn('Subscription deleted but user not found', { customerId })
    return
  }

  // Downgrade user to trial tier
  // Note: downgradeToTrialTier throws on Redis errors, returns null only if user not found
  const downgraded = await userService.downgradeToTrialTier(user.clerkUserId)
  if (!downgraded) {
    logger.warn('User not found during downgrade', {
      clerkUserId: user.clerkUserId,
    })
    return
  }

  logger.info('User downgraded to trial', {
    clerkUserId: user.clerkUserId,
  })
}
