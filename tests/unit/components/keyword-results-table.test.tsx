import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { KeywordResultsTable } from '@/components/tables/keyword-results-table'
import type { KeywordData } from '@/types/keyword'

describe('KeywordResultsTable', () => {
  const mockData: KeywordData[] = [
    {
      keyword: 'seo tools',
      searchVolume: 12000,
      difficulty: 65,
      cpc: 3.45,
      competition: 'high',
      intent: 'commercial',
    },
    {
      keyword: 'keyword research',
      searchVolume: 8500,
      difficulty: 42,
      cpc: 2.15,
      competition: 'medium',
      intent: 'informational',
    },
  ]

  it('should render table with data', () => {
    render(<KeywordResultsTable data={mockData} />)

    expect(screen.getByText('seo tools')).toBeInTheDocument()
    expect(screen.getByText('keyword research')).toBeInTheDocument()
    expect(screen.getByText('12,000')).toBeInTheDocument()
    expect(screen.getByText('8,500')).toBeInTheDocument()
  })

  it('should display formatted numbers', () => {
    render(<KeywordResultsTable data={mockData} />)

    // Search volume with commas
    expect(screen.getByText('12,000')).toBeInTheDocument()
    // CPC with 2 decimals
    expect(screen.getByText('$3.45')).toBeInTheDocument()
    expect(screen.getByText('$2.15')).toBeInTheDocument()
  })

  it('should show difficulty scores', () => {
    render(<KeywordResultsTable data={mockData} />)

    expect(screen.getByText('65/100')).toBeInTheDocument()
    expect(screen.getByText('42/100')).toBeInTheDocument()
  })

  it('should display competition badges', () => {
    render(<KeywordResultsTable data={mockData} />)

    const highBadge = screen.getByText('high')
    const mediumBadge = screen.getByText('medium')

    expect(highBadge).toBeInTheDocument()
    expect(mediumBadge).toBeInTheDocument()
  })

  it('should display intent types', () => {
    render(<KeywordResultsTable data={mockData} />)

    expect(screen.getByText('commercial')).toBeInTheDocument()
    expect(screen.getByText('informational')).toBeInTheDocument()
  })

  it('should show result count', () => {
    render(<KeywordResultsTable data={mockData} />)

    expect(screen.getByText(/results \(2 keywords\)/i)).toBeInTheDocument()
  })

  it('should render export button when onExport provided', () => {
    const onExport = vi.fn()
    render(<KeywordResultsTable data={mockData} onExport={onExport} />)

    expect(
      screen.getByRole('button', { name: /export to csv/i })
    ).toBeInTheDocument()
  })

  it('should call onExport when export button clicked', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(<KeywordResultsTable data={mockData} onExport={onExport} />)

    await user.click(screen.getByRole('button', { name: /export to csv/i }))

    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it('should not render export button when onExport not provided', () => {
    render(<KeywordResultsTable data={mockData} />)

    expect(
      screen.queryByRole('button', { name: /export to csv/i })
    ).not.toBeInTheDocument()
  })

  it('should show empty state when no data', () => {
    render(<KeywordResultsTable data={[]} />)

    expect(screen.getByText(/no results found/i)).toBeInTheDocument()
  })

  it('should render all table headers', () => {
    render(<KeywordResultsTable data={mockData} />)

    expect(screen.getByText('Keyword')).toBeInTheDocument()
    expect(screen.getByText('Search Volume')).toBeInTheDocument()
    expect(screen.getByText('Difficulty')).toBeInTheDocument()
    expect(screen.getByText('CPC')).toBeInTheDocument()
    expect(screen.getByText('Competition')).toBeInTheDocument()
    expect(screen.getByText('Intent')).toBeInTheDocument()
  })
})
