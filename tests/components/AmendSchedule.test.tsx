import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AmendSchedule from '../../src/components/AmendSchedule';
import { STORAGE_KEYS } from '../../src/constants';
import { SAMPLE_SCHEDULES } from '../../src/constants/sampleSchedules';

const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!;
const requestSample = SAMPLE_SCHEDULES.find((s) => s.format === 'request')!;

function setValidToken() {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'a-token');
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(Date.now() + 60 * 60 * 1000));
}

function pasteAndParse(json: unknown) {
  fireEvent.click(screen.getByRole('button', { name: /Paste JSON/ }));
  fireEvent.change(screen.getByPlaceholderText('Paste your schedule JSON here...'), {
    target: { value: typeof json === 'string' ? json : JSON.stringify(json) }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Parse JSON' }));
}

afterEach(() => {
  localStorage.clear();
});

describe('AmendSchedule', () => {
  it('renders the Amend Payment Schedule heading', () => {
    render(<AmendSchedule apiEndpoint="" />);
    expect(screen.getByRole('heading', { name: 'Amend Payment Schedule' })).toBeInTheDocument();
  });

  it('warns when authentication is not configured', () => {
    render(<AmendSchedule apiEndpoint="" />);
    expect(screen.getByText('Please configure authentication to use this feature.')).toBeInTheDocument();
  });

  it('does not warn once a valid access token is present', () => {
    setValidToken();
    render(<AmendSchedule apiEndpoint="" />);
    expect(screen.queryByText('Please configure authentication to use this feature.')).not.toBeInTheDocument();
  });

  it('toggles between Upload File and Paste JSON input modes', () => {
    render(<AmendSchedule apiEndpoint="" />);

    expect(screen.getByText('Upload existing schedule JSON')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Paste JSON/ }));
    expect(screen.getByPlaceholderText('Paste your schedule JSON here...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Upload File/ }));
    expect(screen.getByText('Upload existing schedule JSON')).toBeInTheDocument();
  });

  it('parses a pasted, valid Payment Schedule Response and shows the Current Schedule panel', () => {
    render(<AmendSchedule apiEndpoint="" />);

    pasteAndParse(responseSample.json);

    expect(screen.getByText('Current Schedule')).toBeInTheDocument();
    expect(screen.getByText((responseSample.json as any).id)).toBeInTheDocument();
  });

  it('shows a syntax error for invalid JSON', () => {
    render(<AmendSchedule apiEndpoint="" />);

    pasteAndParse('{ not valid json');

    expect(
      screen.getByText('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.')
    ).toBeInTheDocument();
  });

  it('shows a missing-field error for an incomplete schedule', () => {
    render(<AmendSchedule apiEndpoint="" />);

    pasteAndParse({ collectionFrequency: 'monthly' });

    expect(screen.getByText('Missing required field: id')).toBeInTheDocument();
  });

  it('requires a valid collection day for monthly schedules', () => {
    render(<AmendSchedule apiEndpoint="" />);

    pasteAndParse({
      id: 'x',
      collectionFrequency: 'monthly',
      scheduleItems: [{ id: 'i', dueDate: '2026-01-01', netAmount: 1, amountDue: 1, periodStartDate: '2026-01-01', periodEndDate: '2026-01-31' }],
      coverStartDate: '2026-01-01',
      coverEndDate: '2026-12-31',
      inceptionDate: '2026-01-01'
    });

    expect(screen.getByText('Monthly schedules must have a valid collection day (1-31)')).toBeInTheDocument();
  });

  it('rejects a schedule with an empty scheduleItems array', () => {
    render(<AmendSchedule apiEndpoint="" />);

    pasteAndParse({
      id: 'x',
      collectionFrequency: 'annual',
      collectionDay: 0,
      scheduleItems: [],
      coverStartDate: '2026-01-01',
      coverEndDate: '2026-12-31',
      inceptionDate: '2026-01-01'
    });

    expect(screen.getByText('Schedule must contain at least one item')).toBeInTheDocument();
  });

  it.each([
    [{ dueDate: '2026-01-01', netAmount: 1, amountDue: 1, periodStartDate: '2026-01-01', periodEndDate: '2026-01-31' }, 'Schedule item at index 0 is missing an id'],
    [{ id: 'i', netAmount: 1, amountDue: 1, periodStartDate: '2026-01-01', periodEndDate: '2026-01-31' }, 'Schedule item at index 0 is missing a due date'],
    [{ id: 'i', dueDate: '2026-01-01', amountDue: 1, periodStartDate: '2026-01-01', periodEndDate: '2026-01-31' }, 'Schedule item at index 0 has invalid net amount'],
    [{ id: 'i', dueDate: '2026-01-01', netAmount: 1, periodStartDate: '2026-01-01', periodEndDate: '2026-01-31' }, 'Schedule item at index 0 has invalid amount due'],
    [{ id: 'i', dueDate: '2026-01-01', netAmount: 1, amountDue: 1 }, 'Schedule item at index 0 is missing period dates']
  ])('shows a validation error for an invalid schedule item: %j', (item, expectedMessage) => {
    render(<AmendSchedule apiEndpoint="" />);

    pasteAndParse({
      id: 'x',
      collectionFrequency: 'annual',
      collectionDay: 0,
      scheduleItems: [item],
      coverStartDate: '2026-01-01',
      coverEndDate: '2026-12-31',
      inceptionDate: '2026-01-01'
    });

    expect(screen.getByText(expectedMessage)).toBeInTheDocument();
  });

  it('parses a schedule uploaded as a file', async () => {
    render(<AmendSchedule apiEndpoint="" />);

    const file = new File([JSON.stringify(responseSample.json)], 'schedule.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('Current Schedule')).toBeInTheDocument());
  });

  it('ignores the file input change when no file is selected', () => {
    render(<AmendSchedule apiEndpoint="" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(screen.queryByText('Current Schedule')).not.toBeInTheDocument();
  });

  it('shows a syntax error for an uploaded file with invalid JSON', async () => {
    render(<AmendSchedule apiEndpoint="" />);

    const file = new File(['{ not valid'], 'schedule.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(
        screen.getByText('Invalid JSON syntax. Please check for missing commas, quotes, or brackets.')
      ).toBeInTheDocument()
    );
  });

  it('loads the embedded currentSchedule from a Request JSON via the JSON loader', () => {
    render(<AmendSchedule apiEndpoint="" />);

    fireEvent.click(screen.getByTitle('Load from JSON Request'));
    fireEvent.change(screen.getByPlaceholderText('Paste your JSON request here...'), {
      target: { value: JSON.stringify(requestSample.json) }
    });
    fireEvent.submit(screen.getByPlaceholderText('Paste your JSON request here...').closest('form')!);

    expect(screen.getByText('Current Schedule')).toBeInTheDocument();
  });

  it('shows an explanatory error when the loaded JSON request has no embedded currentSchedule', () => {
    render(<AmendSchedule apiEndpoint="" />);
    const { currentSchedule, ...withoutCurrentSchedule } = requestSample.json as any;

    fireEvent.click(screen.getByTitle('Load from JSON Request'));
    fireEvent.change(screen.getByPlaceholderText('Paste your JSON request here...'), {
      target: { value: JSON.stringify(withoutCurrentSchedule) }
    });
    fireEvent.submit(screen.getByPlaceholderText('Paste your JSON request here...').closest('form')!);

    expect(
      screen.getByText('No current schedule found in the JSON request. Please ensure the JSON contains a currentSchedule object.')
    ).toBeInTheDocument();
  });

  it('opens the current schedule JSON in a modal', () => {
    render(<AmendSchedule apiEndpoint="" />);
    pasteAndParse(responseSample.json);

    fireEvent.click(screen.getByRole('button', { name: 'View JSON' }));

    expect(screen.getByText('Current Schedule JSON')).toBeInTheDocument();
  });

  it('disables "Create New Schedule" without an access token, and hands off to NewSchedule once enabled', () => {
    render(<AmendSchedule apiEndpoint="test-endpoint" />);
    pasteAndParse(responseSample.json);

    expect(screen.getByRole('button', { name: /Create New Schedule/ })).toBeDisabled();
  });

  it('hands off to the NewSchedule form pre-filled from the current schedule', () => {
    setValidToken();
    render(<AmendSchedule apiEndpoint="test-endpoint" />);
    pasteAndParse(responseSample.json);

    fireEvent.click(screen.getByRole('button', { name: /Create New Schedule/ }));

    expect(screen.getByRole('heading', { name: 'Amend Payment Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View JSON Request' })).toBeInTheDocument();
  });
});
