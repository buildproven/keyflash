'use client'

import React, { memo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { KeywordData } from '@/types/keyword'
import {
  TrendSparkline,
  TrendChartExpanded,
} from '@/components/trends/trend-sparkline'

// Dynamic imports for modals to reduce initial bundle size
const ContentBriefModal = dynamic(
  () =>
    import('@/components/content-brief/content-brief-modal').then(
      mod => mod.ContentBriefModal
    ),
  { ssr: false }
)

const RelatedKeywordsModal = dynamic(
  () =>
    import('@/components/related-keywords/related-keywords-modal').then(
      mod => mod.RelatedKeywordsModal
    ),
  { ssr: false }
)

interface KeywordResultsTableProps {
  data: KeywordData[]
  onExport?: () => void
  mockData?: boolean
  provider?: string
  location?: string
}

export const KeywordResultsTable = memo(function KeywordResultsTable({
  data,
  onExport,
  mockData = false,
  provider,
  location = 'US',
}: KeywordResultsTableProps) {
  const [briefKeyword, setBriefKeyword] = useState<string | null>(null)
  const [relatedKeyword, setRelatedKeyword] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const toggleRowExpansion = (keyword: string) => {
    setExpandedRow(prev => (prev === keyword ? null : keyword))
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-300">No results found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="keyword-results-table">
      {/* Mock Data Banner */}
      {mockData && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-orange-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Mock Data Warning
              </h3>
              <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                This data is generated for demonstration purposes only. To get
                real keyword metrics,{' '}
                <a
                  href="https://github.com/brettstark73/keyflash#api-setup"
                  className="underline hover:text-orange-600 dark:hover:text-orange-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  configure API credentials
                </a>
                .
              </p>
              {provider && (
                <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                  Current provider: {provider}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header with Export Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Results ({data.length} keywords)
        </h2>
        {onExport && (
          <button
            onClick={onExport}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Export to CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <caption className="sr-only">
            Keyword research results showing {data.length} keywords with metrics
            including search volume, difficulty, CPC, competition, intent, and
            trends
          </caption>
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Keyword
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Search Volume
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Difficulty
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                CPC
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Competition
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Intent
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Trend
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {data.map((row, index) => (
              <React.Fragment key={`${row.keyword}-${index}`}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {row.keyword}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    {row.searchVolume.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    <div className="flex items-center">
                      <span className="sr-only">
                        Difficulty: {row.difficulty}/100 -{' '}
                        {row.difficulty < 30
                          ? 'Easy'
                          : row.difficulty < 70
                            ? 'Medium'
                            : 'Hard'}
                      </span>
                      <div className="mr-2 h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className={`h-2 rounded-full ${
                            row.difficulty < 30
                              ? 'bg-green-500'
                              : row.difficulty < 70
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${row.difficulty}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <span aria-hidden="true">{row.difficulty}/100</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    ${row.cpc.toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold leading-5 ${
                        row.competition === 'low'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : row.competition === 'medium'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {row.competition}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    {row.intent}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    {row.trends && row.trends.length >= 2 ? (
                      <button
                        onClick={() => toggleRowExpansion(row.keyword)}
                        className="group flex items-center gap-1 rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        aria-label={`View detailed trend chart for ${row.keyword}`}
                        aria-expanded={expandedRow === row.keyword}
                        title="Click to view detailed trend chart"
                      >
                        <TrendSparkline trends={row.trends} />
                        <svg
                          className={`h-4 w-4 text-gray-600 transition-transform group-hover:text-gray-600 dark:group-hover:text-gray-300 ${
                            expandedRow === row.keyword ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setRelatedKeyword(row.keyword)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                        title={`Find related keywords for "${row.keyword}"`}
                        aria-label={`Find related keywords for ${row.keyword}`}
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
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          />
                        </svg>
                        Related
                      </button>
                      <button
                        onClick={() => setBriefKeyword(row.keyword)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600"
                        title={`Generate content brief for "${row.keyword}"`}
                        aria-label={`Generate content brief for ${row.keyword}`}
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
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Brief
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Expanded trend chart row */}
                {expandedRow === row.keyword && row.trends && (
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={8} className="px-6 py-4">
                      <TrendChartExpanded trends={row.trends} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Content Brief Modal */}
      {briefKeyword && (
        <ContentBriefModal
          keyword={briefKeyword}
          location={location}
          isOpen={!!briefKeyword}
          onClose={() => setBriefKeyword(null)}
        />
      )}

      {/* Related Keywords Modal */}
      {relatedKeyword && (
        <RelatedKeywordsModal
          keyword={relatedKeyword}
          location={location}
          isOpen={!!relatedKeyword}
          onClose={() => setRelatedKeyword(null)}
        />
      )}
    </div>
  )
})
