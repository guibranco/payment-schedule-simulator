import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Euro,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileCode,
  Image,
  Shapes,
  ChevronDown,
  Check,
  X,
  MinusCircle,
  ListChecks,
  CheckCircle2,
  XCircle,
  Undo2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { PaymentScheduleResponse, ScheduleItem, CollectionTransaction, ReconciledStatus } from '../types';
import { exportScheduleImage } from '../utils/scheduleImage';
import { convertResponseToFormat, ScheduleFormat } from '../utils/scheduleDetector';
import { STORAGE_KEYS } from '../constants';
import { reconcileScheduleItems, summarizeReconciliation } from '../utils/reconcileCollections';
import Modal from './Modal';

interface Props {
  schedule: PaymentScheduleResponse;
  onStatusChange?: (index: number) => void;
  collections?: CollectionTransaction[] | null;
  onClearCollections?: () => void;
}

type ExportFormat = 'json' | 'csv' | 'pdf' | 'html' | 'png' | 'svg';
type IconComponent = React.ComponentType<{ className?: string }>;

const RECONCILIATION_BADGES: Record<ReconciledStatus, { label: string; className: string; Icon: IconComponent }> = {
  collected: { label: 'Collected', className: 'bg-green-100 text-green-800', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800', Icon: XCircle },
  refunded: { label: 'Refunded', className: 'bg-blue-100 text-blue-800', Icon: Undo2 },
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-600', Icon: Clock }
};

const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  json: 'JSON',
  csv: 'CSV',
  pdf: 'PDF',
  html: 'HTML',
  png: 'PNG',
  svg: 'SVG'
};

const EXPORT_FORMAT_ICONS: Record<ExportFormat, IconComponent> = {
  json: FileJson,
  csv: FileSpreadsheet,
  pdf: FileText,
  html: FileCode,
  png: Image,
  svg: Shapes
};

const EXPORT_FORMATS = Object.keys(EXPORT_FORMAT_LABELS) as ExportFormat[];

function isExportFormat(value: string | null): value is ExportFormat {
  return !!value && (EXPORT_FORMATS as string[]).includes(value);
}

const VIEW_JSON_FORMAT_LABELS: Record<ScheduleFormat, string> = {
  policyAdmin: 'Policy Admin CosmosDB Document',
  rerates: 'Rerates CosmosDB Document',
  request: 'Payment Schedule Request (Amendment)',
  response: 'Payment Schedule Response'
};

const VIEW_JSON_FORMATS: ScheduleFormat[] = ['policyAdmin', 'rerates', 'request', 'response'];

/**
 * Closes an open dropdown when clicking outside of the given container ref.
 */
function useCloseOnOutsideClick(ref: React.RefObject<HTMLElement | null>, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, ref, onClose]);
}

/**
 * Display a schedule with detailed items and options to download data in JSON or CSV format.
 *
 * This component renders a comprehensive view of a schedule, including total amount, collection day,
 * cover period, and other relevant details. It also provides functionality to download the schedule
 * data as either JSON or CSV files. The table displays individual schedule items with various attributes
 * such as due date, net amount, taxes, admin fees, and status icons. Additionally, a modal can be opened
 * to view the raw JSON representation of the schedule.
 *
 * @param schedule - An object containing the schedule details including items, period dates, and amounts.
 * @param onStatusChange - A callback function that triggers when a status icon is clicked, allowing for status changes.
 */
export default function ScheduleDisplay({ schedule, onStatusChange, collections, onClearCollections }: Props) {
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [reconciliationDetailItemId, setReconciliationDetailItemId] = useState<string | null>(null);
  const [isViewJsonMenuOpen, setIsViewJsonMenuOpen] = useState(false);
  const [viewJsonFormat, setViewJsonFormat] = useState<ScheduleFormat>('response');
  const viewJsonMenuRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(viewJsonMenuRef, isViewJsonMenuOpen, () => setIsViewJsonMenuOpen(false));

  const selectViewJsonFormat = (format: ScheduleFormat) => {
    setViewJsonFormat(format);
    setIsViewJsonMenuOpen(false);
  };

  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULE_EXPORT_FORMAT);
    return isExportFormat(saved) ? saved : 'json';
  });
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(exportMenuRef, isExportMenuOpen, () => setIsExportMenuOpen(false));

  const selectExportFormat = (format: ExportFormat) => {
    setExportFormat(format);
    localStorage.setItem(STORAGE_KEYS.SCHEDULE_EXPORT_FORMAT, format);
    setIsExportMenuOpen(false);
  };

  const scheduleItems = useMemo(() => schedule?.scheduleItems || [], [schedule]);

  const totalAmount = scheduleItems.length > 0
    ? scheduleItems.reduce((sum, item) => sum + Number(item?.amountDue ?? 0), 0)
    : 0;

  const reconciliation = useMemo(
    () => (collections && collections.length > 0 ? reconcileScheduleItems(scheduleItems, collections) : null),
    [scheduleItems, collections]
  );
  const reconciliationSummary = useMemo(
    () => (reconciliation ? summarizeReconciliation(reconciliation) : null),
    [reconciliation]
  );
  const reconciliationDetail = reconciliationDetailItemId ? reconciliation?.get(reconciliationDetailItemId) : null;

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '0001-01-01T00:00:00+00:00') return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime()) || date.getFullYear() <= 1) return '-';
    return date.toLocaleDateString('en-GB');
  };

  const getIndexBackgroundColor = (item: any) => {
    if (Number(item.amountDue) < 0) return 'bg-blue-100';
    if (item.adminFees && Object.keys(item.adminFees).length > 0) return 'bg-orange-100';
    if (item.collectionType === 'proRata') return 'bg-yellow-100';
    return 'bg-green-100';
  };

  /**
   * Falls back to the Collections-reconciled outcome for the Status column when the
   * schedule item itself has no recorded succeeded value (null) — a refund is treated
   * as an unsuccessful collection since it reverses a prior payment.
   */
  const getEffectiveSucceeded = (item: ScheduleItem): { value: boolean | null; derived: boolean } => {
    if (item.succeeded !== null) return { value: item.succeeded, derived: false };

    const entry = reconciliation?.get(item.id);
    if (!entry || entry.status === 'pending') return { value: null, derived: false };

    return { value: entry.status === 'collected', derived: true };
  };

  /**
   * Falls back to the latest matching Collections transaction's date when the schedule
   * item itself has no collectionItemCreatedDate recorded.
   */
  const getEffectiveCreatedDate = (item: ScheduleItem): { value: string | undefined; derived: boolean } => {
    if (item.collectionItemCreatedDate) return { value: item.collectionItemCreatedDate, derived: false };

    const txn = reconciliation?.get(item.id)?.latestTransaction;
    const derivedDate = txn?.providerDetails?.processingDate || txn?.valueDate || txn?.dueDate;
    return { value: derivedDate, derived: !!derivedDate };
  };


  /**
   * Generates and downloads a CSV file containing schedule item data.
   *
   * This function constructs a CSV with headers and rows extracted from schedule items.
   * It calculates various date-related fields, sums up admin fees and taxes,
   * and formats the data appropriately before creating a downloadable CSV link.
   *
   * @returns void
   */
  const downloadCsv = () => {
    const headers = [
      'Index',
      'PeriodStartDate',
      'PeriodEndDate',
      'DaysDueDateBeforePeriodStart',
      'DaysInPeriod',
      'DaysRemainingInPeriod',
      'DueDate',
      'AmountDue',
      'AdminFeesTotal',
      'AdminFees',
      'NetPremium',
      'TaxesAndLeviesTotal',
      'TaxesAndLevies',
      'CollectionItemCreatedDate',
      'Succeeded',
      'AdjustmentDate',
      'HasOriginalItem',
      'Type'
    ];
    
    const rows = scheduleItems.map((item, index) => {
      const periodStart = new Date(item.periodStartDate);
      const periodEnd = new Date(item.periodEndDate);
      const dueDate = new Date(item.dueDate);
      
      // Calculate days between due date and period start
      const daysDueDateBeforePeriodStart = Math.floor((periodStart.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate days in period
      const daysInPeriod = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Calculate days remaining in period (from current date)
      const now = new Date();
      const daysRemainingInPeriod = Math.floor((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const adminFeesTotal = Object.values(item.adminFees || {}).reduce((sum, fee) => sum + (fee.amountDue || 0), 0);
      const taxesAndLeviesTotal = Object.values(item.taxesAndLevies || {}).reduce((sum, value) => sum + (value || 0), 0);

      const adminFeesStr = Object.entries(item.adminFees || {})
        .map(([key, value]) => `${key}|${value.amountDue}|${value.taxAmount}`)
        .join(':');

      const taxesAndLeviesStr = Object.entries(item.taxesAndLevies || {})
        .map(([key, value]) => `${key}|${value}`)
        .join(':');

      return [
        index,
        formatDate(item.periodStartDate),
        formatDate(item.periodEndDate),
        daysDueDateBeforePeriodStart,
        daysInPeriod,
        daysRemainingInPeriod,
        formatDate(item.dueDate),
        item.amountDue,
        adminFeesTotal,
        adminFeesStr || '',
        item.netAmount,
        taxesAndLeviesTotal,
        taxesAndLeviesStr || '',
        item.collectionItemCreatedDate ? formatDate(item.collectionItemCreatedDate) : '',
        item.succeeded?.toString() || '',
        item.adjustmentDate ? formatDate(item.adjustmentDate) : '',
        (item.originalItem !== undefined && item.originalItem !== null).toString(),
        item.collectionType
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${schedule?.id || 'export'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadJson = () => {
    const dataStr = JSON.stringify(schedule, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${schedule?.id || 'export'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (value: unknown): string =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const downloadHtml = () => {
    const styles = `
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; }
        table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
        th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
        th { background-color: #f9fafb; }
        .header { margin-bottom: 2rem; }
        .total { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; }
      </style>
    `;

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Payment Schedule ${escapeHtml(schedule.id)}</title>
          ${styles}
        </head>
        <body>
          <div class="header">
            <h1>Payment Schedule Details</h1>
            <p>Schedule ID: ${escapeHtml(schedule.id)}</p>
            <p>Collection Frequency: ${escapeHtml(schedule.collectionFrequency)}</p>
            <p>Cover Period: ${new Date(schedule.coverStartDate).toLocaleDateString()} - ${new Date(schedule.coverEndDate).toLocaleDateString()}</p>
            <div class="total">Total Amount: €${totalAmount.toFixed(2)}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Due Date</th>
                <th>Net Amount</th>
                <th>Taxes & Levies</th>
                <th>Admin Fees</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${scheduleItems.map(item => `
                <tr>
                  <td>${new Date(item.periodStartDate).toLocaleDateString()} - ${new Date(item.periodEndDate).toLocaleDateString()}</td>
                  <td>${new Date(item.dueDate).toLocaleDateString()}</td>
                  <td>€${item.netAmount.toFixed(2)}</td>
                  <td>${Object.entries(item.taxesAndLevies || {}).map(([key, value]) =>
                    `${escapeHtml(key)}: €${value.toFixed(2)}`).join('<br>')}</td>
                  <td>${Object.entries(item.adminFees || {}).map(([key, value]) =>
                    `${escapeHtml(key)}: €${value.amountDue.toFixed(2)}`).join('<br>')}</td>
                  <td>€${item.amountDue.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${schedule.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    const jsPDFModule = await import('jspdf');
    const doc = new jsPDFModule.default();

    doc.setFontSize(16);
    doc.text('Payment Schedule Details', 20, 20);

    doc.setFontSize(12);
    doc.text(`Schedule ID: ${schedule.id}`, 20, 30);
    doc.text(`Collection Frequency: ${schedule.collectionFrequency}`, 20, 40);
    doc.text(`Cover Period: ${new Date(schedule.coverStartDate).toLocaleDateString()} - ${new Date(schedule.coverEndDate).toLocaleDateString()}`, 20, 50);
    doc.text(`Total Amount: €${totalAmount.toFixed(2)}`, 20, 60);

    let y = 80;
    const itemHeight = 10;
    const pageHeight = doc.internal.pageSize.height;

    scheduleItems.forEach((item, index) => {
      if (y + itemHeight > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      doc.text(`${index + 1}. Due Date: ${new Date(item.dueDate).toLocaleDateString()}`, 20, y);
      doc.text(`Amount: €${item.amountDue.toFixed(2)}`, 20, y + 5);

      y += itemHeight;
    });

    doc.save(`schedule-${schedule.id}.pdf`);
  };

  const handleExport = async () => {
    setExportError(null);
    try {
      switch (exportFormat) {
        case 'json':
          downloadJson();
          break;
        case 'csv':
          downloadCsv();
          break;
        case 'html':
          downloadHtml();
          break;
        case 'pdf':
          await downloadPdf();
          break;
        case 'png':
        case 'svg':
          await exportScheduleImage(schedule, exportFormat);
          break;
      }
    } catch (err) {
      console.error('Error exporting schedule:', err);
      setExportError(`Failed to export schedule as ${EXPORT_FORMAT_LABELS[exportFormat]}. Please try again.`);
    }
  };

  const getStatusIcon = (succeeded: boolean | null, index: number, derived: boolean = false) => {
    const icon = succeeded === null ?
      <MinusCircle className="w-5 h-5 text-gray-400" /> :
      succeeded ?
        <Check className="w-5 h-5 text-green-500" /> :
        <X className="w-5 h-5 text-red-500" />;

    const content = derived ? (
      <span className="inline-flex items-center gap-1">
        {icon}
        <span className="text-[10px] font-medium text-indigo-600 uppercase">auto</span>
      </span>
    ) : icon;

    const title = derived
      ? 'Derived from Collections reconciliation — this schedule item has no recorded status'
      : 'Click to change status';

    return onStatusChange ? (
      <button
        onClick={() => onStatusChange(index)}
        className="hover:bg-gray-100 p-1 rounded-full transition-colors"
        title={title}
      >
        {content}
      </button>
    ) : (
      <span title={derived ? title : undefined}>{content}</span>
    );
  };

  if (!schedule) {
    return <div className="p-4 text-gray-600">No schedule data available.</div>;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <div className="flex justify-end flex-wrap gap-2 mb-6">
          <div className="relative inline-flex" ref={viewJsonMenuRef}>
            <button
              onClick={() => setIsJsonModalOpen(true)}
              className="flex items-center gap-2 pl-4 pr-3 py-2 bg-gray-100 text-gray-700 rounded-l-md hover:bg-gray-200"
              title={`View schedule JSON as ${VIEW_JSON_FORMAT_LABELS[viewJsonFormat]}`}
            >
              <FileJson className="w-5 h-5" />
              View JSON as {VIEW_JSON_FORMAT_LABELS[viewJsonFormat]}
            </button>
            <button
              onClick={() => setIsViewJsonMenuOpen((open) => !open)}
              className="flex items-center px-2 py-2 bg-gray-100 text-gray-700 rounded-r-md hover:bg-gray-200 border-l border-gray-300"
              aria-label="Choose JSON view format"
              aria-haspopup="menu"
              aria-expanded={isViewJsonMenuOpen}
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {isViewJsonMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10 overflow-hidden"
              >
                {VIEW_JSON_FORMATS.map((format) => (
                  <button
                    key={format}
                    role="menuitem"
                    onClick={() => selectViewJsonFormat(format)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                      format === viewJsonFormat ? 'font-semibold text-primary' : 'text-gray-700'
                    }`}
                  >
                    {VIEW_JSON_FORMAT_LABELS[format]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative inline-flex" ref={exportMenuRef}>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 pl-4 pr-3 py-2 bg-primary text-white rounded-l-md hover:bg-primary-dark"
              title={`Export schedule as ${EXPORT_FORMAT_LABELS[exportFormat]}`}
            >
              {(() => {
                const CurrentExportIcon = EXPORT_FORMAT_ICONS[exportFormat];
                return <CurrentExportIcon className="w-5 h-5" />;
              })()}
              Export as {EXPORT_FORMAT_LABELS[exportFormat]}
            </button>
            <button
              onClick={() => setIsExportMenuOpen((open) => !open)}
              className="flex items-center px-2 py-2 bg-primary text-white rounded-r-md hover:bg-primary-dark border-l border-primary-light"
              aria-label="Choose export format"
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {isExportMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10 overflow-hidden"
              >
                {EXPORT_FORMATS.map((format) => {
                  const Icon = EXPORT_FORMAT_ICONS[format];
                  return (
                    <button
                      key={format}
                      role="menuitem"
                      onClick={() => selectExportFormat(format)}
                      className={`w-full flex items-center gap-2 text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        format === exportFormat ? 'font-semibold text-primary' : 'text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {EXPORT_FORMAT_LABELS[format]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {exportError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md">
            {exportError}
          </div>
        )}

        <div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-primary/10 rounded-lg">
              <h3 className="text-sm font-medium text-primary">Total Amount</h3>
              <p className="mt-2 flex items-center text-2xl font-semibold text-primary">
                <Euro className="w-5 h-5 mr-1" />
                {totalAmount.toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900">Collection Day</h3>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{schedule.collectionDay}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900">Cover Period</h3>
              <p className="mt-2 text-sm font-medium text-gray-900">
                {formatDate(schedule.coverStartDate)} - {formatDate(schedule.coverEndDate)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900">Schedule ID</h3>
              <p className="mt-2 text-sm font-medium text-gray-900 break-all">
                {schedule.id}
              </p>
            </div>
          </div>

        {reconciliationSummary && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-indigo-900">
              <ListChecks className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">
                Collections reconciliation: {reconciliationSummary.collected} collected,{' '}
                {reconciliationSummary.rejected} rejected, {reconciliationSummary.refunded} refunded,{' '}
                {reconciliationSummary.pending} pending
                {reconciliationSummary.mismatches > 0 && (
                  <span className="text-amber-700"> — {reconciliationSummary.mismatches} flagged for review</span>
                )}
              </span>
            </div>
            {onClearCollections && (
              <button
                type="button"
                onClick={onClearCollections}
                className="flex items-center gap-1 text-sm text-indigo-700 hover:text-indigo-900 transition-colors"
                title="Clear loaded collections"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded"></div>
              <span className="text-sm text-gray-600">Full Collection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 rounded"></div>
              <span className="text-sm text-gray-600">Pro Rata Collection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 rounded"></div>
              <span className="text-sm text-gray-600">Admin Fee</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 rounded"></div>
              <span className="text-sm text-gray-600">Refund</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Index</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxes & Levies</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Fees</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection Item Created Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adjustment Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Has Original Item</th>
                {reconciliation && (
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collections</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scheduleItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className={`px-3 py-3 whitespace-nowrap text-sm text-gray-900 ${getIndexBackgroundColor(item)}`}>
                    {index}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.periodStartDate)} - {formatDate(item.periodEndDate)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.dueDate)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    €{Number(item?.netAmount ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.taxesAndLevies && Object.entries(item.taxesAndLevies).length > 0 ? (
                      Object.entries(item.taxesAndLevies).map(([key, value]) => (
                        <div key={key}>
                          {key}: €{Number(value || 0).toFixed(2)}
                        </div>
                      ))
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.adminFees && Object.entries(item.adminFees).length > 0 ? (
                      Object.entries(item.adminFees).map(([key, value]) => (
                        <div key={key}>
                          {key}: €{Number(value.amountDue || 0).toFixed(2)}
                          {Number(value.taxAmount || 0) > 0 && ` + €${Number(value.taxAmount || 0).toFixed(2)} tax`}
                        </div>
                      ))
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    €{Number(item?.amountDue ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {(() => {
                      const { value, derived } = getEffectiveCreatedDate(item);
                      if (!value) return '-';
                      return (
                        <span
                          className={derived ? 'italic text-gray-500' : undefined}
                          title={derived ? 'Derived from Collections reconciliation — not recorded on the schedule item' : undefined}
                        >
                          {formatDate(value)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {(() => {
                      const { value, derived } = getEffectiveSucceeded(item);
                      return getStatusIcon(value, index, derived);
                    })()}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.adjustmentDate)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                    {item.originalItem ? 'Yes' : 'No'}
                  </td>
                  {reconciliation && (
                    <td className="px-3 py-3 whitespace-nowrap text-sm">
                      {(() => {
                        const entry = reconciliation.get(item.id);
                        if (!entry) return '-';
                        const { label, className, Icon } = RECONCILIATION_BADGES[entry.status];
                        const hasIssue = entry.amountMismatch || entry.statusMismatch;
                        return (
                          <button
                            type="button"
                            onClick={() => setReconciliationDetailItemId(item.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${className}`}
                            title={
                              entry.transactions.length > 0
                                ? `${entry.transactions.length} matching transaction(s) — click for details`
                                : 'No matching Collections transaction found — click for details'
                            }
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                            {hasIssue && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                          </button>
                        );
                      })()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      <Modal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        title={`Schedule JSON — ${VIEW_JSON_FORMAT_LABELS[viewJsonFormat]}`}
      >
        <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto">
          <code>{JSON.stringify(convertResponseToFormat(schedule, viewJsonFormat), null, 2)}</code>
        </pre>
      </Modal>

      <Modal
        isOpen={reconciliationDetailItemId !== null}
        onClose={() => setReconciliationDetailItemId(null)}
        title={`Collections history — item ${reconciliationDetailItemId ?? ''}`}
      >
        {!reconciliationDetail || reconciliationDetail.transactions.length === 0 ? (
          <p className="text-gray-600">No matching Collections Service transactions found for this schedule item.</p>
        ) : (
          <div className="space-y-3">
            {(reconciliationDetail.amountMismatch || reconciliationDetail.statusMismatch) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  {reconciliationDetail.statusMismatch && (
                    <p>The schedule item's recorded status doesn't match the latest Collections outcome.</p>
                  )}
                  {reconciliationDetail.amountMismatch && (
                    <p>The collected amount differs from this item's amount due.</p>
                  )}
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Processed</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Reference</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reconciliationDetail.transactions.map((txn, i) => (
                    <tr key={txn.transactionReference || i}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(txn.providerDetails?.processingDate || txn.valueDate || txn.dueDate || '')}
                      </td>
                      <td className="px-3 py-2 capitalize">{txn.collectionStatus}</td>
                      <td className="px-3 py-2 whitespace-nowrap">€{Number(txn.amountDue ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2 break-all">{txn.transactionReference || '-'}</td>
                      <td className="px-3 py-2">{txn.providerDetails?.errorMessage || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}