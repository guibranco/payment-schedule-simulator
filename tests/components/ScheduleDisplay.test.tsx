import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ScheduleDisplay from '../../src/components/ScheduleDisplay';
import { detectAndNormalizeSchedule } from '../../src/utils/scheduleDetector';
import { SAMPLE_SCHEDULES } from '../../src/constants/sampleSchedules';

vi.mock('../../src/utils/scheduleImage', () => ({
  exportScheduleImage: vi.fn()
}));

import { exportScheduleImage } from '../../src/utils/scheduleImage';

const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!.json;
const { schedule } = detectAndNormalizeSchedule(responseSample);

describe('ScheduleDisplay', () => {
  beforeEach(() => {
    vi.mocked(exportScheduleImage).mockReset();
  });

  it('shows the fully visible schedule id (not truncated)', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    const idEl = screen.getByText(schedule!.id);
    expect(idEl.className).not.toContain('truncate');
    expect(idEl).toHaveTextContent(schedule!.id);
  });

  it('renders the total amount and one row per schedule item', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    const totalAmount = schedule!.scheduleItems.reduce((sum, item) => sum + item.amountDue, 0);
    expect(screen.getByText(totalAmount.toFixed(2))).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(schedule!.scheduleItems.length + 1); // + header row
  });

  it('calls onStatusChange with the row index when a status icon is clicked', () => {
    const onStatusChange = vi.fn();
    render(<ScheduleDisplay schedule={schedule!} onStatusChange={onStatusChange} />);

    const statusButtons = screen.getAllByTitle('Click to change status');
    fireEvent.click(statusButtons[0]);

    expect(onStatusChange).toHaveBeenCalledWith(0);
  });

  it('opens the JSON modal when "View JSON" is clicked', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    fireEvent.click(screen.getByText('View JSON'));

    expect(screen.getByText('Schedule JSON')).toBeInTheDocument();
    const modal = screen.getByText('Schedule JSON').closest('div')!.parentElement!;
    expect(within(modal).getByText(new RegExp(schedule!.id))).toBeInTheDocument();
  });

  it('exports a PNG via the scheduleImage util when "PNG" is clicked', async () => {
    vi.mocked(exportScheduleImage).mockResolvedValueOnce(undefined);
    render(<ScheduleDisplay schedule={schedule!} />);

    fireEvent.click(screen.getByText('PNG'));

    await waitFor(() => {
      expect(exportScheduleImage).toHaveBeenCalledWith(schedule, 'png');
    });
  });

  it('exports an SVG via the scheduleImage util when "SVG" is clicked', async () => {
    vi.mocked(exportScheduleImage).mockResolvedValueOnce(undefined);
    render(<ScheduleDisplay schedule={schedule!} />);

    fireEvent.click(screen.getByText('SVG'));

    await waitFor(() => {
      expect(exportScheduleImage).toHaveBeenCalledWith(schedule, 'svg');
    });
  });

  it('shows an error message when image export fails', async () => {
    vi.mocked(exportScheduleImage).mockRejectedValueOnce(new Error('boom'));
    render(<ScheduleDisplay schedule={schedule!} />);

    fireEvent.click(screen.getByText('PNG'));

    expect(await screen.findByText('Failed to generate image. Please try again.')).toBeInTheDocument();
  });

  it('renders a fallback message when no schedule is provided', () => {
    render(<ScheduleDisplay schedule={null as any} />);
    expect(screen.getByText('No schedule data available.')).toBeInTheDocument();
  });
});
