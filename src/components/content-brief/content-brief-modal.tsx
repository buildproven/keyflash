'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchWithCsrf } from '@/lib/utils/csrf'
import type { ContentBrief } from '@/types/content-brief'

interface ContentBriefModalProps {
  keyword: string
  location: string
  isOpen: boolean
  onClose: () => void
}

export function ContentBriefModal({
  keyword,
  location,
  isOpen,
  onClose,
}: ContentBriefModalProps) {
  const [brief, setBrief] = useState<ContentBrief | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap and initial focus
  useEffect(() => {
    if (!isOpen) return

    // Store the element that triggered the modal
    previousActiveElement.current = document.activeElement as HTMLElement

    // Focus close button on open
    closeButtonRef.current?.focus()

    // Trap focus within modal
    const modal = modalRef.current
    if (!modal) return

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTabKey)

    // Cleanup: restore focus and remove event listener
    return () => {
      document.removeEventListener('keydown', handleTabKey)
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen])

  const generateBrief = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetchWithCsrf('/api/content-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, location }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate content brief')
      }

      const data = await response.json()
      setBrief(data.brief)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [keyword, location])

  useEffect(() => {
    if (!isOpen) {
      setBrief(null)
      setIsLoading(false)
      setError(null)
      return
    }

    if (!brief && !isLoading && !error) {
      void generateBrief()
    }
  }, [brief, error, generateBrief, isLoading, isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="brief-title"
    >
      <div
        ref={modalRef}
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2
              id="brief-title"
              className="text-2xl font-bold text-gray-900 dark:text-white"
            >
              Content Brief
            </h2>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              Keyword: <span className="font-medium">{keyword}</span>
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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
          <div
            className="flex flex-col items-center justify-center py-12"
            role="status"
            aria-live="polite"
          >
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              Analyzing top search results...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20"
            role="alert"
            aria-live="polite"
          >
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={generateBrief}
              className="mt-2 text-sm font-medium text-red-700 underline hover:no-underline dark:text-red-400"
            >
              Try again
            </button>
          </div>
        )}

        {/* Brief content */}
        {brief && !isLoading && (
          <div className="space-y-8">
            {/* Mock data warning */}
            {brief.mockData && (
              <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                This is sample data. Configure DataForSEO API for real SERP
                analysis.
              </div>
            )}

            {/* Word Count Recommendation */}
            <section>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Recommended Word Count
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 rounded-lg bg-primary-50 p-4 text-center dark:bg-primary-900/20">
                  <div className="text-3xl font-bold text-primary-700 dark:text-primary-300">
                    {brief.recommendedWordCount.average.toLocaleString()}
                  </div>
                  <div className="text-sm text-primary-600 dark:text-primary-400">
                    words (avg)
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Range: {brief.recommendedWordCount.min.toLocaleString()} -{' '}
                  {brief.recommendedWordCount.max.toLocaleString()} words
                </div>
              </div>
            </section>

            {/* Topics to Cover */}
            <section>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Topics to Cover
              </h3>
              <div className="flex flex-wrap gap-2">
                {brief.topics.map((topic, i) => (
                  <span
                    key={i}
                    className={`rounded-full px-3 py-1 text-sm ${
                      topic.importance === 'high'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : topic.importance === 'medium'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {topic.topic}
                    <span className="ml-1 opacity-60">({topic.frequency})</span>
                  </span>
                ))}
              </div>
            </section>

            {/* Suggested Outline */}
            <section>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Suggested Outline
              </h3>
              <ul className="space-y-2">
                {brief.suggestedHeadings.map((heading, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-3 ${
                      heading.level === 'h2' ? 'font-medium' : 'pl-4 text-sm'
                    }`}
                  >
                    <span className="mt-0.5 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {heading.level.toUpperCase()}
                    </span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {heading.text}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Questions to Answer */}
            <section>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Questions to Answer
              </h3>
              <ul className="space-y-2">
                {brief.questionsToAnswer.map((q, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 text-primary-500">?</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {q.question}
                    </span>
                    {q.source === 'paa' && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        People Also Ask
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* Related Keywords */}
            <section>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Related Keywords to Include
              </h3>
              <div className="flex flex-wrap gap-2">
                {brief.relatedKeywords.map((kw, i) => (
                  <span
                    key={i}
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </section>

            {/* Top Competitors */}
            <section>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Top Ranking Pages
              </h3>
              <div className="space-y-3">
                {brief.serpResults.slice(0, 5).map((result, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        {result.position}
                      </span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                        >
                          {result.title}
                        </a>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {result.domain}
                          {result.wordCount &&
                            ` • ~${result.wordCount.toLocaleString()} words`}
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          {result.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
