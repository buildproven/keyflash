import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { savedSearchesService } from '@/lib/saved-searches/saved-searches-service'
import {
  UpdateSavedSearchSchema,
  SearchIdSchema,
} from '@/lib/validation/schemas'
import {
  handleAPIError,
  createSuccessResponse,
  type HttpError,
} from '@/lib/utils/error-handler'
import { readJsonWithLimit } from '@/lib/utils/request'

// FIX-011: Helper to validate search ID parameter
function validateSearchId(id: string): string {
  const result = SearchIdSchema.safeParse(id)
  if (!result.success) {
    const error: HttpError = new Error('Invalid search ID format')
    error.status = 400
    throw error
  }
  return result.data
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      const error: HttpError = new Error('Authentication required')
      error.status = 401
      return handleAPIError(error)
    }

    const { id } = await params
    const validatedId = validateSearchId(id)

    const search = await savedSearchesService.getSavedSearch(
      userId,
      validatedId
    )

    if (!search) {
      const error: HttpError = new Error('Saved search not found')
      error.status = 404
      return handleAPIError(error)
    }

    // CODE-003: Use standardized success response
    return createSuccessResponse({ search })
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      const error: HttpError = new Error('Authentication required')
      error.status = 401
      return handleAPIError(error)
    }

    const { id } = await params
    const validatedId = validateSearchId(id)

    const body = await readJsonWithLimit(request)
    const validated = UpdateSavedSearchSchema.parse(body)

    const updated = await savedSearchesService.updateSavedSearch(
      userId,
      validatedId,
      validated
    )

    if (!updated) {
      const error: HttpError = new Error('Saved search not found')
      error.status = 404
      return handleAPIError(error)
    }

    // CODE-003: Use standardized success response
    return createSuccessResponse({ search: updated })
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      const error: HttpError = new Error('Authentication required')
      error.status = 401
      return handleAPIError(error)
    }

    const { id } = await params
    const validatedId = validateSearchId(id)

    const deleted = await savedSearchesService.deleteSavedSearch(
      userId,
      validatedId
    )

    if (!deleted) {
      const error: HttpError = new Error('Saved search not found')
      error.status = 404
      return handleAPIError(error)
    }

    // CODE-003: Use standardized success response
    return createSuccessResponse({ success: true })
  } catch (error) {
    return handleAPIError(error)
  }
}
