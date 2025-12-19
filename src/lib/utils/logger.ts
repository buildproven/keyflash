/**
 * Logger Utility
 *
 * Centralized logging for operational information, warnings, and errors.
 * In production, these could be routed to a logging service like Sentry or LogDNA.
 */

interface LogContext {
  module?: string
  [key: string]: unknown
}

/**
 * Structured logger for operational logging
 */
class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isTest =
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT === true

  /**
   * Log informational messages (startup, configuration, cache hits/misses)
   */
  info(message: string, context?: LogContext): void {
    if (this.isTest) return

    const prefix = context?.module ? `[${context.module}]` : ''
    console.info(`${prefix} ${message}`)
  }

  /**
   * Log warning messages (non-critical issues, fallbacks)
   */
  warn(message: string, context?: LogContext): void {
    if (this.isTest) return

    const prefix = context?.module ? `[${context.module}]` : ''
    console.warn(`${prefix} ${message}`)
  }

  /**
   * Log error messages (failures, exceptions)
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.isTest) return

    const prefix = context?.module ? `[${context.module}]` : ''
    console.error(`${prefix} ${message}`, error || '')
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isTest || !this.isDevelopment) return

    const prefix = context?.module ? `[${context.module}]` : ''
    console.debug(`${prefix} ${message}`)
  }
}

export const logger = new Logger()
