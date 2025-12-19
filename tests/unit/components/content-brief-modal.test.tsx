import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ContentBriefModal } from '@/components/content-brief/content-brief-modal'
import type { ContentBrief } from '@/types/content-brief'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ContentBriefModal', () => {
  const defaultProps = {
    keyword: 'seo tools',
    location: 'US',
    isOpen: true,
    onClose: vi.fn(),
  }

  const mockBrief: ContentBrief = {
    keyword: 'seo tools',
    location: 'US',
    generatedAt: '2025-01-01T00:00:00Z',
    serpResults: [
      {
        position: 1,
        title: 'Best SEO Tools 2025',
        url: 'https://example.com/seo-tools',
        domain: 'example.com',
        description: 'A comprehensive guide to SEO tools',
        wordCount: 2500,
      },
      {
        position: 2,
        title: 'Top SEO Software',
        url: 'https://another.com/seo',
        domain: 'another.com',
        description: 'Top software for SEO',
        wordCount: 1800,
      },
    ],
    recommendedWordCount: {
      min: 1500,
      max: 3000,
      average: 2150,
    },
    topics: [
      { topic: 'keyword research', frequency: 8, importance: 'high' },
      { topic: 'backlinks', frequency: 5, importance: 'medium' },
      { topic: 'site audit', frequency: 3, importance: 'low' },
    ],
    suggestedHeadings: [
      { text: 'What are SEO Tools?', level: 'h2', source: 'competitor' },
      { text: 'Top Features to Look For', level: 'h2', source: 'competitor' },
      { text: 'Keyword Research Features', level: 'h3', source: 'competitor' },
    ],
    questionsToAnswer: [
      { question: 'What is the best SEO tool?', source: 'paa' },
      { question: 'How much do SEO tools cost?', source: 'competitor' },
    ],
    relatedKeywords: ['seo software', 'keyword tool', 'rank tracker'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(
        <ContentBriefModal {...defaultProps} isOpen={false} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders modal when isOpen is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: mockBrief }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Content Brief')).toBeInTheDocument()
      expect(screen.getByText(/seo tools/)).toBeInTheDocument()
      await screen.findByText('Recommended Word Count')
    })

    it('has correct accessibility attributes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: mockBrief }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'brief-title')
      await screen.findByText('Recommended Word Count')
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
                  json: async () => ({ brief: mockBrief }),
                }),
              100
            )
          )
      )

      render(<ContentBriefModal {...defaultProps} />)

      expect(
        screen.getByText(/analyzing top search results/i)
      ).toBeInTheDocument()
      await screen.findByText('Recommended Word Count')
    })

    it('shows spinner during loading', async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ brief: mockBrief }),
                }),
              100
            )
          )
      )

      render(<ContentBriefModal {...defaultProps} />)

      // Check for the spinner element (has animate-spin class)
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      await screen.findByText('Recommended Word Count')
    })
  })

  describe('error state', () => {
    it('shows error message on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to generate content brief' }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(
          screen.getByText('Failed to generate content brief')
        ).toBeInTheDocument()
      })
    })

    it('shows generic error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows try again button on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'API error' }),
      })

      render(<ContentBriefModal {...defaultProps} />)

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
          json: async () => ({ brief: mockBrief }),
        })

      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/try again/i))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('brief content', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: mockBrief }),
      })
    })

    it('displays recommended word count', async () => {
      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('2,150')).toBeInTheDocument()
        expect(screen.getByText(/1,500.*3,000/)).toBeInTheDocument()
      })
    })

    it('displays topics with importance badges', async () => {
      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/keyword research/)).toBeInTheDocument()
        expect(screen.getByText(/backlinks/)).toBeInTheDocument()
        expect(screen.getByText(/site audit/)).toBeInTheDocument()
      })
    })

    it('displays suggested headings with level badges', async () => {
      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('What are SEO Tools?')).toBeInTheDocument()
        expect(screen.getAllByText('H2')).toHaveLength(2)
        expect(screen.getByText('H3')).toBeInTheDocument()
      })
    })

    it('displays questions to answer', async () => {
      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(
          screen.getByText('What is the best SEO tool?')
        ).toBeInTheDocument()
        expect(screen.getByText('People Also Ask')).toBeInTheDocument()
      })
    })

    it('displays related keywords', async () => {
      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('seo software')).toBeInTheDocument()
        expect(screen.getByText('keyword tool')).toBeInTheDocument()
        expect(screen.getByText('rank tracker')).toBeInTheDocument()
      })
    })

    it('displays top ranking pages', async () => {
      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Best SEO Tools 2025')).toBeInTheDocument()
        expect(screen.getByText(/example\.com/)).toBeInTheDocument()
        expect(screen.getByText(/~2,500 words/)).toBeInTheDocument()
      })
    })
  })

  describe('mock data warning', () => {
    it('shows mock data warning when brief.mockData is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: { ...mockBrief, mockData: true } }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/this is sample data/i)).toBeInTheDocument()
      })
    })

    it('does not show mock data warning when brief.mockData is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: { ...mockBrief, mockData: false } }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Content Brief')).toBeInTheDocument()
      })

      expect(screen.queryByText(/this is sample data/i)).not.toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onClose when close button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: mockBrief }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      await screen.findByText('Recommended Word Count')

      const closeButton = screen.getByLabelText(/close modal/i)
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when backdrop is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: mockBrief }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      await screen.findByText('Recommended Word Count')

      const backdrop = screen.getByRole('dialog')
      fireEvent.click(backdrop)

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('does not close when modal content is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: mockBrief }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Content Brief')).toBeInTheDocument()
      })

      // Click on modal content (not backdrop)
      fireEvent.click(screen.getByText('Content Brief'))

      expect(defaultProps.onClose).not.toHaveBeenCalled()
    })
  })

  describe('API call', () => {
    it('sends correct request to API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: mockBrief }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/content-brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: 'seo tools', location: 'US' }),
        })
      })
    })

    it('only fetches once on initial open', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ brief: mockBrief }),
      })

      render(<ContentBriefModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Content Brief')).toBeInTheDocument()
      })

      // Wait a bit to ensure no duplicate calls
      await new Promise(r => setTimeout(r, 100))

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
