import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { savedSearchesService } from '@/lib/saved-searches/saved-searches-service'
import { UpdateSavedSearchSchema } from '@/lib/validation/schemas'
import { handleAPIError, HttpError } from '@/lib/utils/error-handler'
import { readJsonWithLimit } from '@/lib/utils/request'

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

    if (!savedSearchesService.isAvailable()) {
      const error: HttpError = new Error('Service temporarily unavailable')
      error.status = 503
      return handleAPIError(error)
    }

    const search = await savedSearchesService.getSavedSearch(userId, id)

    if (!search) {
      const error: HttpError = new Error('Saved search not found')
      error.status = 404
      return handleAPIError(error)
    }

    return NextResponse.json({ search })
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

    if (!savedSearchesService.isAvailable()) {
      const error: HttpError = new Error('Service temporarily unavailable')
      error.status = 503
      return handleAPIError(error)
    }

    const body = await readJsonWithLimit(request)
    const validated = UpdateSavedSearchSchema.parse(body)

    const updated = await savedSearchesService.updateSavedSearch(
      userId,
      id,
      validated
    )

    if (!updated) {
      const error: HttpError = new Error('Saved search not found')
      error.status = 404
      return handleAPIError(error)
    }

    return NextResponse.json({ search: updated })
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

    if (!savedSearchesService.isAvailable()) {
      const error: HttpError = new Error('Service temporarily unavailable')
      error.status = 503
      return handleAPIError(error)
    }

    const deleted = await savedSearchesService.deleteSavedSearch(userId, id)

    if (!deleted) {
      const error: HttpError = new Error('Saved search not found')
      error.status = 404
      return handleAPIError(error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAPIError(error)
  }
}
