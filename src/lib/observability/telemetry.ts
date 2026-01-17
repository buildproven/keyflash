/**
 * OpenTelemetry Observability Setup
 * ARCH-005: Enhanced logging/observability for production debugging
 *
 * Provides:
 * - Request/response logging with context
 * - Performance metrics tracking
 * - Distributed tracing foundations
 * - Error tracking correlation
 *
 * Future: Full OpenTelemetry integration with exporters (Jaeger, Prometheus, etc.)
 */

import { logger } from '@/lib/utils/logger'

/**
 * Request context for tracking across async operations
 */
export interface RequestContext {
  requestId: string
  method: string
  pathname: string
  startTime: number
  userId?: string
  userAgent?: string
  ip?: string
}

/**
 * Performance metrics for request processing
 */
export interface PerformanceMetrics {
  requestId: string
  duration: number
  statusCode: number
  endpoint: string
  method: string
  userId?: string
  cacheHit?: boolean
  providerUsed?: string
  keywordCount?: number
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * Create request context from Next.js request
 */
export function createRequestContext(
  method: string,
  pathname: string,
  headers: Headers
): RequestContext {
  const requestId = generateRequestId()

  return {
    requestId,
    method,
    pathname,
    startTime: Date.now(),
    userAgent: headers.get('user-agent') || undefined,
    ip:
      headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      headers.get('x-real-ip') ||
      undefined,
  }
}

/**
 * Log request start with context
 */
export function logRequestStart(context: RequestContext): void {
  logger.info('Request started', {
    module: 'RequestLogger',
    requestId: context.requestId,
    method: context.method,
    pathname: context.pathname,
    userId: context.userId,
    userAgent: context.userAgent,
    ip: context.ip,
  })
}

/**
 * Log request completion with performance metrics
 */
export function logRequestEnd(
  context: RequestContext,
  statusCode: number,
  additionalMetrics?: {
    cacheHit?: boolean
    providerUsed?: string
    keywordCount?: number
    error?: Error
  }
): void {
  const duration = Date.now() - context.startTime

  const metrics: PerformanceMetrics = {
    requestId: context.requestId,
    duration,
    statusCode,
    endpoint: context.pathname,
    method: context.method,
    userId: context.userId,
    ...additionalMetrics,
  }

  // Log based on status code
  if (statusCode >= 500) {
    logger.error('Request failed (5xx)', additionalMetrics?.error, {
      module: 'RequestLogger',
      ...metrics,
    })
  } else if (statusCode >= 400) {
    logger.warn('Request failed (4xx)', {
      module: 'RequestLogger',
      ...metrics,
    })
  } else if (statusCode >= 300) {
    logger.info('Request redirected', {
      module: 'RequestLogger',
      ...metrics,
    })
  } else {
    logger.info('Request completed', {
      module: 'RequestLogger',
      ...metrics,
    })
  }

  // Track slow requests (> 2 seconds)
  if (duration > 2000) {
    logger.warn('Slow request detected', {
      module: 'PerformanceMonitor',
      ...metrics,
      threshold: '2000ms',
    })
  }
}

/**
 * Log database operation performance
 */
export function logDatabaseOperation(
  operation: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  const logFn = success ? logger.info : logger.error

  logFn('Database operation', undefined, {
    module: 'DatabaseMonitor',
    operation,
    duration,
    success,
    ...metadata,
  })

  // Track slow database operations (> 500ms)
  if (duration > 500) {
    logger.warn('Slow database operation', {
      module: 'PerformanceMonitor',
      operation,
      duration,
      threshold: '500ms',
      ...metadata,
    })
  }
}

/**
 * Log external API call performance
 */
export function logExternalAPICall(
  provider: string,
  operation: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  const logFn = success ? logger.info : logger.error

  logFn('External API call', undefined, {
    module: 'ExternalAPIMonitor',
    provider,
    operation,
    duration,
    success,
    ...metadata,
  })

  // Track slow external API calls (> 3 seconds)
  if (duration > 3000) {
    logger.warn('Slow external API call', {
      module: 'PerformanceMonitor',
      provider,
      operation,
      duration,
      threshold: '3000ms',
      ...metadata,
    })
  }
}

/**
 * Log cache operation metrics
 */
export function logCacheOperation(
  operation: 'get' | 'set' | 'delete' | 'purge',
  hit: boolean,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  logger.info('Cache operation', {
    module: 'CacheMonitor',
    operation,
    hit,
    duration,
    ...metadata,
  })

  // Track cache operation anomalies
  if (operation === 'get' && duration > 100) {
    logger.warn('Slow cache read', {
      module: 'PerformanceMonitor',
      operation,
      duration,
      threshold: '100ms',
      ...metadata,
    })
  }
}

/**
 * Log circuit breaker state change
 */
export function logCircuitBreakerEvent(
  name: string,
  event: 'opened' | 'closed' | 'half_open' | 'attempt',
  metadata?: Record<string, unknown>
): void {
  const severity = event === 'opened' ? 'error' : event === 'closed' ? 'info' : 'warn'
  const logFn = severity === 'error' ? logger.error : severity === 'warn' ? logger.warn : logger.info

  logFn(`Circuit breaker ${event}`, undefined, {
    module: 'CircuitBreakerMonitor',
    circuitBreaker: name,
    event,
    ...metadata,
  })
}

/**
 * Track business metrics
 */
export interface BusinessMetrics {
  keywordSearches?: number
  contentBriefsGenerated?: number
  relatedKeywordsRequests?: number
  savedSearches?: number
  checkoutAttempts?: number
  subscriptions?: number
  apiCalls?: number
  cacheHitRate?: number
}

/**
 * Log business metrics for monitoring
 */
export function logBusinessMetrics(
  period: 'hourly' | 'daily',
  metrics: BusinessMetrics
): void {
  logger.info('Business metrics', {
    module: 'BusinessMonitor',
    period,
    ...metrics,
  })
}

/**
 * Create OpenTelemetry span context (placeholder for future full OTel integration)
 * @returns Span ID for correlation
 */
export function createSpanContext(operation: string): string {
  const spanId = `span_${Date.now()}_${Math.random().toString(36).substring(7)}`

  logger.debug('Span created', {
    module: 'TracingMonitor',
    spanId,
    operation,
  })

  return spanId
}

/**
 * End OpenTelemetry span (placeholder)
 */
export function endSpan(spanId: string, success: boolean): void {
  logger.debug('Span ended', {
    module: 'TracingMonitor',
    spanId,
    success,
  })
}
