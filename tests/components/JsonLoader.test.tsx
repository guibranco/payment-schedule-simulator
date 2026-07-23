import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JsonLoader from '../../src/components/JsonLoader';

function getTextarea() {
  return screen.getByPlaceholderText('Paste your JSON request here...') as HTMLTextAreaElement;
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Load JSON' }));
}

function fillAndSubmit(json: unknown) {
  fireEvent.change(getTextarea(), { target: { value: JSON.stringify(json) } });
  submit();
}

describe('JsonLoader', () => {
  it('parses a full monthly request and normalizes admin fees and taxes/levies', () => {
    const onLoad = vi.fn();
    const onClose = vi.fn();
    render(<JsonLoader onLoad={onLoad} onClose={onClose} />);

    fillAndSubmit({
      collectionFrequency: 'monthly',
      scheduleStartDate: '2026-01-01',
      scheduleEndDate: '2026-12-31',
      collectionDay: '15',
      effectiveDate: '2026-01-01',
      dueDate: '2026-01-15',
      netAmount: 100,
      adminFees: { setup: { amountDue: '10', taxAmount: '2' } },
      taxesAndLevies: { levy: { '2026-01-01': '5' } }
    });

    expect(onLoad).toHaveBeenCalledWith({
      collectionFrequency: 'Monthly',
      scheduleStartDate: '2026-01-01',
      scheduleEndDate: '2026-12-31',
      collectionDay: 15,
      effectiveDate: '2026-01-01',
      dueDate: '2026-01-15',
      netAmount: 100,
      taxesAndLevies: { levy: { '2026-01-01': 5 } },
      adminFees: { setup: { amountDue: 10, taxAmount: 2 } },
      currentSchedule: undefined
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('forces collectionDay to 0 and defaults scheduleEndDate for an annual request', () => {
    const onLoad = vi.fn();
    render(<JsonLoader onLoad={onLoad} onClose={vi.fn()} />);

    fillAndSubmit({
      collectionFrequency: 'annual',
      scheduleStartDate: '2026-01-01',
      effectiveDate: '2026-01-01',
      netAmount: 200
    });

    expect(onLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionFrequency: 'Annual',
        collectionDay: 0,
        scheduleEndDate: '0001-01-01',
        dueDate: null,
        taxesAndLevies: {},
        adminFees: {}
      })
    );
  });

  it('shows a syntax error for invalid JSON', () => {
    const onLoad = vi.fn();
    render(<JsonLoader onLoad={onLoad} onClose={vi.fn()} />);

    fireEvent.change(getTextarea(), { target: { value: '{ not valid' } });
    submit();

    expect(screen.getByText('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.')).toBeInTheDocument();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'Missing required field: collectionFrequency'],
    [{ collectionFrequency: 'monthly' }, 'Missing required field: scheduleStartDate'],
    [{ collectionFrequency: 'monthly', scheduleStartDate: '2026-01-01' }, 'Missing required field: effectiveDate'],
    [
      { collectionFrequency: 'monthly', scheduleStartDate: '2026-01-01', effectiveDate: '2026-01-01' },
      'netAmount must be a number'
    ]
  ])('shows a validation error for %j', (json, expectedMessage) => {
    render(<JsonLoader onLoad={vi.fn()} onClose={vi.fn()} />);

    fillAndSubmit(json);

    expect(screen.getByText(expectedMessage)).toBeInTheDocument();
  });

  it('calls onClose without onLoad when Cancel is clicked', () => {
    const onLoad = vi.fn();
    const onClose = vi.fn();
    render(<JsonLoader onLoad={onLoad} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('calls onClose when the header close button is clicked', () => {
    const onClose = vi.fn();
    render(<JsonLoader onLoad={vi.fn()} onClose={onClose} />);

    const [closeButton] = screen.getAllByRole('button');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('populates the textarea from an uploaded JSON file', async () => {
    render(<JsonLoader onLoad={vi.fn()} onClose={vi.fn()} />);

    const content = JSON.stringify({ collectionFrequency: 'monthly' });
    const file = new File([content], 'request.json', { type: 'application/json' });
    const input = screen.getByLabelText(/Upload JSON File/) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(getTextarea().value).toBe(content));
  });

  it('ignores the file input change when no file is selected', () => {
    render(<JsonLoader onLoad={vi.fn()} onClose={vi.fn()} />);

    const input = screen.getByLabelText(/Upload JSON File/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(getTextarea().value).toBe('');
  });
});
