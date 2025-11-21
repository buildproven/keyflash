import type { KeywordData } from '@/types/keyword'

/**
 * Sanitizes a cell value to prevent CSV injection attacks
 * Escapes dangerous characters that could be interpreted as formulas in Excel/Google Sheets
 * @param value - The cell value to sanitize
 * @returns Sanitized value safe for CSV export
 */
function sanitizeCSVCell(value: string): string {
  // Trim whitespace
  let sanitized = value.trim()

  // Check for dangerous characters at the beginning that could trigger formula execution
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r', '\n']
  const startsWithDangerous = dangerousChars.some(char =>
    sanitized.startsWith(char)
  )

  if (startsWithDangerous) {
    // Prefix with single quote to prevent formula execution
    sanitized = `'${sanitized}`
  }

  // Escape double quotes
  sanitized = sanitized.replace(/"/g, '""')

  // Cap length to prevent extremely long cells
  const maxLength = 32767 // Excel's character limit per cell
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + '...'
  }

  return `"${sanitized}"`
}

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

  // Convert data to CSV rows with proper sanitization
  const rows = data.map(item => [
    sanitizeCSVCell(item.keyword), // Sanitize keyword to prevent injection
    item.searchVolume.toString(),
    item.difficulty.toString(),
    item.cpc.toFixed(2),
    sanitizeCSVCell(item.competition), // Sanitize competition level
    sanitizeCSVCell(item.intent), // Sanitize intent classification
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
