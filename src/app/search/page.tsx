'use client'

import Link from 'next/link'
import { useState } from 'react'
import { KeywordSearchForm } from '@/components/forms/keyword-search-form'
import { KeywordResultsTable } from '@/components/tables/keyword-results-table'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { exportToCSV } from '@/lib/utils/csv-export'
import type { KeywordSearchFormData, KeywordData } from '@/types/keyword'

export default function SearchPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<KeywordData[]>([])

  const handleSearch = async (formData: KeywordSearchFormData) => {
    setIsLoading(true)
    setError(null)
    setResults([])

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

      const data = await response.json()
      setResults(data.data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = () => {
    if (results.length > 0) {
      exportToCSV(results, 'keyflash-results.csv')
    }
  }

  const handleRetry = () => {
    setError(null)
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-primary-600 hover:text-primary-700 hover:underline"
        >
          ← Back to Home
        </Link>
      </div>

      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-4xl font-bold">Keyword Research</h1>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Search Form */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <KeywordSearchForm
                onSubmit={handleSearch}
                isLoading={isLoading}
              />
            </div>

            {/* Mock Data Notice */}
            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> API is functional with mock data. Real
                keyword provider (Google Ads/DataForSEO) integration coming in
                Phase 4.
              </p>
            </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-2">
            {isLoading && <LoadingState />}

            {error && <ErrorState error={error} onRetry={handleRetry} />}

            {!isLoading && !error && results.length > 0 && (
              <KeywordResultsTable data={results} onExport={handleExport} />
            )}

            {!isLoading && !error && results.length === 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
                  Enter keywords in the form to get started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
