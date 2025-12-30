import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { savedSearchesService } from '@/lib/saved-searches/saved-searches-service'
import { CreateSavedSearchSchema } from '@/lib/validation/schemas'
import { handleAPIError, HttpError } from '@/lib/utils/error-handler'
import { readJsonWithLimit } from '@/lib/utils/request'

export async function GET() {
  try {
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      const error: HttpError = new Error('Authentication required')
      error.status = 401
      return handleAPIError(error)
    }

    if (!savedSearchesService.isAvailable()) {
      const error: HttpError = new Error('Service temporarily unavailable')
      error.status = 503
      return handleAPIError(error)
    }

    const searches = await savedSearchesService.listSavedSearches(userId)

    return NextResponse.json({ searches })
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      const error: HttpError = new Error('Authentication required')
      error.status = 401
      return handleAPIError(error)
    }

    if (!savedSearchesService.isAvailable()) {
      const error: HttpError = new Error('Service temporarily unavailable')
      error.status = 503
      return handleAPIError(error)
    }

    const body = await readJsonWithLimit(request)
    const validated = CreateSavedSearchSchema.parse(body)

    const savedSearch = await savedSearchesService.createSavedSearch(
      userId,
      validated
    )

    if (!savedSearch) {
      const error: HttpError = new Error(
        'Failed to save search. You may have reached the limit of 50 saved searches.'
      )
      error.status = 400
      return handleAPIError(error)
    }

    return NextResponse.json({ search: savedSearch }, { status: 201 })
  } catch (error) {
    return handleAPIError(error)
  }
}
