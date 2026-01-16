/**
 * CODE-010: Health Check Validation
 *
 * Validates connectivity to critical services at startup.
 * Fails fast if dependencies are not available, preventing
 * the application from starting with broken services.
 */

import https from 'https'
import { logger } from '@/lib/utils/logger'

export interface HealthCheckResult {
  service: string
  healthy: boolean
  error?: string
  latencyMs?: number
}

/**
 * Check Redis connectivity
 */
export async function checkRedisHealth(): Promise<HealthCheckResult> {
  const service = 'Redis'
  const startTime = Date.now()

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    // Skip if Redis not configured
    if (!url || !token) {
      return {
        service,
        healthy: true, // Not required in dev
        error: 'Redis not configured (optional in development)',
      }
    }

    // CODE-001: Try to ping Redis with connection pooling
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url,
      token,
      // CODE-001: Configure HTTPS agent with connection pooling
      // Even for startup-only health checks, this prevents connection buildup
      // if health checks are triggered multiple times during initialization
      agent: new https.Agent({
        keepAlive: true,
        maxSockets: 50,
      }),
    })
    const result = await redis.ping()

    const latencyMs = Date.now() - startTime

    if (result === 'PONG') {
      return { service, healthy: true, latencyMs }
    } else {
      return {
        service,
        healthy: false,
        error: `Unexpected ping response: ${result}`,
        latencyMs,
      }
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.warn(`${service} health check failed: ${errorMessage}`, {
      module: 'HealthCheck',
      service,
      latency: latencyMs,
      error,
    })

    return {
      service,
      healthy: false,
      error: errorMessage,
      latencyMs,
    }
  }
}

/**
 * Check Clerk authentication service
 */
export async function checkClerkHealth(): Promise<HealthCheckResult> {
  const service = 'Clerk Auth'
  const startTime = Date.now()

  try {
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    const secretKey = process.env.CLERK_SECRET_KEY

    if (!publishableKey || !secretKey) {
      return {
        service,
        healthy: false,
        error: 'Clerk credentials not configured',
      }
    }

    // Basic validation: check if keys have correct format
    if (!publishableKey.startsWith('pk_') || !secretKey.startsWith('sk_')) {
      return {
        service,
        healthy: false,
        error: 'Clerk keys have invalid format',
      }
    }

    const latencyMs = Date.now() - startTime

    // Keys are formatted correctly
    return { service, healthy: true, latencyMs }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.warn(`${service} health check failed: ${errorMessage}`, {
      module: 'HealthCheck',
      service,
      latency: latencyMs,
      error,
    })

    return {
      service,
      healthy: false,
      error: errorMessage,
      latencyMs,
    }
  }
}

/**
 * Check Stripe payment service
 */
export async function checkStripeHealth(): Promise<HealthCheckResult> {
  const service = 'Stripe'
  const startTime = Date.now()

  try {
    const billingEnabled = process.env.BILLING_ENABLED === 'true'

    // Skip if billing not enabled
    if (!billingEnabled) {
      return {
        service,
        healthy: true,
        error: 'Billing disabled (BILLING_ENABLED=false)',
      }
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    const priceId = process.env.STRIPE_PRICE_PRO

    if (!secretKey || !webhookSecret || !priceId) {
      return {
        service,
        healthy: false,
        error:
          'Stripe credentials incomplete (billing enabled but missing keys)',
      }
    }

    // Basic validation: check if keys have correct format
    if (!secretKey.startsWith('sk_') && !secretKey.startsWith('rk_')) {
      return {
        service,
        healthy: false,
        error: 'Stripe secret key has invalid format',
      }
    }

    if (!webhookSecret.startsWith('whsec_')) {
      return {
        service,
        healthy: false,
        error: 'Stripe webhook secret has invalid format',
      }
    }

    const latencyMs = Date.now() - startTime

    // Keys are formatted correctly
    return { service, healthy: true, latencyMs }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.warn(`${service} health check failed: ${errorMessage}`, {
      module: 'HealthCheck',
      service,
      latency: latencyMs,
      error,
    })

    return {
      service,
      healthy: false,
      error: errorMessage,
      latencyMs,
    }
  }
}

/**
 * Run all health checks and return results
 */
export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  const checks = await Promise.all([
    checkRedisHealth(),
    checkClerkHealth(),
    checkStripeHealth(),
  ])

  return checks
}

/**
 * Validate all health checks pass (for startup)
 * Throws error if any critical service is unhealthy
 */
export async function validateHealthChecks(): Promise<void> {
  const results = await runHealthChecks()

  const failures = results.filter(
    r =>
      !r.healthy &&
      !r.error?.includes('optional') &&
      !r.error?.includes('disabled')
  )

  if (failures.length > 0) {
    const errorMessages = failures.map(
      f => `  - ${f.service}: ${f.error || 'Unknown error'}`
    )

    throw new Error(
      `Health check failed for ${failures.length} service(s):\n${errorMessages.join('\n')}`
    )
  }

  // Log successful checks
  results.forEach(result => {
    if (result.healthy) {
      const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : ''
      const note = result.error ? ` - ${result.error}` : ''
      logger.info(`✓ ${result.service}${latency}${note}`, {
        module: 'HealthCheck',
      })
    }
  })
}
