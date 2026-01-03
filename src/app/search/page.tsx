'use client'

import Link from 'next/link'
import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { KeywordSearchForm } from '@/components/forms/keyword-search-form'
import { KeywordResultsTable } from '@/components/tables/keyword-results-table'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { Footer } from '@/components/layout/footer'
import { SavedSearchesList } from '@/components/saved-searches/saved-searches-list'
import { SaveSearchModal } from '@/components/saved-searches/save-search-modal'
import { exportToCSV } from '@/lib/utils/csv-export'
import { fetchWithCsrf } from '@/lib/utils/csrf'
import { getErrorMessageFromResponse } from '@/lib/utils/error-messages'
import type {
  KeywordSearchFormData,
  KeywordData,
  KeywordSearchResponse,
} from '@/types/keyword'
import type { SavedSearchParams, SavedSearch } from '@/types/saved-search'

export default function SearchPage() {
  const { isSignedIn } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<KeywordData[]>([])
  const [mockData, setMockData] = useState<boolean>(false)
  const [provider, setProvider] = useState<string | undefined>()
  const [searchLocation, setSearchLocation] = useState<string>('US')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [currentSearchParams, setCurrentSearchParams] =
    useState<SavedSearchParams | null>(null)
  const savedSearchesListRef = useRef<{ refresh: () => void } | null>(null)

  const handleSearch = useCallback(async (formData: KeywordSearchFormData) => {
    setIsLoading(true)
    setError(null)
    setResults([])
    setMockData(false)
    setProvider(undefined)

    try {
      // Parse keywords from input (comma or newline separated)
      const keywords = formData.keywordsInput
        .split(/[,\n]/)
        .map(k => k.trim())
        .filter(k => k.length > 0)

      if (keywords.length === 0) {
        throw new Error('Please enter at least one keyword')
      }

      if (keywords.length > 200) {
        throw new Error('Maximum 200 keywords allowed')
      }

      // Call the API
      const response = await fetchWithCsrf('/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords,
          matchType: formData.matchType,
          location: formData.location,
        }),
      })

      if (!response.ok) {
        const errorMessage = await getErrorMessageFromResponse(response)
        throw new Error(errorMessage)
      }

      const data: KeywordSearchResponse = await response.json()
      setResults(data.data)
      setMockData(data.mockData || false)
      setProvider(data.provider)
      setSearchLocation(formData.location || 'US')

      // Save current search params for potential saving
      setCurrentSearchParams({
        keywords,
        matchType: formData.matchType,
        location: formData.location || 'US',
      })
    } catch (err) {
      // Use error message from API response or fallback to error message
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleExport = useCallback(() => {
    if (results.length > 0) {
      exportToCSV(results, 'keyflash-results.csv')
    }
  }, [results])

  const handleRetry = useCallback(() => {
    setError(null)
  }, [])

  const handleSaveSearch = useCallback(
    async (name: string, description?: string) => {
      if (!currentSearchParams) {
        throw new Error('No search to save')
      }

      const response = await fetchWithCsrf('/api/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          searchParams: currentSearchParams,
          results,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save search')
      }

      // Trigger refresh of saved searches list
      savedSearchesListRef.current?.refresh()
    },
    [currentSearchParams, results]
  )

  const handleLoadSearch = useCallback(async (searchId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/searches/${searchId}`)
      if (!response.ok) {
        const errorMessage = await getErrorMessageFromResponse(response)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const search: SavedSearch = data.search

      // If the search has cached results, use them
      if (search.results && search.results.length > 0) {
        setResults(search.results)
        setMockData(false)
        setProvider(undefined)
        setSearchLocation(search.searchParams.location)
        setCurrentSearchParams(search.searchParams)
      } else {
        // Otherwise, run the search again
        const keywordsResponse = await fetchWithCsrf('/api/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords: search.searchParams.keywords,
            matchType: search.searchParams.matchType,
            location: search.searchParams.location,
          }),
        })

        if (!keywordsResponse.ok) {
          const errorMessage =
            await getErrorMessageFromResponse(keywordsResponse)
          throw new Error(errorMessage)
        }

        const keywordsData: KeywordSearchResponse =
          await keywordsResponse.json()
        setResults(keywordsData.data)
        setMockData(keywordsData.mockData || false)
        setProvider(keywordsData.provider)
        setSearchLocation(search.searchParams.location)
        setCurrentSearchParams(search.searchParams)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load saved search'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <div className="container mx-auto grow px-6 py-12">
        {/* Skip Link for Keyboard Navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-md z-50"
        >
          Skip to main content
        </a>

        <nav className="mb-8" aria-label="Breadcrumb">
          <Link
            href="/"
            className="text-primary-600 hover:text-primary-700 hover:underline"
            aria-label="Go back to home page"
          >
            ← Back to Home
          </Link>
        </nav>

        <main id="main-content" className="mx-auto max-w-6xl">
          <header className="mb-6">
            <h1 className="text-4xl font-bold">Keyword Research</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Research keyword search volume, difficulty, and competition data
            </p>
          </header>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Search Form */}
            <aside
              className="lg:col-span-1 space-y-4"
              aria-label="Keyword search form"
            >
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="sr-only">Search Parameters</h2>
                <KeywordSearchForm
                  onSubmit={handleSearch}
                  isLoading={isLoading}
                />
              </div>

              {/* Saved Searches */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <SavedSearchesList onLoadSearch={handleLoadSearch} />
              </div>
            </aside>

            {/* Results Area */}
            <section className="lg:col-span-2" aria-label="Search results">
              {isLoading && (
                <div
                  role="region"
                  aria-live="polite"
                  aria-label="Loading search results"
                >
                  <LoadingState />
                </div>
              )}

              {error && (
                <div
                  role="region"
                  aria-live="assertive"
                  aria-label="Search error"
                >
                  <ErrorState error={error} onRetry={handleRetry} />
                </div>
              )}

              {!isLoading && !error && results.length > 0 && (
                <div
                  role="region"
                  aria-live="polite"
                  aria-label="Keyword search results"
                >
                  {/* Save Search Button */}
                  {isSignedIn && currentSearchParams && (
                    <div className="mb-4 flex justify-end">
                      <button
                        onClick={() => setShowSaveModal(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                          />
                        </svg>
                        Save Search
                      </button>
                    </div>
                  )}
                  <KeywordResultsTable
                    data={results}
                    onExport={handleExport}
                    mockData={mockData}
                    provider={provider}
                    location={searchLocation}
                  />
                </div>
              )}

              {!isLoading && !error && results.length === 0 && (
                <div
                  className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800"
                  role="region"
                  aria-label="No search results"
                >
                  <svg
                    className="mx-auto h-12 w-12 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                    No results yet
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Enter keywords in the form to get started with your research
                  </p>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
      <Footer />

      {/* Save Search Modal */}
      {currentSearchParams && (
        <SaveSearchModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveSearch}
          searchParams={currentSearchParams}
          results={results}
        />
      )}
    </div>
  )
}
