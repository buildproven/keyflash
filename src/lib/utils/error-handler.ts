import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Standard API error response format
 */
export interface APIError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

/**
 * Handles errors and returns formatted NextResponse
 * @param error - The error to handle
 * @returns NextResponse with error details
 */
export function handleAPIError(error: unknown): NextResponse<APIError> {
  const timestamp = new Date().toISOString();

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation Error',
        message: error.issues.map((issue) => issue.message).join(', '),
        statusCode: 400,
        timestamp,
      },
      { status: 400 }
    );
  }

  // Standard Error objects
  if (error instanceof Error) {
    // Rate limit errors
    if (error.message.includes('rate limit')) {
      return NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message: error.message,
          statusCode: 429,
          timestamp,
        },
        { status: 429 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message,
        statusCode: 500,
        timestamp,
      },
      { status: 500 }
    );
  }

  // Unknown error type
  return NextResponse.json(
    {
      error: 'Unknown Error',
      message: 'An unexpected error occurred',
      statusCode: 500,
      timestamp,
    },
    { status: 500 }
  );
}

/**
 * Creates a success response with data
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<T> {
  return NextResponse.json(data, { status });
}
