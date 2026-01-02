'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import type { SavedSearchSummary } from '@/types/saved-search'

interface SavedSearchesListProps {
  onLoadSearch: (searchId: string) => void
}

export function SavedSearchesList({ onLoadSearch }: SavedSearchesListProps) {
  const { isSignedIn } = useAuth()
  const [searches, setSearches] = useState<SavedSearchSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchSearches = useCallback(async () => {
    if (!isSignedIn) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/searches')
      if (!response.ok) {
        throw new Error('Failed to load saved searches')
      }
      const data = await response.json()
      setSearches(data.searches)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load searches')
    } finally {
      setIsLoading(false)
    }
  }, [isSignedIn])

  useEffect(() => {
    fetchSearches()
  }, [fetchSearches])

  const handleDelete = useCallback(
    async (searchId: string, searchName: string) => {
      if (!confirm(`Are you sure you want to delete "${searchName}"?`)) {
        return
      }

      setDeletingId(searchId)

      try {
        const response = await fetch(`/api/searches/${searchId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error('Failed to delete search')
        }

        setSearches(prev => prev.filter(s => s.id !== searchId))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete search')
      } finally {
        setDeletingId(null)
      }
    },
    []
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Sign in to save and access your searches
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        <button
          onClick={fetchSearches}
          className="mt-2 text-sm font-medium text-red-700 underline hover:no-underline dark:text-red-400"
        >
          Try again
        </button>
      </div>
    )
  }

  if (searches.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800/50">
        <svg
          className="mx-auto h-8 w-8 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          No saved searches yet
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Run a search and click &quot;Save&quot; to save it
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Saved Searches ({searches.length})
      </h3>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {searches.map(search => (
          <div
            key={search.id}
            className="group rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-primary-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-600"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => onLoadSearch(search.id)}
                className="flex-1 text-left"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {search.name}
                </div>
                {search.description && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                    {search.description}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{search.keywordCount} keywords</span>
                  <span>•</span>
                  <span>{search.location}</span>
                  <span>•</span>
                  <span>{formatDate(search.metadata.updatedAt)}</span>
                </div>
              </button>
              <button
                onClick={() => handleDelete(search.id, search.name)}
                disabled={deletingId === search.id}
                className="rounded p-1 text-gray-600 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                title="Delete search"
                aria-label={`Delete "${search.name}"`}
              >
                {deletingId === search.id ? (
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
