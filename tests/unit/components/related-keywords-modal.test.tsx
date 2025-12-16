import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { RelatedKeywordsModal } from '@/components/related-keywords/related-keywords-modal'
import type { RelatedKeyword } from '@/types/related-keywords'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('RelatedKeywordsModal', () => {
  const defaultProps = {
    keyword: 'seo tools',
    location: 'US',
    isOpen: true,
    onClose: vi.fn(),
  }

  const mockRelatedKeywords: RelatedKeyword[] = [
    {
      keyword: 'best seo tools',
      searchVolume: 5000,
      difficulty: 45,
      cpc: 2.5,
      competition: 'medium',
      intent: 'commercial',
      relevance: 95,
    },
    {
      keyword: 'seo software',
      searchVolume: 3200,
      difficulty: 52,
      cpc: 3.1,
      competition: 'high',
      intent: 'commercial',
      relevance: 88,
    },
    {
      keyword: 'free seo tools',
      searchVolume: 8000,
      difficulty: 38,
      cpc: 1.2,
      competition: 'low',
      intent: 'transactional',
      relevance: 75,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(
        <RelatedKeywordsModal {...defaultProps} isOpen={false} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders modal when isOpen is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          relatedKeywords: mockRelatedKeywords,
          provider: 'DataForSEO',
        }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Related Keywords')).toBeInTheDocument()
      expect(screen.getByText(/seo tools/)).toBeInTheDocument()
    })

    it('has correct accessibility attributes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'related-title')
    })
  })

  describe('loading state', () => {
    it('shows loading state while fetching', async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ relatedKeywords: mockRelatedKeywords }),
                }),
              100
            )
          )
      )

      render(<RelatedKeywordsModal {...defaultProps} />)

      expect(screen.getByText(/finding related keywords/i)).toBeInTheDocument()
    })

    it('shows spinner during loading', async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ relatedKeywords: mockRelatedKeywords }),
                }),
              100
            )
          )
      )

      render(<RelatedKeywordsModal {...defaultProps} />)

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to fetch related keywords' }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(
          screen.getByText('Failed to fetch related keywords')
        ).toBeInTheDocument()
      })
    })

    it('shows generic error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows try again button on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'API error' }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument()
      })
    })

    it('retries fetch on try again click', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'API error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ relatedKeywords: mockRelatedKeywords }),
        })

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/try again/i))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('keywords table', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          relatedKeywords: mockRelatedKeywords,
          provider: 'DataForSEO',
        }),
      })
    })

    it('displays table headers', async () => {
      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Keyword')).toBeInTheDocument()
        expect(screen.getByText('Volume')).toBeInTheDocument()
        expect(screen.getByText('Relevance')).toBeInTheDocument()
      })
    })

    it('displays keyword data', async () => {
      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('best seo tools')).toBeInTheDocument()
        expect(screen.getByText('seo software')).toBeInTheDocument()
        expect(screen.getByText('free seo tools')).toBeInTheDocument()
      })
    })

    it('displays search volume formatted', async () => {
      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('5,000')).toBeInTheDocument()
        expect(screen.getByText('3,200')).toBeInTheDocument()
        expect(screen.getByText('8,000')).toBeInTheDocument()
      })
    })

    it('displays competition badges', async () => {
      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('medium')).toBeInTheDocument()
        expect(screen.getByText('high')).toBeInTheDocument()
        expect(screen.getByText('low')).toBeInTheDocument()
      })
    })

    it('displays CPC values', async () => {
      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/\$2\.50 CPC/)).toBeInTheDocument()
        expect(screen.getByText(/\$3\.10 CPC/)).toBeInTheDocument()
        expect(screen.getByText(/\$1\.20 CPC/)).toBeInTheDocument()
      })
    })

    it('displays relevance percentages', async () => {
      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('95%')).toBeInTheDocument()
        expect(screen.getByText('88%')).toBeInTheDocument()
        expect(screen.getByText('75%')).toBeInTheDocument()
      })
    })

    it('displays keyword count summary', async () => {
      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(
          screen.getByText(/found 3 related keywords/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('mock data warning', () => {
    it('shows mock data warning when provider is Mock', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          relatedKeywords: mockRelatedKeywords,
          provider: 'Mock',
        }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/this is sample data/i)).toBeInTheDocument()
      })
    })

    it('does not show mock data warning when provider is not Mock', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          relatedKeywords: mockRelatedKeywords,
          provider: 'DataForSEO',
        }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('best seo tools')).toBeInTheDocument()
      })

      expect(screen.queryByText(/this is sample data/i)).not.toBeInTheDocument()
    })
  })

  describe('add keyword callback', () => {
    it('shows action column when onAddKeyword is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(<RelatedKeywordsModal {...defaultProps} onAddKeyword={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Action')).toBeInTheDocument()
      })
    })

    it('does not show action column when onAddKeyword is not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('best seo tools')).toBeInTheDocument()
      })

      expect(screen.queryByText('Action')).not.toBeInTheDocument()
    })

    it('shows add buttons when onAddKeyword is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(<RelatedKeywordsModal {...defaultProps} onAddKeyword={vi.fn()} />)

      await waitFor(() => {
        const addButtons = screen.getAllByText('+ Add')
        expect(addButtons).toHaveLength(3)
      })
    })

    it('calls onAddKeyword with keyword when add button is clicked', async () => {
      const onAddKeyword = vi.fn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(
        <RelatedKeywordsModal {...defaultProps} onAddKeyword={onAddKeyword} />
      )

      await waitFor(() => {
        expect(screen.getByText('best seo tools')).toBeInTheDocument()
      })

      const addButtons = screen.getAllByText('+ Add')
      fireEvent.click(addButtons[0])

      expect(onAddKeyword).toHaveBeenCalledWith('best seo tools')
    })
  })

  describe('interactions', () => {
    it('calls onClose when close button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      const closeButton = screen.getByLabelText(/close modal/i)
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when backdrop is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      const backdrop = screen.getByRole('dialog')
      fireEvent.click(backdrop)

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('does not close when modal content is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Related Keywords')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Related Keywords'))

      expect(defaultProps.onClose).not.toHaveBeenCalled()
    })
  })

  describe('API call', () => {
    it('sends correct request to API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/keywords/related', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: 'seo tools', location: 'US' }),
        })
      })
    })

    it('only fetches once on initial open', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relatedKeywords: mockRelatedKeywords }),
      })

      render(<RelatedKeywordsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('best seo tools')).toBeInTheDocument()
      })

      await new Promise(r => setTimeout(r, 100))

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
