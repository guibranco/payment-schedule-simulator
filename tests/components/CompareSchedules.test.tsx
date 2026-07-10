import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CompareSchedules from '../../src/components/CompareSchedules';
import { SAMPLE_SCHEDULES } from '../../src/constants/sampleSchedules';
import { FORMAT_LABELS } from '../../src/utils/scheduleDetector';

function slotContainer(scheduleNumber: 1 | 2) {
  const heading = screen.getByRole('heading', { name: `Schedule ${scheduleNumber}` });
  return heading.closest('.space-y-4') as HTMLElement;
}

function loadSchedule(scheduleNumber: 1 | 2, json: unknown) {
  const container = slotContainer(scheduleNumber);
  fireEvent.change(within(container).getByPlaceholderText(/{/), { target: { value: JSON.stringify(json) } });
  fireEvent.click(within(container).getByRole('button', { name: `Load Schedule ${scheduleNumber}` }));
}

describe('CompareSchedules', () => {
  it('shows a note listing all 4 supported formats for each side', () => {
    render(<CompareSchedules />);
    Object.values(FORMAT_LABELS).forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });

  it('detects and loads a Payment Schedule Response on side 1', () => {
    render(<CompareSchedules />);
    const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!;
    loadSchedule(1, responseSample.json);

    expect(screen.getByText(`Detected format: ${responseSample.label}`)).toBeInTheDocument();
  });

  it('detects and loads a Policy Admin CosmosDB Document on side 2', () => {
    render(<CompareSchedules />);
    const policyAdminSample = SAMPLE_SCHEDULES.find((s) => s.format === 'policyAdmin')!;
    loadSchedule(2, policyAdminSample.json);

    expect(screen.getByText(`Detected format: ${policyAdminSample.label}`)).toBeInTheDocument();
  });

  it('shows a comparison summary once both sides have a schedule loaded', () => {
    render(<CompareSchedules />);
    const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!;
    const reratesSample = SAMPLE_SCHEDULES.find((s) => s.format === 'rerates')!;

    loadSchedule(1, responseSample.json);
    loadSchedule(2, reratesSample.json);

    expect(screen.getByText('Comparison Summary')).toBeInTheDocument();
    expect(screen.getByText('Schedule 1 Total')).toBeInTheDocument();
    expect(screen.getByText('Schedule 2 Total')).toBeInTheDocument();
  });

  it('shows a syntax error for invalid JSON on a side', () => {
    render(<CompareSchedules />);
    const container = slotContainer(1);
    fireEvent.change(within(container).getByPlaceholderText(/{/), { target: { value: '{ not valid json' } });
    fireEvent.click(within(container).getByRole('button', { name: 'Load Schedule 1' }));

    expect(screen.getByText(/Invalid JSON syntax/)).toBeInTheDocument();
  });

  it('shows an explanatory error for a Request with no embedded currentSchedule', () => {
    render(<CompareSchedules />);
    const requestSample = SAMPLE_SCHEDULES.find((s) => s.format === 'request')!.json as any;
    const { currentSchedule, ...withoutCurrentSchedule } = requestSample;
    loadSchedule(1, withoutCurrentSchedule);

    expect(screen.getByText(/does not include an embedded currentSchedule/)).toBeInTheDocument();
  });

  it('clears a loaded schedule back to the input form', () => {
    render(<CompareSchedules />);
    const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!;
    loadSchedule(1, responseSample.json);
    expect(screen.getByText(`Detected format: ${responseSample.label}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByText(`Detected format: ${responseSample.label}`)).not.toBeInTheDocument();
    expect(within(slotContainer(1)).getByRole('button', { name: 'Load Schedule 1' })).toBeInTheDocument();
  });
});
