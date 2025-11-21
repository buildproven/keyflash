import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache/redis'

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
    const provider = process.env.KEYWORD_API_PROVIDER

    if (!provider) {
      return {
        healthy: false,
        responseTime: Date.now() - start,
        error: 'No provider configured',
        details: {
          configured: false,
        },
      }
    }

    // Check provider-specific configuration
    let configured = false
    const details: Record<string, any> = { provider }

    switch (provider) {
      case 'google-ads':
        configured = !!(
          process.env.GOOGLE_ADS_CLIENT_ID &&
          process.env.GOOGLE_ADS_CLIENT_SECRET &&
          process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
          process.env.GOOGLE_ADS_REFRESH_TOKEN &&
          process.env.GOOGLE_ADS_CUSTOMER_ID
        )
        details.requiredVars = [
          'GOOGLE_ADS_CLIENT_ID',
          'GOOGLE_ADS_CLIENT_SECRET',
          'GOOGLE_ADS_DEVELOPER_TOKEN',
          'GOOGLE_ADS_REFRESH_TOKEN',
          'GOOGLE_ADS_CUSTOMER_ID',
        ]
        break

      case 'dataforseo':
        configured = !!(
          process.env.DATAFORSEO_API_LOGIN &&
          process.env.DATAFORSEO_API_PASSWORD
        )
        details.requiredVars = [
          'DATAFORSEO_API_LOGIN',
          'DATAFORSEO_API_PASSWORD',
        ]
        break

      case 'mock':
        configured = true // Mock provider doesn't need credentials
        details.note = 'Mock provider active - for development/testing only'
        break

      default:
        return {
          healthy: false,
          responseTime: Date.now() - start,
          error: `Unknown provider: ${provider}`,
          details,
        }
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
