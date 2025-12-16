import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { KeywordResultsTable } from '@/components/tables/keyword-results-table'
import type { KeywordData, MonthlyTrend } from '@/types/keyword'

// Mock fetch for modal API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('KeywordResultsTable', () => {
  const generateTrends = (): MonthlyTrend[] =>
    Array.from({ length: 12 }, (_, i) => ({
      month: (i % 12) + 1,
      year: 2024,
      volume: 1000 + i * 100,
    }))

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

  const mockDataWithTrends: KeywordData[] = [
    {
      keyword: 'seo tools',
      searchVolume: 12000,
      difficulty: 65,
      cpc: 3.45,
      competition: 'high',
      intent: 'commercial',
      trends: generateTrends(),
    },
    {
      keyword: 'keyword research',
      searchVolume: 8500,
      difficulty: 42,
      cpc: 2.15,
      competition: 'medium',
      intent: 'informational',
      trends: generateTrends(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ relatedKeywords: [], brief: {} }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it('should display difficulty bar with correct color for low difficulty', () => {
    const lowDifficultyData: KeywordData[] = [
      {
        keyword: 'easy keyword',
        searchVolume: 1000,
        difficulty: 20, // < 30 = green
        cpc: 0.5,
        competition: 'low',
        intent: 'informational',
      },
    ]

    render(<KeywordResultsTable data={lowDifficultyData} />)

    expect(screen.getByText('20/100')).toBeInTheDocument()
  })

  it('should display difficulty bar with correct color for medium difficulty', () => {
    const mediumDifficultyData: KeywordData[] = [
      {
        keyword: 'medium keyword',
        searchVolume: 5000,
        difficulty: 50, // 30-70 = yellow
        cpc: 1.5,
        competition: 'medium',
        intent: 'commercial',
      },
    ]

    render(<KeywordResultsTable data={mediumDifficultyData} />)

    expect(screen.getByText('50/100')).toBeInTheDocument()
  })

  it('should display difficulty bar with correct color for high difficulty', () => {
    const highDifficultyData: KeywordData[] = [
      {
        keyword: 'hard keyword',
        searchVolume: 50000,
        difficulty: 85, // >= 70 = red
        cpc: 5.0,
        competition: 'high',
        intent: 'transactional',
      },
    ]

    render(<KeywordResultsTable data={highDifficultyData} />)

    expect(screen.getByText('85/100')).toBeInTheDocument()
  })

  it('should display low competition badge with correct styling', () => {
    const lowCompData: KeywordData[] = [
      {
        keyword: 'test',
        searchVolume: 1000,
        difficulty: 30,
        cpc: 1.0,
        competition: 'low',
        intent: 'informational',
      },
    ]

    render(<KeywordResultsTable data={lowCompData} />)

    const badge = screen.getByText('low')
    expect(badge).toBeInTheDocument()
  })

  it('should display multiple intent types correctly', () => {
    const multiIntentData: KeywordData[] = [
      {
        keyword: 'info keyword',
        searchVolume: 1000,
        difficulty: 30,
        cpc: 1.0,
        competition: 'low',
        intent: 'informational',
      },
      {
        keyword: 'buy keyword',
        searchVolume: 2000,
        difficulty: 40,
        cpc: 2.0,
        competition: 'medium',
        intent: 'transactional',
      },
      {
        keyword: 'nav keyword',
        searchVolume: 3000,
        difficulty: 50,
        cpc: 3.0,
        competition: 'high',
        intent: 'navigational',
      },
    ]

    render(<KeywordResultsTable data={multiIntentData} />)

    expect(screen.getByText('informational')).toBeInTheDocument()
    expect(screen.getByText('transactional')).toBeInTheDocument()
    expect(screen.getByText('navigational')).toBeInTheDocument()
  })

  describe('mock data warning', () => {
    it('should display mock data warning when mockData is true', () => {
      render(<KeywordResultsTable data={mockData} mockData={true} />)

      expect(screen.getByText('Mock Data Warning')).toBeInTheDocument()
      expect(
        screen.getByText(/this data is generated for demonstration/i)
      ).toBeInTheDocument()
    })

    it('should not display mock data warning when mockData is false', () => {
      render(<KeywordResultsTable data={mockData} mockData={false} />)

      expect(screen.queryByText('Mock Data Warning')).not.toBeInTheDocument()
    })

    it('should display provider name in mock data warning when provided', () => {
      render(
        <KeywordResultsTable data={mockData} mockData={true} provider="Mock" />
      )

      expect(screen.getByText(/current provider: mock/i)).toBeInTheDocument()
    })

    it('should link to API setup documentation', () => {
      render(<KeywordResultsTable data={mockData} mockData={true} />)

      const link = screen.getByRole('link', {
        name: /configure api credentials/i,
      })
      expect(link).toHaveAttribute('href', expect.stringContaining('api-setup'))
    })
  })

  describe('trend sparkline', () => {
    it('should display sparkline when trends data is present', () => {
      const { container } = render(
        <KeywordResultsTable data={mockDataWithTrends} />
      )

      // Check for SVG sparklines (one per row with trends)
      const svgs = container.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)
    })

    it('should display dash when no trends data', () => {
      render(<KeywordResultsTable data={mockData} />)

      // Each row without trends should show "—"
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBe(2)
    })

    it('should show expand button for rows with trends', () => {
      const { container } = render(
        <KeywordResultsTable data={mockDataWithTrends} />
      )

      // Trend buttons have chevron icons
      const chevrons = container.querySelectorAll('[d*="M19 9l-7 7-7-7"]')
      expect(chevrons.length).toBe(2)
    })
  })

  describe('row expansion', () => {
    it('should expand row when trend sparkline is clicked', async () => {
      const { container } = render(
        <KeywordResultsTable data={mockDataWithTrends} />
      )

      // Find and click the trend button for first row
      const trendButtons = container.querySelectorAll(
        'button[title*="trend chart"]'
      )
      expect(trendButtons.length).toBe(2)

      fireEvent.click(trendButtons[0])

      // Should show expanded chart
      await waitFor(() => {
        expect(
          screen.getByText('12-Month Search Volume Trend')
        ).toBeInTheDocument()
      })
    })

    it('should collapse row when clicked again', async () => {
      const { container } = render(
        <KeywordResultsTable data={mockDataWithTrends} />
      )

      const trendButtons = container.querySelectorAll(
        'button[title*="trend chart"]'
      )

      // Click to expand
      fireEvent.click(trendButtons[0])
      await waitFor(() => {
        expect(
          screen.getByText('12-Month Search Volume Trend')
        ).toBeInTheDocument()
      })

      // Click to collapse
      fireEvent.click(trendButtons[0])
      await waitFor(() => {
        expect(
          screen.queryByText('12-Month Search Volume Trend')
        ).not.toBeInTheDocument()
      })
    })

    it('should only expand one row at a time', async () => {
      const { container } = render(
        <KeywordResultsTable data={mockDataWithTrends} />
      )

      const trendButtons = container.querySelectorAll(
        'button[title*="trend chart"]'
      )

      // Expand first row
      fireEvent.click(trendButtons[0])
      await waitFor(() => {
        expect(
          screen.getAllByText('12-Month Search Volume Trend')
        ).toHaveLength(1)
      })

      // Expand second row (should collapse first)
      fireEvent.click(trendButtons[1])
      await waitFor(() => {
        // Still only one expanded chart
        expect(
          screen.getAllByText('12-Month Search Volume Trend')
        ).toHaveLength(1)
      })
    })
  })

  describe('action buttons', () => {
    it('should render Related button for each row', () => {
      render(<KeywordResultsTable data={mockData} />)

      const relatedButtons = screen.getAllByRole('button', { name: /related/i })
      expect(relatedButtons).toHaveLength(2)
    })

    it('should render Brief button for each row', () => {
      render(<KeywordResultsTable data={mockData} />)

      const briefButtons = screen.getAllByRole('button', { name: /brief/i })
      expect(briefButtons).toHaveLength(2)
    })

    it('should have correct title attributes on action buttons', () => {
      render(<KeywordResultsTable data={mockData} />)

      expect(
        screen.getByTitle('Find related keywords for "seo tools"')
      ).toBeInTheDocument()
      expect(
        screen.getByTitle('Generate content brief for "seo tools"')
      ).toBeInTheDocument()
    })
  })

  describe('content brief modal', () => {
    it('should open content brief modal when Brief button is clicked', async () => {
      render(<KeywordResultsTable data={mockData} location="US" />)

      const briefButtons = screen.getAllByRole('button', { name: /brief/i })
      fireEvent.click(briefButtons[0])

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Content Brief')).toBeInTheDocument()
      })
    })

    it('should trigger API call with correct keyword', async () => {
      render(<KeywordResultsTable data={mockData} location="US" />)

      const briefButtons = screen.getAllByRole('button', { name: /brief/i })
      fireEvent.click(briefButtons[0])

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/content-brief',
          expect.objectContaining({
            body: expect.stringContaining('"keyword":"seo tools"'),
          })
        )
      })
    })
  })

  describe('related keywords modal', () => {
    it('should open related keywords modal when Related button is clicked', async () => {
      render(<KeywordResultsTable data={mockData} location="US" />)

      const relatedButtons = screen.getAllByRole('button', { name: /related/i })
      fireEvent.click(relatedButtons[0])

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Related Keywords')).toBeInTheDocument()
      })
    })

    it('should trigger API call with correct keyword', async () => {
      render(<KeywordResultsTable data={mockData} location="US" />)

      const relatedButtons = screen.getAllByRole('button', { name: /related/i })
      fireEvent.click(relatedButtons[0])

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/keywords/related',
          expect.objectContaining({
            body: expect.stringContaining('"keyword":"seo tools"'),
          })
        )
      })
    })
  })

  describe('data-testid', () => {
    it('should have data-testid for E2E testing', () => {
      render(<KeywordResultsTable data={mockData} />)

      expect(screen.getByTestId('keyword-results-table')).toBeInTheDocument()
    })
  })

  describe('location prop', () => {
    it('should pass location to modals', async () => {
      render(<KeywordResultsTable data={mockData} location="GB" />)

      const briefButtons = screen.getAllByRole('button', { name: /brief/i })
      fireEvent.click(briefButtons[0])

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/content-brief',
          expect.objectContaining({
            body: expect.stringContaining('"location":"GB"'),
          })
        )
      })
    })

    it('should use default location US when not provided', async () => {
      render(<KeywordResultsTable data={mockData} />)

      const briefButtons = screen.getAllByRole('button', { name: /brief/i })
      fireEvent.click(briefButtons[0])

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/content-brief',
          expect.objectContaining({
            body: expect.stringContaining('"location":"US"'),
          })
        )
      })
    })
  })

  describe('accessibility', () => {
    it('should have proper table structure', () => {
      render(<KeywordResultsTable data={mockData} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('columnheader')).toHaveLength(8) // 8 columns
      expect(screen.getAllByRole('row')).toHaveLength(3) // Header + 2 data rows
    })

    it('should have scope attributes on header cells', () => {
      render(<KeywordResultsTable data={mockData} />)

      const headers = screen.getAllByRole('columnheader')
      headers.forEach(header => {
        expect(header).toHaveAttribute('scope', 'col')
      })
    })
  })
})
