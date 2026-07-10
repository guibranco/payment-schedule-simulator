import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ViewSchedule from '../../src/components/ViewSchedule';
import { SAMPLE_SCHEDULES } from '../../src/constants/sampleSchedules';
import { FORMAT_LABELS } from '../../src/utils/scheduleDetector';

function submitJson(json: string) {
  fireEvent.change(screen.getByPlaceholderText(/{/), { target: { value: json } });
  fireEvent.click(screen.getByRole('button', { name: 'View Schedule' }));
}

describe('ViewSchedule', () => {
  it('shows the note listing all 4 supported formats and a Load Example dropdown', () => {
    render(<ViewSchedule apiEndpoint="" />);

    expect(screen.getByRole('heading', { name: 'View Schedule' })).toBeInTheDocument();
    Object.values(FORMAT_LABELS).forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });

    const select = screen.getByLabelText('Load Example') as HTMLSelectElement;
    expect(within(select).getAllByRole('option')).toHaveLength(SAMPLE_SCHEDULES.length + 1);
  });

  it('fills the textarea when an example is selected from the dropdown', () => {
    render(<ViewSchedule apiEndpoint="" />);

    const select = screen.getByLabelText('Load Example');
    fireEvent.change(select, { target: { value: 'policyAdmin' } });

    const textarea = screen.getByPlaceholderText(/{/) as HTMLTextAreaElement;
    const policyAdminSample = SAMPLE_SCHEDULES.find((s) => s.format === 'policyAdmin')!;
    expect(textarea.value).toBe(JSON.stringify(policyAdminSample.json, null, 2));
  });

  it('shows a syntax error for invalid JSON', () => {
    render(<ViewSchedule apiEndpoint="" />);
    submitJson('{ not valid json');

    expect(screen.getByText(/Invalid JSON syntax/)).toBeInTheDocument();
    expect(screen.queryByText(/Detected format/)).not.toBeInTheDocument();
  });

  it.each(SAMPLE_SCHEDULES.map((s) => [s.format, s.label] as const))(
    'detects the %s format and shows its label',
    (format, label) => {
      render(<ViewSchedule apiEndpoint="" />);
      const sample = SAMPLE_SCHEDULES.find((s) => s.format === format)!;
      submitJson(JSON.stringify(sample.json));

      expect(screen.getByText(`Detected format: ${label}`)).toBeInTheDocument();
    }
  );

  it('shows only the input parameters for a request with no embedded currentSchedule', () => {
    render(<ViewSchedule apiEndpoint="" />);
    const requestSample = SAMPLE_SCHEDULES.find((s) => s.format === 'request')!.json as any;
    const { currentSchedule, ...withoutCurrentSchedule } = requestSample;

    submitJson(JSON.stringify(withoutCurrentSchedule));

    expect(screen.getByText(/does not include an embedded currentSchedule/)).toBeInTheDocument();
    expect(screen.getByText('Collection Frequency')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not show a stale schedule alongside a parse error after resetting and re-submitting', () => {
    render(<ViewSchedule apiEndpoint="" />);
    const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!;
    submitJson(JSON.stringify(responseSample.json));
    expect(screen.getByText(`Detected format: ${responseSample.label}`)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Parse New Schedule'));
    submitJson('{ not valid json');

    expect(screen.getByText(/Invalid JSON syntax/)).toBeInTheDocument();
    expect(screen.queryByText(/Detected format/)).not.toBeInTheDocument();
    // back to the initial paste form, not the previous schedule
    expect(screen.getByRole('button', { name: 'View Schedule' })).toBeInTheDocument();
  });

  it('resets back to the input form when "Parse New Schedule" is clicked', () => {
    render(<ViewSchedule apiEndpoint="" />);
    const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!;
    submitJson(JSON.stringify(responseSample.json));

    fireEvent.click(screen.getByText('Parse New Schedule'));

    expect(screen.queryByText(/Detected format/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Load Example')).toBeInTheDocument();
  });

  it('hands off to the Amend Schedule form with the derived input pre-filled', () => {
    const { container } = render(<ViewSchedule apiEndpoint="test-endpoint" />);
    const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!;
    submitJson(JSON.stringify(responseSample.json));

    fireEvent.click(screen.getByRole('button', { name: /Amend Schedule/ }));

    expect(screen.getByRole('heading', { name: 'Amend Payment Schedule' })).toBeInTheDocument();
    const netAmountInput = container.querySelector('input[name="netAmount"]') as HTMLInputElement;
    const expectedNet = (responseSample.json as any).scheduleItems.reduce(
      (sum: number, item: any) => sum + item.netAmount,
      0
    );
    expect(Number(netAmountInput.value)).toBeCloseTo(expectedNet, 5);
  });
});
