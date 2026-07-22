import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ScheduleDisplay from '../../src/components/ScheduleDisplay';
import { detectAndNormalizeSchedule } from '../../src/utils/scheduleDetector';
import { SAMPLE_SCHEDULES } from '../../src/constants/sampleSchedules';
import { STORAGE_KEYS } from '../../src/constants';
import { CollectionTransaction } from '../../src/types';

vi.mock('../../src/utils/scheduleImage', () => ({
  exportScheduleImage: vi.fn()
}));
import { exportScheduleImage } from '../../src/utils/scheduleImage';

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    internal: { pageSize: { height: 800 } }
  }))
}));

const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!.json;
const { schedule } = detectAndNormalizeSchedule(responseSample);
const [firstItemId, secondItemId] = schedule!.scheduleItems.map((item) => item.id);

const EXPORT_FORMAT_LABELS: Record<string, string> = {
  json: 'JSON',
  csv: 'CSV',
  pdf: 'PDF',
  html: 'HTML',
  png: 'PNG',
  svg: 'SVG'
};

const VIEW_JSON_FORMAT_LABELS: Record<string, string> = {
  policyAdmin: 'Policy Admin CosmosDB Document',
  rerates: 'Rerates CosmosDB Document',
  request: 'Payment Schedule Request (Amendment)',
  response: 'Payment Schedule Response'
};

function openExportMenu() {
  fireEvent.click(screen.getByLabelText('Choose export format'));
}

function selectFormat(format: string) {
  openExportMenu();
  fireEvent.click(screen.getByRole('menuitem', { name: EXPORT_FORMAT_LABELS[format] }));
}

function clickExportButton() {
  fireEvent.click(screen.getByRole('button', { name: /^Export as/ }));
}

function openViewJsonMenu() {
  fireEvent.click(screen.getByLabelText('Choose JSON view format'));
}

function selectViewJsonFormat(format: string) {
  openViewJsonMenu();
  fireEvent.click(screen.getByRole('menuitem', { name: VIEW_JSON_FORMAT_LABELS[format] }));
}

function clickViewJsonButton() {
  fireEvent.click(screen.getByRole('button', { name: /^View JSON as/ }));
}

describe('ScheduleDisplay', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(exportScheduleImage).mockReset();
    localStorage.clear();
    createObjectURL = vi.fn(() => 'blob:fake-url');
    revokeObjectURL = vi.fn();
    (globalThis.URL as any).createObjectURL = createObjectURL;
    (globalThis.URL as any).revokeObjectURL = revokeObjectURL;
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('defaults to "View JSON as Payment Schedule Response" and opens the modal showing the canonical response', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    expect(screen.getByRole('button', { name: 'View JSON as Payment Schedule Response' })).toBeInTheDocument();

    clickViewJsonButton();

    const modal = screen.getByText(/Schedule JSON/).closest('div')!.parentElement!;
    expect(within(modal).getByText(new RegExp(schedule!.id))).toBeInTheDocument();
    expect(within(modal).getByText(/"scheduleItems"/)).toBeInTheDocument();
  });

  it('opens a dropdown menu listing all 4 JSON view formats', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    openViewJsonMenu();

    Object.values(VIEW_JSON_FORMAT_LABELS).forEach((label) => {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument();
    });
  });

  it('changes the View JSON button label when a different format is chosen', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    selectViewJsonFormat('policyAdmin');

    expect(screen.getByRole('button', { name: 'View JSON as Policy Admin CosmosDB Document' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('shows the schedule re-serialized as a Policy Admin CosmosDB document (PascalCase, ScheduleItems)', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    selectViewJsonFormat('policyAdmin');
    clickViewJsonButton();

    const modal = screen.getByText(/Schedule JSON/).closest('div')!.parentElement!;
    expect(within(modal).getByText(/"PaymentScheduleId"/)).toBeInTheDocument();
    expect(within(modal).getByText(/"ScheduleItems"/)).toBeInTheDocument();
  });

  it('shows the schedule re-serialized as a Rerates CosmosDB document (PascalCase, Items)', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    selectViewJsonFormat('rerates');
    clickViewJsonButton();

    const modal = screen.getByText(/Schedule JSON/).closest('div')!.parentElement!;
    expect(within(modal).getByText(/"PaymentScheduleId"/)).toBeInTheDocument();
    expect(within(modal).getByText(/"Items"/)).toBeInTheDocument();
  });

  it('shows the schedule re-serialized as a Payment Schedule Request (amendment)', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    selectViewJsonFormat('request');
    clickViewJsonButton();

    const modal = screen.getByText(/Schedule JSON/).closest('div')!.parentElement!;
    expect(within(modal).getByText(/"scheduleStartDate"/)).toBeInTheDocument();
    expect(within(modal).getByText(/"netAmount"/)).toBeInTheDocument();
  });

  it('defaults to a single "Export as JSON" button when nothing is saved', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    expect(screen.getByRole('button', { name: 'Export as JSON' })).toBeInTheDocument();
  });

  it('restores the previously selected export format from localStorage into the button label', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEDULE_EXPORT_FORMAT, 'svg');
    render(<ScheduleDisplay schedule={schedule!} />);
    expect(screen.getByRole('button', { name: 'Export as SVG' })).toBeInTheDocument();
  });

  it('ignores an invalid saved export format and falls back to JSON', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEDULE_EXPORT_FORMAT, 'not-a-format');
    render(<ScheduleDisplay schedule={schedule!} />);
    expect(screen.getByRole('button', { name: 'Export as JSON' })).toBeInTheDocument();
  });

  it('opens a dropdown menu listing all 6 export formats', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    openExportMenu();

    Object.values(EXPORT_FORMAT_LABELS).forEach((label) => {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument();
    });
  });

  it('changes the export button\'s label and closes the menu when a format is chosen', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    selectFormat('csv');

    expect(screen.getByRole('button', { name: 'Export as CSV' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'JSON' })).not.toBeInTheDocument();
  });

  it('saves the selected export format to localStorage when changed', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    selectFormat('csv');
    expect(localStorage.getItem(STORAGE_KEYS.SCHEDULE_EXPORT_FORMAT)).toBe('csv');
  });

  it('closes the dropdown menu when clicking outside of it', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    openExportMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('exports JSON via the single Export button', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    clickExportButton();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json');
  });

  it('exports CSV via the single Export button after choosing it from the menu', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    selectFormat('csv');
    clickExportButton();

    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toContain('text/csv');
  });

  it('exports HTML via the single Export button after choosing it from the menu', () => {
    render(<ScheduleDisplay schedule={schedule!} />);
    selectFormat('html');
    clickExportButton();

    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/html');
  });

  it('exports a PNG via the scheduleImage util after choosing it from the menu', async () => {
    vi.mocked(exportScheduleImage).mockResolvedValueOnce(undefined);
    render(<ScheduleDisplay schedule={schedule!} />);
    selectFormat('png');
    clickExportButton();

    await waitFor(() => {
      expect(exportScheduleImage).toHaveBeenCalledWith(schedule, 'png');
    });
  });

  it('exports an SVG via the scheduleImage util after choosing it from the menu', async () => {
    vi.mocked(exportScheduleImage).mockResolvedValueOnce(undefined);
    render(<ScheduleDisplay schedule={schedule!} />);
    selectFormat('svg');
    clickExportButton();

    await waitFor(() => {
      expect(exportScheduleImage).toHaveBeenCalledWith(schedule, 'svg');
    });
  });

  it('exports a PDF via jsPDF after choosing it from the menu', async () => {
    const jsPDFModule = await import('jspdf');
    render(<ScheduleDisplay schedule={schedule!} />);
    selectFormat('pdf');
    clickExportButton();

    await waitFor(() => {
      expect(vi.mocked(jsPDFModule.default)).toHaveBeenCalled();
    });
  });

  it('shows a format-specific error message when an export fails', async () => {
    vi.mocked(exportScheduleImage).mockRejectedValueOnce(new Error('boom'));
    render(<ScheduleDisplay schedule={schedule!} />);
    selectFormat('png');
    clickExportButton();

    expect(await screen.findByText('Failed to export schedule as PNG. Please try again.')).toBeInTheDocument();
  });

  it('escapes HTML special characters in the HTML export to prevent injection', () => {
    const maliciousSchedule = {
      ...schedule!,
      id: '<script>alert(1)</script>',
      scheduleItems: [
        {
          ...schedule!.scheduleItems[0],
          taxesAndLevies: { '<img src=x onerror=alert(1)>': 1 }
        }
      ]
    };

    let capturedHtml = '';
    class CapturingBlob extends Blob {
      constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
        super(parts, options);
        capturedHtml = String(parts[0]);
      }
    }
    vi.stubGlobal('Blob', CapturingBlob);

    render(<ScheduleDisplay schedule={maliciousSchedule as any} />);
    selectFormat('html');
    clickExportButton();

    expect(capturedHtml).not.toContain('<script>alert(1)</script>');
    expect(capturedHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(capturedHtml).not.toContain('<img src=x onerror=alert(1)>');
    expect(capturedHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');

    vi.unstubAllGlobals();
  });

  it('renders a fallback message when no schedule is provided', () => {
    render(<ScheduleDisplay schedule={null as any} />);
    expect(screen.getByText('No schedule data available.')).toBeInTheDocument();
  });

  describe('Collections reconciliation', () => {
    const collections: CollectionTransaction[] = [
      {
        paymentScheduleItemIds: [firstItemId],
        amountDue: 620.93,
        collectionStatus: 'collected',
        transactionReference: 'REF-1',
        providerDetails: { processingDate: '2026-06-30T11:00:41+00:00' }
      },
      {
        paymentScheduleItemIds: [secondItemId],
        amountDue: 1,
        collectionStatus: 'rejected',
        transactionReference: 'REF-2',
        providerDetails: { processingDate: '2026-06-30T11:00:41+00:00', errorMessage: 'Not sufficient funds' }
      }
    ];

    it('does not show a Collections column or summary banner without a collections prop', () => {
      render(<ScheduleDisplay schedule={schedule!} />);
      expect(screen.queryByText('Collections', { selector: 'th' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Collections reconciliation:/)).not.toBeInTheDocument();
    });

    it('shows a summary banner and per-item status badges once collections are provided', () => {
      render(<ScheduleDisplay schedule={schedule!} collections={collections} />);

      expect(screen.getByText(/Collections reconciliation:/)).toHaveTextContent(
        '1 collected, 1 rejected, 0 refunded, 0 pending'
      );
      expect(screen.getByRole('button', { name: /Collected/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Rejected/ })).toBeInTheDocument();
    });

    it('opens a transaction detail modal when a status badge is clicked', () => {
      render(<ScheduleDisplay schedule={schedule!} collections={collections} />);

      fireEvent.click(screen.getByRole('button', { name: /Rejected/ }));

      expect(screen.getByText(/Collections history/)).toBeInTheDocument();
      expect(screen.getByText('REF-2')).toBeInTheDocument();
      expect(screen.getByText('Not sufficient funds')).toBeInTheDocument();
    });

    it('calls onClearCollections when the Clear button is clicked', () => {
      const onClearCollections = vi.fn();
      render(<ScheduleDisplay schedule={schedule!} collections={collections} onClearCollections={onClearCollections} />);

      fireEvent.click(screen.getByTitle('Clear loaded collections'));

      expect(onClearCollections).toHaveBeenCalledTimes(1);
    });
  });
});
