/**
 * Structured Logging with Pino
 *
 * Provides JSON-formatted structured logging for production observability.
 * Automatically redacts sensitive fields like passwords, tokens, and emails.
 *
 * Ported from saas-starter-template
 */

import pino from 'pino'

// Determine if we're in development
const isDevelopment = process.env.NODE_ENV === 'development'

// Create logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Pretty print in development, JSON in production
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Formatters
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },

  // Serialize errors properly
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.secret',
      'email',
      'apiKey',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
    ],
    remove: true,
  },

  // Base fields included in all logs
  base: {
    env: process.env.NODE_ENV,
    app: 'keyflash',
  },
})

/**
 * Create a child logger with additional context
 */
export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context)
}

/**
 * Log HTTP request
 */
export function logRequest(req: {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  userId?: string
}) {
  logger.info(
    {
      type: 'http.request',
      method: req.method,
      url: req.url,
      userId: req.userId,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'],
    },
    `${req.method} ${req.url}`
  )
}

/**
 * Log HTTP response
 */
export function logResponse(
  req: { method: string; url: string },
  res: { statusCode: number },
  duration: number
) {
  const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'

  logger[level](
    {
      type: 'http.response',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
    },
    `${req.method} ${req.url} ${res.statusCode} ${duration}ms`
  )
}

/**
 * Log business events
 */
export const events = {
  keywordSearch: (userId: string, keywords: number, source: string) => {
    logger.info(
      {
        type: 'keyword.search',
        userId,
        keywords,
        source,
      },
      `Keyword search: ${keywords} keywords from ${source}`
    )
  },

  keywordExport: (userId: string, format: string, count: number) => {
    logger.info(
      {
        type: 'keyword.export',
        userId,
        format,
        count,
      },
      `Keywords exported: ${count} to ${format}`
    )
  },

  apiCallMade: (provider: string, endpoint: string, duration: number) => {
    logger.info(
      {
        type: 'api.call',
        provider,
        endpoint,
        duration,
      },
      `API call to ${provider}: ${duration}ms`
    )
  },

  cacheHit: (key: string) => {
    logger.debug({ type: 'cache.hit', key }, `Cache hit: ${key}`)
  },

  cacheMiss: (key: string) => {
    logger.debug({ type: 'cache.miss', key }, `Cache miss: ${key}`)
  },
}

/**
 * Log errors with context
 */
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error(
    {
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    },
    error.message
  )
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  duration: number,
  context?: Record<string, unknown>
) {
  logger.info(
    {
      type: 'performance',
      operation,
      duration,
      ...context,
    },
    `${operation} took ${duration}ms`
  )
}

/**
 * Log security events
 */
export const security = {
  rateLimitExceeded: (ip: string, endpoint: string) => {
    logger.warn(
      {
        type: 'security.rate_limit',
        ip,
        endpoint,
      },
      `Rate limit exceeded from ${ip}`
    )
  },

  invalidApiKey: (reason: string) => {
    logger.warn(
      {
        type: 'security.invalid_api_key',
        reason,
      },
      `Invalid API key: ${reason}`
    )
  },

  unauthorizedAccess: (userId: string | undefined, resource: string) => {
    logger.warn(
      {
        type: 'security.unauthorized',
        userId,
        resource,
      },
      `Unauthorized access attempt to ${resource}`
    )
  },
}

export default logger
