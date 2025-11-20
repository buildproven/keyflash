import type { KeywordData } from '@/types/keyword'

/**
 * Converts keyword data to CSV format and triggers download
 * @param data - Array of keyword data to export
 * @param filename - Name of the CSV file (default: keywords.csv)
 */
export function exportToCSV(
  data: KeywordData[],
  filename: string = 'keywords.csv'
): void {
  // CSV header
  const headers = [
    'Keyword',
    'Search Volume',
    'Difficulty',
    'CPC',
    'Competition',
    'Intent',
  ]

  // Convert data to CSV rows
  const rows = data.map(item => [
    `"${item.keyword.replace(/"/g, '""')}"`, // Escape quotes in keyword
    item.searchVolume.toString(),
    item.difficulty.toString(),
    item.cpc.toFixed(2),
    item.competition,
    item.intent,
  ])

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')

  if (link.download !== undefined) {
    // Feature detection
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}
