import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  ServiceUnavailableError,
  ServiceOperationError,
} from '@/lib/saved-searches/saved-searches-service'
import {
  UserServiceUnavailableError,
  UserServiceOperationError,
} from '@/lib/user/user-service'

/**
 * Standard API error response format
 */
export interface APIError {
  error: string
  message: string
  statusCode: number
  timestamp: string
}

/**
 * Error type with optional status and headers for API responses
 */
export type HttpError = Error & {
  status?: number
  headers?: Record<string, string>
}

/**
 * Handles errors and returns formatted NextResponse
 * @param error - The error to handle
 * @returns NextResponse with error details
 */
export function handleAPIError(error: unknown): NextResponse<APIError> {
  const timestamp = new Date().toISOString()
  let status = 500
  const headers = new Headers()
  type ErrorWithMeta = Error & {
    status?: number
    headers?: Record<string, string>
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    status = 400
    // FIX-018: Log validation errors for debugging
    logger.warn('Validation error', {
      module: 'APIErrorHandler',
      issues: error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    })
    return NextResponse.json(
      {
        error: 'Validation Error',
        message: error.issues.map(issue => issue.message).join(', '),
        statusCode: status,
        timestamp,
      },
      { status, headers }
    )
  }

  // FIX-008: Service unavailable errors (Redis down, etc.)
  if (
    error instanceof ServiceUnavailableError ||
    error instanceof UserServiceUnavailableError
  ) {
    logger.error('Service unavailable', error, { module: 'APIErrorHandler' })
    return NextResponse.json(
      {
        error: 'Service Unavailable',
        message: 'Service temporarily unavailable. Please try again later.',
        statusCode: 503,
        timestamp,
      },
      { status: 503, headers }
    )
  }

  // FIX-008: Service operation errors (Redis operation failed)
  if (
    error instanceof ServiceOperationError ||
    error instanceof UserServiceOperationError
  ) {
    const operation =
      error instanceof ServiceOperationError ? error.operation : error.operation
    logger.error('Service operation failed', error, {
      module: 'APIErrorHandler',
      operation,
    })
    return NextResponse.json(
      {
        error: 'Service Error',
        message: 'Service temporarily unavailable. Please try again later.',
        statusCode: 503,
        timestamp,
      },
      { status: 503, headers }
    )
  }

  // Standard Error objects
  if (error instanceof Error) {
    const meta = error as ErrorWithMeta
    const maybeStatus = meta.status
    if (typeof maybeStatus === 'number') {
      status = maybeStatus
    }

    const maybeHeaders = meta.headers
    if (maybeHeaders && typeof maybeHeaders === 'object') {
      Object.entries(maybeHeaders).forEach(([key, value]) => {
        if (typeof value === 'string') headers.set(key, value)
      })
    }

    // Rate limit errors
    if (error.message.toLowerCase().includes('rate limit')) {
      const statusCode = status === 500 ? 429 : status
      return NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message: error.message,
          statusCode: statusCode,
          timestamp,
        },
        { status: statusCode, headers }
      )
    }

    const isServerError = status >= 500
    const errorLabel = isServerError
      ? 'Internal Server Error'
      : status >= 400
        ? 'Client Error'
        : 'Error'
    const message = isServerError
      ? 'An unexpected error occurred'
      : error.message

    // FIX-018: Log all errors for operational visibility
    if (isServerError) {
      logger.error('API server error', error, {
        module: 'APIErrorHandler',
        status,
      })
    } else if (status >= 400) {
      logger.warn('API client error', {
        module: 'APIErrorHandler',
        status,
        message: error.message,
      })
    }

    // Generic error
    return NextResponse.json(
      {
        error: errorLabel,
        message,
        statusCode: status,
        timestamp,
      },
      { status, headers }
    )
  }

  // Unknown error type
  // FIX-018: Log unknown error types
  logger.error('Unknown API error type', error, { module: 'APIErrorHandler' })
  return NextResponse.json(
    {
      error: 'Unknown Error',
      message: 'An unexpected error occurred',
      statusCode: 500,
      timestamp,
    },
    { status: 500, headers }
  )
}

/**
 * Creates a success response with data
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<T> {
  return NextResponse.json(data, { status })
}
