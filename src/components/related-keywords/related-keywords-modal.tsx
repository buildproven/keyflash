'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RelatedKeyword } from '@/types/related-keywords'

interface RelatedKeywordsModalProps {
  keyword: string
  location: string
  isOpen: boolean
  onClose: () => void
  onAddKeyword?: (keyword: string) => void
}

export function RelatedKeywordsModal({
  keyword,
  location,
  isOpen,
  onClose,
  onAddKeyword,
}: RelatedKeywordsModalProps) {
  const [relatedKeywords, setRelatedKeywords] = useState<RelatedKeyword[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMockData, setIsMockData] = useState(false)

  const fetchRelatedKeywords = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/keywords/related', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, location }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch related keywords')
      }

      const data = await response.json()
      setRelatedKeywords(data.relatedKeywords)
      setIsMockData(data.provider === 'Mock')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [keyword, location])

  useEffect(() => {
    if (!isOpen) {
      setRelatedKeywords([])
      setIsMockData(false)
      setIsLoading(false)
      setError(null)
      return
    }

    if (relatedKeywords.length === 0 && !isLoading && !error) {
      void fetchRelatedKeywords()
    }
  }, [error, fetchRelatedKeywords, isLoading, isOpen, relatedKeywords.length])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="related-title"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2
              id="related-title"
              className="text-2xl font-bold text-gray-900 dark:text-white"
            >
              Related Keywords
            </h2>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Seed: <span className="font-medium">{keyword}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Finding related keywords...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={fetchRelatedKeywords}
              className="mt-2 text-sm font-medium text-red-700 underline hover:no-underline dark:text-red-400"
            >
              Try again
            </button>
          </div>
        )}

        {/* Related keywords list */}
        {relatedKeywords.length > 0 && !isLoading && (
          <div className="space-y-4">
            {/* Mock data warning */}
            {isMockData && (
              <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                This is sample data. Configure DataForSEO API for real keyword
                suggestions.
              </div>
            )}

            {/* Keywords table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      Keyword
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      Volume
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      Relevance
                    </th>
                    {onAddKeyword && (
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {relatedKeywords.map((kw, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {kw.keyword}
                        </div>
                        {kw.competition && (
                          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                                kw.competition === 'low'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : kw.competition === 'medium'
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}
                            >
                              {kw.competition}
                            </span>
                            {kw.cpc !== undefined && (
                              <span className="ml-2">
                                ${kw.cpc.toFixed(2)} CPC
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                        {kw.searchVolume.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className="h-2 rounded-full bg-primary-500"
                              style={{ width: `${kw.relevance}%` }}
                            />
                          </div>
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            {kw.relevance}%
                          </span>
                        </div>
                      </td>
                      {onAddKeyword && (
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          <button
                            onClick={() => onAddKeyword(kw.keyword)}
                            className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                          >
                            + Add
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Found {relatedKeywords.length} related keywords
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
