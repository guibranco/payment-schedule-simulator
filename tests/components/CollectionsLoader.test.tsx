import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CollectionsLoader from '../../src/components/CollectionsLoader';

function getTextarea() {
  return screen.getByPlaceholderText('Paste the Collections Service JSON array here...') as HTMLTextAreaElement;
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }));
}

describe('CollectionsLoader', () => {
  it('parses valid JSON, calls onLoad with the collections, and closes', () => {
    const onLoad = vi.fn();
    const onClose = vi.fn();
    render(<CollectionsLoader onLoad={onLoad} onClose={onClose} />);

    const collections = [{ paymentScheduleItemIds: ['a'], collectionStatus: 'collected', amountDue: 10 }];
    fireEvent.change(getTextarea(), { target: { value: JSON.stringify(collections) } });
    submit();

    expect(onLoad).toHaveBeenCalledWith(collections);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a syntax error and does not call onLoad for invalid JSON', () => {
    const onLoad = vi.fn();
    const onClose = vi.fn();
    render(<CollectionsLoader onLoad={onLoad} onClose={onClose} />);

    fireEvent.change(getTextarea(), { target: { value: '{ not valid' } });
    submit();

    expect(screen.getByText('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.')).toBeInTheDocument();
    expect(onLoad).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the underlying validation error message when the JSON is not a valid collections array', () => {
    render(<CollectionsLoader onLoad={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(getTextarea(), { target: { value: '{}' } });
    submit();

    expect(screen.getByText('Expected a JSON array of collection transactions.')).toBeInTheDocument();
  });

  it('calls onClose without onLoad when Cancel is clicked', () => {
    const onLoad = vi.fn();
    const onClose = vi.fn();
    render(<CollectionsLoader onLoad={onLoad} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('calls onClose when the header close button is clicked', () => {
    const onClose = vi.fn();
    render(<CollectionsLoader onLoad={vi.fn()} onClose={onClose} />);

    const [closeButton] = screen.getAllByRole('button');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('populates the textarea from an uploaded JSON file', async () => {
    render(<CollectionsLoader onLoad={vi.fn()} onClose={vi.fn()} />);

    const content = JSON.stringify([{ paymentScheduleItemIds: ['a'], collectionStatus: 'collected', amountDue: 10 }]);
    const file = new File([content], 'collections.json', { type: 'application/json' });
    const input = screen.getByLabelText(/Upload JSON File/) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(getTextarea().value).toBe(content));
  });

  it('ignores the file input change when no file is selected', () => {
    render(<CollectionsLoader onLoad={vi.fn()} onClose={vi.fn()} />);

    const input = screen.getByLabelText(/Upload JSON File/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(getTextarea().value).toBe('');
  });
});
