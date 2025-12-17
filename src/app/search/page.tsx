'use client'

import Link from 'next/link'
import { useState, useCallback } from 'react'
import { KeywordSearchForm } from '@/components/forms/keyword-search-form'
import { KeywordResultsTable } from '@/components/tables/keyword-results-table'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { Footer } from '@/components/layout/footer'
import { exportToCSV } from '@/lib/utils/csv-export'
import type {
  KeywordSearchFormData,
  KeywordData,
  KeywordSearchResponse,
} from '@/types/keyword'

export default function SearchPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<KeywordData[]>([])
  const [mockData, setMockData] = useState<boolean>(false)
  const [provider, setProvider] = useState<string | undefined>()
  const [searchLocation, setSearchLocation] = useState<string>('US')

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
      const response = await fetch('/api/keywords', {
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
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch keyword data')
      }

      const data: KeywordSearchResponse = await response.json()
      setResults(data.data)
      setMockData(data.mockData || false)
      setProvider(data.provider)
      setSearchLocation(formData.location || 'US')
    } catch (err) {
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
            <aside className="lg:col-span-1" aria-label="Keyword search form">
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="sr-only">Search Parameters</h2>
                <KeywordSearchForm
                  onSubmit={handleSearch}
                  isLoading={isLoading}
                />
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
                    className="mx-auto h-12 w-12 text-gray-400"
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
                  <p className="mt-2 text-gray-500 dark:text-gray-400">
                    Enter keywords in the form to get started with your research
                  </p>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
