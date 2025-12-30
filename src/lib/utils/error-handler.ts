import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

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

    const errorLabel =
      status >= 500
        ? 'Internal Server Error'
        : status >= 400
          ? 'Client Error'
          : 'Error'

    // Generic error
    return NextResponse.json(
      {
        error: errorLabel,
        message: error.message,
        statusCode: status,
        timestamp,
      },
      { status, headers }
    )
  }

  // Unknown error type
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
