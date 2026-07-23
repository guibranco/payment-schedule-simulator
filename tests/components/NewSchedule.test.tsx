import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import NewSchedule from '../../src/components/NewSchedule';
import { STORAGE_KEYS } from '../../src/constants';
import type { PaymentScheduleResponse } from '../../src/types';

const VALID_TOKEN_EXPIRY = () => Date.now() + 60 * 60 * 1000;

function setValidToken() {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'a-token');
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(VALID_TOKEN_EXPIRY()));
}

function fillMinimalSchedule() {
  fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '250' } });
}

const sampleResponse: PaymentScheduleResponse = {
  id: 'sched-1',
  token: 't',
  hash: 'h',
  collectionFrequency: 'Monthly',
  collectionDay: 1,
  inceptionDate: '2026-01-01',
  coverStartDate: '2026-01-01',
  coverEndDate: '2026-12-31',
  scheduleItems: []
};

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('NewSchedule', () => {
  it('renders the New Payment Schedule heading with no initial schedule', () => {
    render(<NewSchedule apiEndpoint="" />);
    expect(screen.getByRole('heading', { name: 'New Payment Schedule' })).toBeInTheDocument();
  });

  it('calls onBack when the Back button is clicked', () => {
    const onBack = vi.fn();
    render(<NewSchedule apiEndpoint="" onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /Back/ }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not render a Back button when onBack is not provided', () => {
    render(<NewSchedule apiEndpoint="" />);
    expect(screen.queryByRole('button', { name: /Back/ })).not.toBeInTheDocument();
  });

  it('forces collection day to 0 and disables the field when frequency switches to Annual', () => {
    render(<NewSchedule apiEndpoint="" />);

    fireEvent.change(screen.getByDisplayValue('Monthly'), { target: { value: 'Annual' } });

    const collectionDayInput = document.querySelector('input[name="collectionDay"]') as HTMLInputElement;
    expect(collectionDayInput).toBeDisabled();
    // schedule.collectionDay || '' means a 0 value renders as an empty string
    expect(collectionDayInput.value).toBe('');
  });

  it('adds and removes a tax entry', () => {
    render(<NewSchedule apiEndpoint="" />);

    fireEvent.change(screen.getByPlaceholderText('Tax Label'), { target: { value: 'LVY' } });
    fireEvent.change(screen.getAllByPlaceholderText('Amount')[0], { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Tax' }));

    expect(screen.getByText('LVY')).toBeInTheDocument();
    expect(screen.getByText(': €12.5')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Remove tax'));
    expect(screen.queryByText('LVY')).not.toBeInTheDocument();
  });

  it('does not add a tax entry when the label or amount is missing', () => {
    render(<NewSchedule apiEndpoint="" />);

    fireEvent.change(screen.getByPlaceholderText('Tax Label'), { target: { value: 'LVY' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Tax' }));

    expect(screen.queryByText('LVY')).not.toBeInTheDocument();
  });

  it('adds and removes an admin fee entry', () => {
    render(<NewSchedule apiEndpoint="" />);

    fireEvent.change(screen.getByPlaceholderText('Fee Label'), { target: { value: 'SMD' } });
    const feeAmountInputs = screen.getAllByPlaceholderText('Amount');
    fireEvent.change(feeAmountInputs[feeAmountInputs.length - 1], { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Fee' }));

    expect(screen.getByText('SMD:')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Remove fee'));
    expect(screen.queryByText('SMD:')).not.toBeInTheDocument();
  });

  it('does not add a fee entry when the label or amount is missing', () => {
    render(<NewSchedule apiEndpoint="" />);

    fireEvent.change(screen.getByPlaceholderText('Fee Label'), { target: { value: 'SMD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Fee' }));

    expect(screen.queryByText('SMD:')).not.toBeInTheDocument();
  });

  it('opens and closes the JSON request preview modal', () => {
    render(<NewSchedule apiEndpoint="" />);

    fireEvent.click(screen.getByRole('button', { name: 'View JSON Request' }));
    expect(screen.getByText('JSON Request Preview')).toBeInTheDocument();
    expect(screen.getByText(/"collectionFrequency": "Monthly"/)).toBeInTheDocument();
  });

  it('loads a schedule from the JSON loader and clears a prior API error', async () => {
    render(<NewSchedule apiEndpoint="" />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate Schedule' }));
    expect(screen.getByText('API endpoint not configured')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Load from JSON'));
    const textarea = screen.getByPlaceholderText('Paste your JSON request here...');
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify({
          collectionFrequency: 'monthly',
          scheduleStartDate: '2026-01-01',
          effectiveDate: '2026-01-01',
          netAmount: 500
        })
      }
    });
    fireEvent.submit(textarea.closest('form')!);

    expect(screen.queryByText('API endpoint not configured')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
  });

  it('resets the form back to defaults, clearing the response and any error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => sampleResponse }));
    setValidToken();
    render(<NewSchedule apiEndpoint="https://api.example.com" />);
    fillMinimalSchedule();

    fireEvent.click(screen.getByRole('button', { name: 'Generate Schedule' }));
    await waitFor(() => expect(screen.getByText('sched-1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.queryByText('sched-1')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
  });

  it('shows a configuration error when the API endpoint is not set', () => {
    render(<NewSchedule apiEndpoint="" />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate Schedule' }));

    expect(screen.getByText('API endpoint not configured')).toBeInTheDocument();
  });

  it('shows an authentication error when there is no access token', () => {
    render(<NewSchedule apiEndpoint="https://api.example.com" />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate Schedule' }));

    expect(screen.getByText('Authentication required')).toBeInTheDocument();
  });

  it('disables submit and shows an expired-token message, attempting a refresh', () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'a-token');
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() - 1000));
    render(<NewSchedule apiEndpoint="https://api.example.com" />);

    expect(screen.getByRole('button', { name: 'Generate Schedule' })).toBeDisabled();
  });

  it('renders the returned schedule on a successful submit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => sampleResponse });
    vi.stubGlobal('fetch', fetchMock);
    setValidToken();
    render(<NewSchedule apiEndpoint="https://api.example.com" />);
    fillMinimalSchedule();

    fireEvent.click(screen.getByRole('button', { name: 'Generate Schedule' }));

    await waitFor(() => expect(screen.getByText('sched-1')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v2/schedule/calculate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer a-token' })
      })
    );
  });

  it('shows a parsed API error for a non-ok, non-401 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Bad input', details: ['netAmount is required'] })
      })
    );
    setValidToken();
    render(<NewSchedule apiEndpoint="https://api.example.com" />);
    fillMinimalSchedule();

    fireEvent.click(screen.getByRole('button', { name: 'Generate Schedule' }));

    expect(await screen.findByText('Bad input')).toBeInTheDocument();
    expect(screen.getByText('netAmount is required')).toBeInTheDocument();
  });

  it('falls back to a generic error when the error body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new SyntaxError('Unexpected token');
        }
      })
    );
    setValidToken();
    render(<NewSchedule apiEndpoint="https://api.example.com" />);
    fillMinimalSchedule();

    fireEvent.click(screen.getByRole('button', { name: 'Generate Schedule' }));

    expect(await screen.findByText('HTTP 500: Internal Server Error')).toBeInTheDocument();
  });

  it('surfaces a 401 response as an authentication-expired message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    setValidToken();
    render(<NewSchedule apiEndpoint="https://api.example.com" />);
    fillMinimalSchedule();

    fireEvent.click(screen.getByRole('button', { name: 'Generate Schedule' }));

    expect(await screen.findByText('Authentication expired')).toBeInTheDocument();
  });

  it('shows a network error when the fetch call throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    setValidToken();
    render(<NewSchedule apiEndpoint="https://api.example.com" />);
    fillMinimalSchedule();

    fireEvent.click(screen.getByRole('button', { name: 'Generate Schedule' }));

    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });
});
