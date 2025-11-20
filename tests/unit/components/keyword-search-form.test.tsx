import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { KeywordSearchForm } from '@/components/forms/keyword-search-form';

describe('KeywordSearchForm', () => {
  it('should render form fields', () => {
    const onSubmit = vi.fn();
    render(<KeywordSearchForm onSubmit={onSubmit} />);

    expect(screen.getByLabelText(/keywords/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get keyword data/i })).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<KeywordSearchForm onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText(/keywords/i);
    await user.type(textarea, 'seo tools\nkeyword research');
    await user.click(screen.getByRole('button', { name: /get keyword data/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      keywordsInput: 'seo tools\nkeyword research',
      matchType: 'phrase',
      location: 'United States',
    });
  });

  it('should show validation error for empty input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<KeywordSearchForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /get keyword data/i }));

    expect(await screen.findByText(/please enter at least one keyword/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should allow changing match type', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<KeywordSearchForm onSubmit={onSubmit} />);

    const exactRadio = screen.getByLabelText(/exact match/i);
    await user.click(exactRadio);

    const textarea = screen.getByLabelText(/keywords/i);
    await user.type(textarea, 'test keyword');
    await user.click(screen.getByRole('button', { name: /get keyword data/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        matchType: 'exact',
      })
    );
  });

  it('should allow changing location', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<KeywordSearchForm onSubmit={onSubmit} />);

    const locationSelect = screen.getByLabelText(/location/i);
    await user.selectOptions(locationSelect, 'Canada');

    const textarea = screen.getByLabelText(/keywords/i);
    await user.type(textarea, 'test');
    await user.click(screen.getByRole('button', { name: /get keyword data/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        location: 'Canada',
      })
    );
  });

  it('should disable form when loading', () => {
    const onSubmit = vi.fn();
    render(<KeywordSearchForm onSubmit={onSubmit} isLoading={true} />);

    const textarea = screen.getByLabelText(/keywords/i);
    const button = screen.getByRole('button', { name: /searching/i });

    expect(textarea).toBeDisabled();
    expect(button).toBeDisabled();
  });

  it('should show "Searching..." when loading', () => {
    const onSubmit = vi.fn();
    render(<KeywordSearchForm onSubmit={onSubmit} isLoading={true} />);

    expect(screen.getByRole('button', { name: /searching/i})).toBeInTheDocument();
  });

  it('should allow changing match type to exact', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<KeywordSearchForm onSubmit={onSubmit} />);

    // Find and click the "Exact Match" radio button
    const exactRadio = screen.getByLabelText(/exact match/i);
    await user.click(exactRadio);

    // Verify it's checked
    expect(exactRadio).toBeChecked();

    // Submit and verify exact match type is sent
    await user.type(screen.getByLabelText(/keywords/i), 'test keyword');
    await user.click(screen.getByRole('button', { name: /get keyword data/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        matchType: 'exact',
      })
    );
  });

  // Note: Max length validation is tested at the schema level in validation.test.ts
});
