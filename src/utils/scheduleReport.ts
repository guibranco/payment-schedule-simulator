import type {
  PaymentScheduleResponse,
  ScheduleItem,
  CollectionTransaction,
  ItemReconciliation,
} from "../types";
import { isCollectionType } from "./collectionType";
import {
  reconcileScheduleItems,
  getEffectiveSucceeded,
  getEffectiveCreatedDate,
} from "./reconcileCollections";

// Hex equivalents of the Tailwind theme (tailwind.config.js) and utility classes used in
// ScheduleDisplay. Exports can't rely on the app's stylesheet: html2canvas's CSS parser cannot
// resolve Tailwind v4's oklch()-based generated colors, the standalone HTML export has no
// stylesheet at all, and jsPDF only takes RGB — so every export renders from these values.
export const REPORT_COLORS = {
  primary: "#79378b",
  primaryDark: "#632d72",
  primarySoft: "rgba(121, 55, 139, 0.1)",
  primarySoftHex: "#f2ebf3",
  secondary: "#93cd3f",
  secondaryDark: "#83b737",
  gray50: "#f9fafb",
  gray200: "#e5e7eb",
  gray500: "#6b7280",
  gray900: "#111827",
  green100: "#dcfce7",
  green800: "#166534",
  yellow100: "#fef9c3",
  orange100: "#ffedd5",
  blue100: "#dbeafe",
  blue800: "#1e40af",
  red100: "#fee2e2",
  red800: "#991b1b",
  white: "#ffffff",
};

export const ROW_TYPE_LEGEND: Array<{ color: string; label: string }> = [
  { color: REPORT_COLORS.green100, label: "Full Collection" },
  { color: REPORT_COLORS.yellow100, label: "Pro Rata Collection" },
  { color: REPORT_COLORS.orange100, label: "Admin Fee" },
  { color: REPORT_COLORS.blue100, label: "Refund" },
];

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatReportDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "0001-01-01T00:00:00+00:00") return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime()) || date.getFullYear() <= 1) return "-";
  return date.toLocaleDateString("en-GB");
}

/** Same precedence as the on-screen index cell: refund, then admin fee, then pro rata, else full. */
export function rowTypeColor(item: ScheduleItem): string {
  if (Number(item.amountDue) < 0) return REPORT_COLORS.blue100;
  if (item.adminFees && Object.keys(item.adminFees).length > 0)
    return REPORT_COLORS.orange100;
  if (isCollectionType(item, "proRata")) return REPORT_COLORS.yellow100;
  return REPORT_COLORS.green100;
}

const COLLECTIONS_STATUS_LABELS: Record<ItemReconciliation["status"], string> =
  {
    collected: "Collected",
    rejected: "Rejected",
    refunded: "Refunded",
    pending: "Pending",
  };

const COLLECTIONS_STATUS_COLORS: Record<
  ItemReconciliation["status"],
  { bg: string; fg: string }
> = {
  collected: { bg: REPORT_COLORS.green100, fg: REPORT_COLORS.green800 },
  rejected: { bg: REPORT_COLORS.red100, fg: REPORT_COLORS.red800 },
  refunded: { bg: REPORT_COLORS.blue100, fg: REPORT_COLORS.blue800 },
  pending: { bg: REPORT_COLORS.gray50, fg: REPORT_COLORS.gray500 },
};

export function collectionsLabel(
  entry: ItemReconciliation | undefined,
): string {
  if (!entry) return "-";
  const label = COLLECTIONS_STATUS_LABELS[entry.status];
  return entry.wasRetried ? `${label} (retried)` : label;
}

export function collectionsColors(
  entry: ItemReconciliation | undefined,
): { bg: string; fg: string } | null {
  return entry ? COLLECTIONS_STATUS_COLORS[entry.status] : null;
}

/** One normalized, display-ready table row shared by every export format. */
export interface ReportRow {
  index: number;
  rowColor: string;
  period: string;
  dueDate: string;
  netAmount: string;
  taxes: string[];
  fees: string[];
  total: string;
  created: string;
  succeeded: boolean | null;
  collections: ItemReconciliation | undefined;
}

export interface ScheduleReport {
  rows: ReportRow[];
  totalAmount: number;
  hasCollections: boolean;
}

/**
 * Resolves each schedule item into display values once, applying the Collections-derived
 * Status/Created overrides when collections are supplied, so all exports agree with the screen.
 */
export function buildScheduleReport(
  schedule: PaymentScheduleResponse,
  collections?: CollectionTransaction[] | null,
): ScheduleReport {
  const scheduleItems = schedule.scheduleItems || [];
  const reconciliation =
    collections && collections.length > 0
      ? reconcileScheduleItems(scheduleItems, collections)
      : null;

  const rows = scheduleItems.map((item, index) => ({
    index,
    rowColor: rowTypeColor(item),
    period: `${formatReportDate(item.periodStartDate)} - ${formatReportDate(item.periodEndDate)}`,
    dueDate: formatReportDate(item.dueDate),
    netAmount: `€${Number(item?.netAmount ?? 0).toFixed(2)}`,
    taxes: Object.entries(item.taxesAndLevies || {}).map(
      ([key, value]) => `${key}: €${Number(value || 0).toFixed(2)}`,
    ),
    fees: Object.entries(item.adminFees || {}).map(
      ([key, value]) => `${key}: €${Number(value.amountDue || 0).toFixed(2)}`,
    ),
    total: `€${Number(item?.amountDue ?? 0).toFixed(2)}`,
    created: (() => {
      const { value } = getEffectiveCreatedDate(item, reconciliation);
      return value ? formatReportDate(value) : "-";
    })(),
    succeeded: getEffectiveSucceeded(item, reconciliation).value,
    collections: reconciliation?.get(item.id),
  }));

  return {
    rows,
    totalAmount: scheduleItems.reduce(
      (sum, item) => sum + Number(item?.amountDue ?? 0),
      0,
    ),
    hasCollections: reconciliation !== null,
  };
}

function statusSymbol(succeeded: boolean | null): string {
  if (succeeded === null) return "—";
  return succeeded ? "✓" : "✕";
}

function statusColor(succeeded: boolean | null): string {
  if (succeeded === null) return REPORT_COLORS.gray500;
  return succeeded ? REPORT_COLORS.green800 : REPORT_COLORS.red800;
}

function summaryCard(
  title: string,
  value: string,
  opts?: { accent?: boolean },
): string {
  const bg = opts?.accent ? REPORT_COLORS.primarySoft : REPORT_COLORS.gray50;
  const valueColor = opts?.accent
    ? REPORT_COLORS.primary
    : REPORT_COLORS.gray900;
  const border = opts?.accent ? REPORT_COLORS.primary : REPORT_COLORS.gray200;
  return `
    <div style="flex:1; background:${bg}; border-left:4px solid ${border}; border-radius:8px; padding:16px; min-width:0;">
      <div style="font-size:13px; font-weight:600; color:${opts?.accent ? REPORT_COLORS.primary : REPORT_COLORS.gray900};">${title}</div>
      <div style="font-size:20px; font-weight:700; color:${valueColor}; margin-top:8px; word-break:break-all;">${value}</div>
    </div>
  `;
}

function legendSwatch(color: string, label: string): string {
  return `
    <span style="display:inline-flex; align-items:center; gap:8px; margin-right:24px;">
      <span style="display:inline-block; width:14px; height:14px; background:${color}; border:1px solid ${REPORT_COLORS.gray200}; border-radius:3px;"></span>
      <span style="font-size:13px; color:${REPORT_COLORS.gray500};">${label}</span>
    </span>
  `;
}

function tableHeaderCell(label: string): string {
  return `<th style="padding:10px 12px; text-align:left; font-size:11px; font-weight:700; color:${REPORT_COLORS.white}; background:${REPORT_COLORS.primary}; text-transform:uppercase; letter-spacing:0.03em;">${label}</th>`;
}

function tableCell(
  content: string,
  opts?: { bg?: string; color?: string; bold?: boolean },
): string {
  return `<td style="padding:10px 12px; font-size:13px; color:${opts?.color || REPORT_COLORS.gray900}; ${opts?.bold ? "font-weight:700; " : ""}border-bottom:1px solid ${REPORT_COLORS.gray200}; background:${opts?.bg || "transparent"}; white-space:nowrap;">${content}</td>`;
}

function collectionsCell(entry: ItemReconciliation | undefined): string {
  const colors = collectionsColors(entry);
  const label = escapeHtml(collectionsLabel(entry));
  if (!colors) return tableCell(label);
  return tableCell(
    `<span style="display:inline-block; padding:2px 10px; border-radius:9999px; background:${colors.bg}; color:${colors.fg}; font-weight:600; font-size:12px;">${label}</span>`,
  );
}

/**
 * Builds the inline-styled report markup (brand header, summary cards, legend, colour-coded
 * table) shared by the PNG/SVG snapshot and the standalone HTML export. A Collections column
 * is appended when collections are supplied. All user-controlled values are HTML-escaped.
 */
export function buildScheduleReportHtml(
  schedule: PaymentScheduleResponse,
  collections?: CollectionTransaction[] | null,
): string {
  const report = buildScheduleReport(schedule, collections);

  const rows = report.rows
    .map((row, i) => {
      const stripe = i % 2 === 1 ? REPORT_COLORS.gray50 : REPORT_COLORS.white;
      return `
        <tr style="background:${stripe};">
          ${tableCell(String(row.index), { bg: row.rowColor, bold: true })}
          ${tableCell(row.period)}
          ${tableCell(row.dueDate)}
          ${tableCell(row.netAmount)}
          ${tableCell(row.taxes.map(escapeHtml).join("<br/>") || "-")}
          ${tableCell(row.fees.map(escapeHtml).join("<br/>") || "-")}
          ${tableCell(row.total, { bold: true })}
          ${tableCell(row.created)}
          ${tableCell(statusSymbol(row.succeeded), { color: statusColor(row.succeeded), bold: true })}
          ${report.hasCollections ? collectionsCell(row.collections) : ""}
        </tr>
      `;
    })
    .join("");

  return `
    <div style="display:block; background:${REPORT_COLORS.primary}; border-bottom:4px solid ${REPORT_COLORS.secondary}; border-radius:8px 8px 0 0; padding:16px 20px; margin-bottom:20px;">
      <div style="font-size:22px; font-weight:700; color:${REPORT_COLORS.white};">Payment Schedule</div>
      <div style="font-size:13px; color:${REPORT_COLORS.white}; opacity:0.85; margin-top:4px;">${escapeHtml(schedule.collectionFrequency || "-")} collection · generated ${escapeHtml(new Date().toLocaleString("en-GB"))}</div>
    </div>
    <div style="display:flex; gap:16px; margin-bottom:16px;">
      ${summaryCard("Total Amount", `€${report.totalAmount.toFixed(2)}`, { accent: true })}
      ${summaryCard("Collection Day", schedule.collectionFrequency === "annual" ? "-" : String(schedule.collectionDay ?? "-"))}
    </div>
    <div style="display:flex; gap:16px; margin-bottom:24px;">
      ${summaryCard("Cover Period", `${formatReportDate(schedule.coverStartDate)} - ${formatReportDate(schedule.coverEndDate)}`)}
      ${summaryCard("Schedule ID", escapeHtml(schedule.id || "-"))}
    </div>
    <div style="margin-bottom:24px;">
      <div style="font-size:13px; font-weight:600; color:${REPORT_COLORS.gray900}; margin-bottom:8px;">Legend</div>
      <div>
        ${ROW_TYPE_LEGEND.map(({ color, label }) => legendSwatch(color, label)).join("")}
      </div>
    </div>
    <table style="width:100%; border-collapse:collapse; border:1px solid ${REPORT_COLORS.gray200};">
      <thead>
        <tr>
          ${tableHeaderCell("Index")}
          ${tableHeaderCell("Period")}
          ${tableHeaderCell("Due Date")}
          ${tableHeaderCell("Net Amount")}
          ${tableHeaderCell("Taxes &amp; Levies")}
          ${tableHeaderCell("Admin Fees")}
          ${tableHeaderCell("Total")}
          ${tableHeaderCell("Created")}
          ${tableHeaderCell("Status")}
          ${report.hasCollections ? tableHeaderCell("Collections") : ""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/** Wraps the report markup in a standalone, self-styled HTML document for download. */
export function buildScheduleReportDocument(
  schedule: PaymentScheduleResponse,
  collections?: CollectionTransaction[] | null,
): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Payment Schedule ${escapeHtml(schedule.id)}</title>
  </head>
  <body style="margin:0; padding:24px; background:${REPORT_COLORS.gray50}; font-family:Arial, Helvetica, sans-serif;">
    <div style="max-width:1400px; margin:0 auto; background:${REPORT_COLORS.white}; border-radius:8px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.1); overflow-x:auto;">
      ${buildScheduleReportHtml(schedule, collections)}
    </div>
  </body>
</html>`;
}
