import { PaymentScheduleResponse, ScheduleItem, CollectionTransaction, ItemReconciliation } from '../types';
import {
  reconcileScheduleItems,
  getEffectiveSucceeded,
  getEffectiveCreatedDate
} from './reconcileCollections';

export type ScheduleImageFormat = 'png' | 'svg';

// Hex equivalents of the Tailwind utility classes used in ScheduleDisplay. html2canvas's
// CSS parser cannot resolve Tailwind v4's oklch()-based generated colors, so the exportable
// snapshot is built as a plain, inline-styled clone using these hardcoded values instead of
// capturing the live Tailwind-styled DOM directly.
const COLORS = {
  primary: '#79378b',
  primarySoft: 'rgba(121, 55, 139, 0.1)',
  gray50: '#f9fafb',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray900: '#111827',
  green100: '#dcfce7',
  yellow100: '#fef9c3',
  orange100: '#ffedd5',
  blue100: '#dbeafe',
  white: '#ffffff'
};

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatImageDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === '0001-01-01T00:00:00+00:00') return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime()) || date.getFullYear() <= 1) return '-';
  return date.toLocaleDateString('en-GB');
}

function rowBackgroundColor(item: ScheduleItem): string {
  if (Number(item.amountDue) < 0) return COLORS.blue100;
  if (item.adminFees && Object.keys(item.adminFees).length > 0) return COLORS.orange100;
  if (item.collectionType === 'proRata') return COLORS.yellow100;
  return COLORS.green100;
}

function summaryCard(title: string, value: string, opts?: { accent?: boolean }): string {
  const bg = opts?.accent ? COLORS.primarySoft : COLORS.gray50;
  const valueColor = opts?.accent ? COLORS.primary : COLORS.gray900;
  return `
    <div style="flex:1; background:${bg}; border-radius:8px; padding:16px; min-width:0;">
      <div style="font-size:13px; font-weight:600; color:${opts?.accent ? COLORS.primary : COLORS.gray900};">${title}</div>
      <div style="font-size:20px; font-weight:700; color:${valueColor}; margin-top:8px; word-break:break-all;">${value}</div>
    </div>
  `;
}

function legendSwatch(color: string, label: string): string {
  return `
    <span style="display:inline-flex; align-items:center; gap:8px; margin-right:24px;">
      <span style="display:inline-block; width:14px; height:14px; background:${color}; border-radius:3px;"></span>
      <span style="font-size:13px; color:${COLORS.gray500};">${label}</span>
    </span>
  `;
}

function tableHeaderCell(label: string): string {
  return `<th style="padding:10px 12px; text-align:left; font-size:11px; font-weight:600; color:${COLORS.gray500}; text-transform:uppercase; border-bottom:1px solid ${COLORS.gray200};">${label}</th>`;
}

function tableCell(content: string, bg?: string): string {
  return `<td style="padding:10px 12px; font-size:13px; color:${COLORS.gray900}; border-bottom:1px solid ${COLORS.gray200}; background:${bg || COLORS.white}; white-space:nowrap;">${content}</td>`;
}

function statusLabel(succeeded: boolean | null): string {
  if (succeeded === null) return '—';
  return succeeded ? '✓' : '✕';
}

const COLLECTIONS_STATUS_LABELS: Record<ItemReconciliation['status'], string> = {
  collected: 'Collected',
  rejected: 'Rejected',
  refunded: 'Refunded',
  pending: 'Pending'
};

function collectionsLabel(entry: ItemReconciliation | undefined): string {
  if (!entry) return '-';
  const label = COLLECTIONS_STATUS_LABELS[entry.status];
  return entry.wasRetried ? `${label} (retried)` : label;
}

/**
 * Builds a standalone, plain-inline-style HTML clone of the schedule summary/legend/table
 * suitable for html2canvas capture (no external stylesheet/class dependency). When
 * `collections` is supplied, the Status/Created columns reflect the same Collections-derived
 * values shown on screen, and a Collections column is appended.
 */
export function buildPrintableScheduleNode(
  schedule: PaymentScheduleResponse,
  collections?: CollectionTransaction[] | null
): HTMLDivElement {
  const scheduleItems = schedule.scheduleItems || [];
  const totalAmount = scheduleItems.reduce((sum, item) => sum + Number(item?.amountDue ?? 0), 0);
  const reconciliation = collections && collections.length > 0 ? reconcileScheduleItems(scheduleItems, collections) : null;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-99999px';
  container.style.width = '1400px';
  container.style.background = COLORS.white;
  container.style.padding = '24px';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';

  const rows = scheduleItems
    .map((item, index) => {
      const bg = rowBackgroundColor(item);
      const taxes = Object.entries(item.taxesAndLevies || {})
        .map(([key, value]) => `${escapeHtml(key)}: €${Number(value || 0).toFixed(2)}`)
        .join('<br/>') || '-';
      const fees = Object.entries(item.adminFees || {})
        .map(([key, value]) => `${escapeHtml(key)}: €${Number(value.amountDue || 0).toFixed(2)}`)
        .join('<br/>') || '-';
      const { value: createdDate } = getEffectiveCreatedDate(item, reconciliation);
      const { value: succeeded } = getEffectiveSucceeded(item, reconciliation);

      return `
        <tr>
          ${tableCell(String(index), bg)}
          ${tableCell(`${formatImageDate(item.periodStartDate)} - ${formatImageDate(item.periodEndDate)}`)}
          ${tableCell(formatImageDate(item.dueDate))}
          ${tableCell(`€${Number(item?.netAmount ?? 0).toFixed(2)}`)}
          ${tableCell(taxes)}
          ${tableCell(fees)}
          ${tableCell(`€${Number(item?.amountDue ?? 0).toFixed(2)}`)}
          ${tableCell(createdDate ? formatImageDate(createdDate) : '-')}
          ${tableCell(statusLabel(succeeded))}
          ${reconciliation ? tableCell(escapeHtml(collectionsLabel(reconciliation.get(item.id)))) : ''}
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="display:flex; gap:16px; margin-bottom:16px;">
      ${summaryCard('Total Amount', `€${totalAmount.toFixed(2)}`, { accent: true })}
      ${summaryCard('Collection Day', schedule.collectionFrequency === 'annual' ? '-' : String(schedule.collectionDay ?? '-'))}
    </div>
    <div style="display:flex; gap:16px; margin-bottom:24px;">
      ${summaryCard('Cover Period', `${formatImageDate(schedule.coverStartDate)} - ${formatImageDate(schedule.coverEndDate)}`)}
      ${summaryCard('Schedule ID', escapeHtml(schedule.id || '-'))}
    </div>
    <div style="margin-bottom:24px;">
      <div style="font-size:13px; font-weight:600; color:${COLORS.gray900}; margin-bottom:8px;">Legend</div>
      <div>
        ${legendSwatch(COLORS.green100, 'Full Collection')}
        ${legendSwatch(COLORS.yellow100, 'Pro Rata Collection')}
        ${legendSwatch(COLORS.orange100, 'Admin Fee')}
        ${legendSwatch(COLORS.blue100, 'Refund')}
      </div>
    </div>
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          ${tableHeaderCell('Index')}
          ${tableHeaderCell('Period')}
          ${tableHeaderCell('Due Date')}
          ${tableHeaderCell('Net Amount')}
          ${tableHeaderCell('Taxes & Levies')}
          ${tableHeaderCell('Admin Fees')}
          ${tableHeaderCell('Total')}
          ${tableHeaderCell('Created')}
          ${tableHeaderCell('Status')}
          ${reconciliation ? tableHeaderCell('Collections') : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  return container;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Renders the schedule to a canvas (via a plain-styled off-screen clone, since html2canvas
 * cannot parse Tailwind v4's oklch() colors) and downloads it as PNG, or as an SVG that
 * embeds the rasterized PNG (a full vector re-creation of arbitrary layout isn't practical).
 */
export async function exportScheduleImage(
  schedule: PaymentScheduleResponse,
  format: ScheduleImageFormat,
  collections?: CollectionTransaction[] | null
): Promise<void> {
  const node = buildPrintableScheduleNode(schedule, collections);
  document.body.appendChild(node);

  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2 });
    const filename = `schedule-${schedule?.id || 'export'}.${format}`;

    if (format === 'png') {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create PNG blob'))), 'image/png');
      });
      triggerDownload(blob, filename);
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}" /></svg>`;
      triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), filename);
    }
  } finally {
    document.body.removeChild(node);
  }
}
