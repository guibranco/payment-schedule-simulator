import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorDisplay from '../../src/components/ErrorDisplay';
import type { ApiErrorResponse } from '../../src/types';

describe('ErrorDisplay', () => {
  it('renders a generic error with an alert icon and no correction hint', () => {
    const error: ApiErrorResponse = { message: 'Something broke', details: [], type: 'generic' };
    render(<ErrorDisplay error={error} />);

    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.queryByText('Please correct the above issues and try again.')).not.toBeInTheDocument();
  });

  it('renders a single detail inline', () => {
    const error: ApiErrorResponse = { message: 'Bad input', details: ['netAmount is required'], type: 'validation' };
    render(<ErrorDisplay error={error} />);

    expect(screen.getByText('netAmount is required')).toBeInTheDocument();
    expect(screen.getByText('Please correct the above issues and try again.')).toBeInTheDocument();
  });

  it('renders multiple details as a list for validation errors', () => {
    const error: ApiErrorResponse = {
      message: 'Bad input',
      details: ['netAmount is required', 'dueDate is required'],
      type: 'problem-details'
    };
    render(<ErrorDisplay error={error} />);

    expect(screen.getByText('netAmount is required')).toBeInTheDocument();
    expect(screen.getByText('dueDate is required')).toBeInTheDocument();
  });

  it('does not render a dismiss button when onDismiss is not provided', () => {
    const error: ApiErrorResponse = { message: 'Oops', details: [], type: 'generic' };
    render(<ErrorDisplay error={error} />);

    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const error: ApiErrorResponse = { message: 'Oops', details: [], type: 'generic' };
    render(<ErrorDisplay error={error} onDismiss={onDismiss} />);

    screen.getByText('Dismiss').closest('button')!.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('applies the provided className', () => {
    const error: ApiErrorResponse = { message: 'Oops', details: [], type: 'generic' };
    const { container } = render(<ErrorDisplay error={error} className="my-extra-class" />);

    expect(container.firstElementChild).toHaveClass('my-extra-class');
  });
});
