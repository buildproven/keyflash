/**
 * Get user-friendly error message based on HTTP status code
 * Provides specific, actionable messages instead of generic errors
 */
export function getErrorMessageForStatus(
  status: number | undefined,
  defaultMessage: string = 'An unexpected error occurred'
): string {
  if (!status) {
    return defaultMessage
  }

  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.'

    case 401:
      return 'Please sign in to continue.'

    case 403:
      return 'Access forbidden. You may have reached your usage limit or your trial may have expired.'

    case 404:
      return 'The requested resource was not found.'

    case 408:
      return 'Request timeout. Please try again.'

    case 409:
      return 'Conflict error. The resource may have been modified.'

    case 429:
      return 'Rate limit exceeded. Please wait a moment before trying again.'

    case 500:
      return 'Server error. Our team has been notified. Please try again later.'

    case 502:
      return 'Service temporarily unavailable. Please try again in a few moments.'

    case 503:
      return 'Service is currently under maintenance. Please try again shortly.'

    case 504:
      return 'Request timeout. The service took too long to respond.'

    default:
      // For 4xx errors
      if (status >= 400 && status < 500) {
        return 'Request error. Please check your input and try again.'
      }

      // For 5xx errors
      if (status >= 500) {
        return 'Server error. Please try again later.'
      }

      return defaultMessage
  }
}

/**
 * Extract error message from API response
 * Handles both new (APIError format) and legacy error responses
 */
export async function getErrorMessageFromResponse(
  response: Response
): Promise<string> {
  try {
    const data = await response.json()

    // New APIError format: { error, message, statusCode, timestamp }
    if (data.message && typeof data.message === 'string') {
      return data.message
    }

    // Legacy format: { error: "message" }
    if (data.error && typeof data.error === 'string') {
      return data.error
    }

    // Fallback to status-based message
    return getErrorMessageForStatus(response.status)
  } catch {
    // If response isn't JSON, use status-based message
    return getErrorMessageForStatus(response.status)
  }
}

/**
 * Get user-friendly error message from any error type
 * Handles Error objects, HTTP responses, and unknown errors
 */
export async function getErrorMessage(error: unknown): Promise<string> {
  // HTTP Response
  if (error instanceof Response) {
    return getErrorMessageFromResponse(error)
  }

  // Error with status property (HttpError from error-handler.ts)
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : undefined

    return message || getErrorMessageForStatus(error.status)
  }

  // Standard Error object
  if (error instanceof Error) {
    return error.message
  }

  // Unknown error type
  if (typeof error === 'string') {
    return error
  }

  return 'An unexpected error occurred'
}
