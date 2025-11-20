import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'

describe('LoadingState', () => {
  it('should render loading message', () => {
    render(<LoadingState />)

    expect(screen.getByText(/fetching keyword data/i)).toBeInTheDocument()
  })

  it('should show timing message', () => {
    render(<LoadingState />)

    expect(
      screen.getByText(/this should take less than 3 seconds/i)
    ).toBeInTheDocument()
  })

  it('should render spinner', () => {
    const { container } = render(<LoadingState />)

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('should render error message', () => {
    render(<ErrorState error="Something went wrong" />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should show error heading', () => {
    render(<ErrorState error="Test error" />)

    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('should render retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorState error="Test error" onRetry={onRetry} />)

    expect(
      screen.getByRole('button', { name: /try again/i })
    ).toBeInTheDocument()
  })

  it('should call onRetry when button clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorState error="Test error" onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('should not render retry button when onRetry not provided', () => {
    render(<ErrorState error="Test error" />)

    expect(
      screen.queryByRole('button', { name: /try again/i })
    ).not.toBeInTheDocument()
  })

  it('should render error icon', () => {
    const { container } = render(<ErrorState error="Test error" />)

    const errorIcon = container.querySelector('svg')
    expect(errorIcon).toBeInTheDocument()
  })
})
