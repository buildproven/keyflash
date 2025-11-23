import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache/redis'
import { createProvider, type ProviderName } from '@/lib/api/factory'

// Route segment config for security
export const runtime = 'nodejs'
export const maxDuration = 10 // 10 second timeout for health checks
export const dynamic = 'force-dynamic'

/**
 * Health check results for a dependency
 */
interface HealthCheckResult {
  healthy: boolean
  responseTime?: number
  error?: string
  details?: Record<string, any>
}

/**
 * Overall health status response
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  environment: string
  checks: {
    redis: HealthCheckResult
    provider: HealthCheckResult
  }
  responseTime: number
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now()

  try {
    const privacyMode = process.env.PRIVACY_MODE === 'true'
    const redisConfigured = !!(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    )

    // Handle privacy mode - cache disabled is expected and healthy
    if (privacyMode) {
      return {
        healthy: true, // Privacy mode is expected behavior, not unhealthy
        responseTime: Date.now() - start,
        details: {
          privacyMode: true,
          status: 'disabled for privacy compliance',
          redisConfigured,
        },
      }
    }

    // Check if Redis is configured
    if (!redisConfigured) {
      return {
        healthy: false,
        responseTime: Date.now() - start,
        error: 'Redis not configured',
        details: {
          privacyMode: false,
          redisConfigured: false,
          message: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN',
        },
      }
    }

    // Test Redis connectivity using the built-in ping method
    const pingResult = await cache.ping()

    if (!pingResult) {
      throw new Error('Redis ping failed - no PONG response')
    }

    return {
      healthy: true,
      responseTime: Date.now() - start,
      details: {
        configured: true,
        responsive: true,
      },
    }
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
      details: {
        configured: !!(
          process.env.UPSTASH_REDIS_REST_URL &&
          process.env.UPSTASH_REDIS_REST_TOKEN
        ),
      },
    }
  }
}

/**
 * Check provider configuration
 */
async function checkProvider(): Promise<HealthCheckResult> {
  const start = Date.now()

  try {
    // Use same logic as API factory - defaults to mock provider
    const providerName = (
      process.env.KEYWORD_API_PROVIDER || 'mock'
    ).toLowerCase() as ProviderName

    // Create provider to check if it's available
    const provider = createProvider()
    const details: Record<string, any> = {
      provider: providerName,
      name: provider.name,
    }

    // Use provider's built-in validation - same logic as API
    let configured = false
    try {
      provider.validateConfiguration()
      configured = true
      if (providerName === 'mock') {
        details.note = 'Mock provider active - for development/testing only'
      }
    } catch (error) {
      configured = false
      details.configError =
        error instanceof Error
          ? error.message
          : 'Configuration validation failed'
    }

    return {
      healthy: configured,
      responseTime: Date.now() - start,
      error: configured
        ? undefined
        : 'Provider not properly configured - missing required environment variables',
      details,
    }
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown provider error',
    }
  }
}

/**
 * GET /api/health
 * Enhanced health check endpoint for monitoring system dependencies
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const start = Date.now()

  // Run health checks in parallel for better performance
  const [redisCheck, providerCheck] = await Promise.all([
    checkRedis(),
    checkProvider(),
  ])

  // Determine overall system health
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy'

  if (redisCheck.healthy && providerCheck.healthy) {
    overallStatus = 'healthy'
  } else if (redisCheck.healthy || providerCheck.healthy) {
    overallStatus = 'degraded' // Some services working
  } else {
    overallStatus = 'unhealthy' // All critical services down
  }

  // Determine HTTP status code
  let httpStatus: number
  switch (overallStatus) {
    case 'healthy':
      httpStatus = 200
      break
    case 'degraded':
      httpStatus = 207 // Multi-Status - some services working
      break
    case 'unhealthy':
      httpStatus = 503 // Service Unavailable
      break
  }

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      redis: redisCheck,
      provider: providerCheck,
    },
    responseTime: Date.now() - start,
  }

  return NextResponse.json(response, { status: httpStatus })
}
