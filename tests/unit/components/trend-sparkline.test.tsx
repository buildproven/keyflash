import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  TrendSparkline,
  TrendChartExpanded,
} from '@/components/trends/trend-sparkline'
import type { MonthlyTrend } from '@/types/keyword'

describe('TrendSparkline', () => {
  const generateTrends = (
    volumes: number[],
    startMonth = 1,
    startYear = 2024
  ): MonthlyTrend[] => {
    return volumes.map((volume, i) => ({
      month: ((startMonth + i - 1) % 12) + 1,
      year: startYear + Math.floor((startMonth + i - 1) / 12),
      volume,
    }))
  }

  describe('rendering with no data', () => {
    it('renders placeholder when trends is undefined', () => {
      render(<TrendSparkline />)

      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('renders placeholder when trends is empty array', () => {
      render(<TrendSparkline trends={[]} />)

      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('renders placeholder when trends has only 1 data point', () => {
      const trends = generateTrends([1000])
      render(<TrendSparkline trends={trends} />)

      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('rendering with data', () => {
    it('renders SVG with path when valid data provided', () => {
      const trends = generateTrends([1000, 1200, 1100, 1300])
      const { container } = render(<TrendSparkline trends={trends} />)

      const svg = container.querySelector('svg')
      const path = container.querySelector('path')

      expect(svg).toBeInTheDocument()
      expect(path).toBeInTheDocument()
      expect(path).toHaveAttribute('d')
    })

    it('uses default width and height', () => {
      const trends = generateTrends([1000, 1200])
      const { container } = render(<TrendSparkline trends={trends} />)

      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('width', '100')
      expect(svg).toHaveAttribute('height', '24')
    })

    it('uses custom width and height when provided', () => {
      const trends = generateTrends([1000, 1200])
      const { container } = render(
        <TrendSparkline trends={trends} width={150} height={32} />
      )

      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('width', '150')
      expect(svg).toHaveAttribute('height', '32')
    })

    it('applies custom className', () => {
      const trends = generateTrends([1000, 1200])
      const { container } = render(
        <TrendSparkline trends={trends} className="custom-class" />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom-class')
    })

    it('has accessible aria-label', () => {
      const trends = generateTrends([1000, 1200])
      const { container } = render(<TrendSparkline trends={trends} />)

      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('aria-label')
    })
  })

  describe('trend direction', () => {
    it('shows up trend (↑) when volume increased >10%', () => {
      // First 3 months: 1000, Last 3 months: 2000 (100% increase)
      const trends = generateTrends([
        1000, 1000, 1000, 1200, 1400, 1600, 1800, 2000, 2000, 2000, 2000, 2000,
      ])
      render(<TrendSparkline trends={trends} />)

      expect(screen.getByText('↑')).toBeInTheDocument()
    })

    it('shows down trend (↓) when volume decreased >10%', () => {
      // First 3 months: 2000, Last 3 months: 1000 (-50% decrease)
      const trends = generateTrends([
        2000, 2000, 2000, 1800, 1600, 1400, 1200, 1000, 1000, 1000, 1000, 1000,
      ])
      render(<TrendSparkline trends={trends} />)

      expect(screen.getByText('↓')).toBeInTheDocument()
    })

    it('shows flat trend (→) when volume change is <10%', () => {
      // First 3 months: 1000, Last 3 months: 1050 (5% increase)
      const trends = generateTrends([
        1000, 1000, 1000, 1010, 1020, 1030, 1040, 1050, 1050, 1050, 1050, 1050,
      ])
      render(<TrendSparkline trends={trends} />)

      expect(screen.getByText('→')).toBeInTheDocument()
    })
  })

  describe('trend colors', () => {
    it('applies green color for upward trend', () => {
      const trends = generateTrends([
        1000, 1000, 1000, 1500, 1800, 2000, 2200, 2500, 2500, 2500, 2500, 2500,
      ])
      const { container } = render(<TrendSparkline trends={trends} />)

      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('text-green-500')
    })

    it('applies red color for downward trend', () => {
      const trends = generateTrends([
        2500, 2500, 2500, 2000, 1800, 1500, 1200, 1000, 1000, 1000, 1000, 1000,
      ])
      const { container } = render(<TrendSparkline trends={trends} />)

      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('text-red-500')
    })

    it('applies gray color for flat trend', () => {
      const trends = generateTrends([
        1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000,
      ])
      const { container } = render(<TrendSparkline trends={trends} />)

      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('text-gray-400')
    })
  })

  describe('SVG path generation', () => {
    it('generates valid path with M and L commands', () => {
      const trends = generateTrends([1000, 1200, 1100, 1300])
      const { container } = render(<TrendSparkline trends={trends} />)

      const path = container.querySelector('path')
      const d = path?.getAttribute('d')

      expect(d).toMatch(/^M\s/)
      expect(d).toMatch(/L\s/)
    })

    it('handles flat data (all same values)', () => {
      const trends = generateTrends([1000, 1000, 1000, 1000])
      const { container } = render(<TrendSparkline trends={trends} />)

      const path = container.querySelector('path')
      expect(path).toBeInTheDocument()
      expect(path?.getAttribute('d')).not.toBe('')
    })

    it('handles data with zero values', () => {
      const trends = generateTrends([0, 100, 50, 0])
      const { container } = render(<TrendSparkline trends={trends} />)

      const path = container.querySelector('path')
      expect(path).toBeInTheDocument()
    })
  })
})

describe('TrendChartExpanded', () => {
  const generateTrends = (
    volumes: number[],
    startMonth = 1,
    startYear = 2024
  ): MonthlyTrend[] => {
    return volumes.map((volume, i) => ({
      month: ((startMonth + i - 1) % 12) + 1,
      year: startYear + Math.floor((startMonth + i - 1) / 12),
      volume,
    }))
  }

  describe('rendering with no data', () => {
    it('shows no data message when trends is empty', () => {
      render(<TrendChartExpanded trends={[]} />)

      expect(screen.getByText('No trend data available')).toBeInTheDocument()
    })
  })

  describe('rendering with data', () => {
    it('renders chart title', () => {
      const trends = generateTrends([1000, 1200, 1100, 1300, 1400, 1500])
      render(<TrendChartExpanded trends={trends} />)

      expect(
        screen.getByText('12-Month Search Volume Trend')
      ).toBeInTheDocument()
    })

    it('renders SVG chart', () => {
      const trends = generateTrends([1000, 1200, 1100, 1300, 1400, 1500])
      const { container } = render(<TrendChartExpanded trends={trends} />)

      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveAttribute('role', 'img')
      expect(svg).toHaveAttribute('aria-label', 'Search volume trend chart')
    })

    it('renders data points as circles', () => {
      const trends = generateTrends([1000, 1200, 1100, 1300, 1400, 1500])
      const { container } = render(<TrendChartExpanded trends={trends} />)

      const circles = container.querySelectorAll('circle')
      expect(circles).toHaveLength(6)
    })

    it('applies custom className', () => {
      const trends = generateTrends([1000, 1200])
      const { container } = render(
        <TrendChartExpanded trends={trends} className="custom-class" />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom-class')
    })
  })

  describe('statistics', () => {
    it('displays min value', () => {
      const trends = generateTrends([500, 1200, 800, 1500])
      render(<TrendChartExpanded trends={trends} />)

      expect(screen.getByText(/Min: 500/)).toBeInTheDocument()
    })

    it('displays max value', () => {
      const trends = generateTrends([500, 1200, 800, 1500])
      render(<TrendChartExpanded trends={trends} />)

      expect(screen.getByText(/Max: 1,500/)).toBeInTheDocument()
    })

    it('displays average value', () => {
      const trends = generateTrends([1000, 1000, 1000, 1000]) // Avg = 1000
      render(<TrendChartExpanded trends={trends} />)

      expect(screen.getByText(/Avg: 1,000/)).toBeInTheDocument()
    })

    it('formats large numbers correctly', () => {
      const trends = generateTrends([10000, 20000, 15000, 25000])
      render(<TrendChartExpanded trends={trends} />)

      expect(screen.getByText(/Max: 25,000/)).toBeInTheDocument()
    })
  })

  describe('axis labels', () => {
    it('displays first month label', () => {
      const trends = generateTrends([1000, 1200], 3, 2024) // March start
      render(<TrendChartExpanded trends={trends} />)

      expect(screen.getByText('Mar')).toBeInTheDocument()
    })

    it('displays last month label', () => {
      const trends = generateTrends([1000, 1200], 3, 2024) // March-April
      render(<TrendChartExpanded trends={trends} />)

      expect(screen.getByText('Apr')).toBeInTheDocument()
    })

    it('displays Y-axis labels for min and max', () => {
      const trends = generateTrends([1000, 5000])
      const { container } = render(<TrendChartExpanded trends={trends} />)

      // Check for text elements (y-axis labels)
      const textElements = container.querySelectorAll('text')
      expect(textElements.length).toBeGreaterThanOrEqual(4) // Min, max, first month, last month
    })
  })

  describe('tooltips', () => {
    it('includes tooltip data for each point', () => {
      const trends = generateTrends([1000, 1200], 1, 2024)
      const { container } = render(<TrendChartExpanded trends={trends} />)

      const titles = container.querySelectorAll('title')
      expect(titles.length).toBe(2)
      expect(titles[0].textContent).toContain('Jan 2024')
      expect(titles[0].textContent).toContain('1,000')
    })
  })

  describe('gradient', () => {
    it('includes gradient definition', () => {
      const trends = generateTrends([1000, 1200])
      const { container } = render(<TrendChartExpanded trends={trends} />)

      const gradient = container.querySelector('linearGradient')
      expect(gradient).toBeInTheDocument()
      expect(gradient).toHaveAttribute('id', 'gradient')
    })

    it('has area fill using gradient', () => {
      const trends = generateTrends([1000, 1200])
      const { container } = render(<TrendChartExpanded trends={trends} />)

      const paths = container.querySelectorAll('path')
      const areaPath = Array.from(paths).find(p =>
        p.getAttribute('fill')?.includes('url(#gradient)')
      )
      expect(areaPath).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles single data point (shows no data message)', () => {
      const trends = generateTrends([1000])
      render(<TrendChartExpanded trends={trends} />)

      expect(screen.getByText('No trend data available')).toBeInTheDocument()
    })

    it('handles all zero values', () => {
      const trends = generateTrends([0, 0, 0, 0])
      const { container } = render(<TrendChartExpanded trends={trends} />)

      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('handles very large values', () => {
      const trends = generateTrends([1000000, 1500000])
      render(<TrendChartExpanded trends={trends} />)

      // Should show abbreviated values (1000k, 1500k)
      expect(screen.getByText('1000k')).toBeInTheDocument()
    })
  })
})
