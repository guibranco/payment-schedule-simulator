import type { jsPDF } from "jspdf";
import type { PaymentScheduleResponse, CollectionTransaction } from "../types";
import {
  REPORT_COLORS,
  ROW_TYPE_LEGEND,
  buildScheduleReport,
  collectionsColors,
  collectionsLabel,
  formatReportDate,
  type ReportRow,
} from "./scheduleReport";
import type { ScheduleAnomaly } from "./scheduleAnomalies";

const MARGIN = 12;
const LINE_HEIGHT = 4.2;
const CELL_PADDING_X = 2;
const CELL_PADDING_Y = 2.2;
const TABLE_HEADER_HEIGHT = 8;
const FOOTER_SPACE = 12;

interface Column {
  label: string;
  weight: number;
  render: (row: ReportRow) => string[];
}

/** The item's succeeded status as a word. */
function statusText(succeeded: boolean | null): string {
  if (succeeded === null) return "Unknown";
  return succeeded ? "Succeeded" : "Failed";
}

/** Text colour for the succeeded status: green, red, or grey when unknown. */
function statusColor(succeeded: boolean | null): string {
  if (succeeded === null) return REPORT_COLORS.gray500;
  return succeeded ? REPORT_COLORS.green800 : REPORT_COLORS.red800;
}

/** Draws one summary card (title above value), accented for the headline total. */
function drawSummaryCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  value: string,
  accent: boolean,
) {
  const height = 18;
  doc.setFillColor(
    accent ? REPORT_COLORS.primarySoftHex : REPORT_COLORS.gray50,
  );
  doc.roundedRect(x, y, width, height, 2, 2, "F");
  doc.setFillColor(accent ? REPORT_COLORS.primary : REPORT_COLORS.gray200);
  doc.rect(x, y, 1.2, height, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(accent ? REPORT_COLORS.primary : REPORT_COLORS.gray500);
  doc.text(title.toUpperCase(), x + 4, y + 5.5);

  doc.setFontSize(value.length > 24 ? 8 : 12);
  doc.setTextColor(accent ? REPORT_COLORS.primary : REPORT_COLORS.gray900);
  doc.text(value, x + 4, y + 13);
}

/** Draws one coloured box per Schedule Anomaly (warnings first); returns the y below the last one. */
function drawAnomalies(
  doc: jsPDF,
  anomalies: ScheduleAnomaly[],
  startY: number,
  contentWidth: number,
  pageHeight: number,
): number {
  if (anomalies.length === 0) return startY;

  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(REPORT_COLORS.gray900);
  doc.text(`Schedule Anomalies (${anomalies.length})`, MARGIN, y + 3);
  y += 6;

  for (const anomaly of anomalies) {
    const isWarning = anomaly.severity === "warning";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(
      `${anomaly.title} (${anomaly.severity}): ${anomaly.message}`,
      contentWidth - 6,
    ) as string[];
    const height = lines.length * LINE_HEIGHT + 3;

    if (y + height > pageHeight - FOOTER_SPACE) {
      doc.addPage();
      y = MARGIN;
    }

    doc.setFillColor(isWarning ? REPORT_COLORS.red100 : REPORT_COLORS.blue100);
    doc.roundedRect(MARGIN, y, contentWidth, height, 1.5, 1.5, "F");
    doc.setTextColor(isWarning ? REPORT_COLORS.red800 : REPORT_COLORS.blue800);
    lines.forEach((line, i) => {
      doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      doc.text(line, MARGIN + 3, y + 4.5 + i * LINE_HEIGHT);
    });
    y += height + 2;
  }
  return y + 3;
}

/** Draws the brand-coloured table header row; repeated at the top of every page. */
function drawTableHeader(
  doc: jsPDF,
  columns: Column[],
  widths: number[],
  y: number,
) {
  const tableWidth = widths.reduce((a, b) => a + b, 0);
  doc.setFillColor(REPORT_COLORS.primary);
  doc.rect(MARGIN, y, tableWidth, TABLE_HEADER_HEIGHT, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(REPORT_COLORS.white);
  let x = MARGIN;
  columns.forEach((column, i) => {
    doc.text(column.label.toUpperCase(), x + CELL_PADDING_X, y + 5.3);
    x += widths[i];
  });
}

/**
 * Draws a branded, colour-coded payment schedule report onto a (landscape A4) jsPDF document:
 * brand header band, summary cards, row-type legend, and a paginated table whose header repeats
 * on every page. Mirrors the PNG/SVG/HTML exports, including the Collections column when
 * collections have been reconciled.
 */
export function renderSchedulePdf(
  doc: jsPDF,
  schedule: PaymentScheduleResponse,
  collections?: CollectionTransaction[] | null,
): void {
  const report = buildScheduleReport(schedule, collections);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  // Brand header band with the secondary-colour accent stripe.
  doc.setFillColor(REPORT_COLORS.primary);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setFillColor(REPORT_COLORS.secondary);
  doc.rect(0, 22, pageWidth, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(REPORT_COLORS.white);
  doc.text("Payment Schedule", MARGIN, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${schedule.collectionFrequency || "-"} collection · generated ${new Date().toLocaleString("en-GB")}`,
    MARGIN,
    18,
  );

  // Summary cards.
  const gap = 4;
  const cardWidth = (contentWidth - gap * 3) / 4;
  const cardY = 30;
  const cards: Array<[string, string, boolean]> = [
    ["Total Amount", `€${report.totalAmount.toFixed(2)}`, true],
    [
      "Collection Day",
      schedule.collectionFrequency === "annual"
        ? "-"
        : String(schedule.collectionDay ?? "-"),
      false,
    ],
    [
      "Cover Period",
      `${formatReportDate(schedule.coverStartDate)} - ${formatReportDate(schedule.coverEndDate)}`,
      false,
    ],
    ["Schedule ID", schedule.id || "-", false],
  ];
  cards.forEach(([title, value, accent], i) => {
    drawSummaryCard(
      doc,
      MARGIN + i * (cardWidth + gap),
      cardY,
      cardWidth,
      title,
      value,
      accent,
    );
  });

  // Legend.
  let legendX = MARGIN;
  const legendY = cardY + 18 + 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ROW_TYPE_LEGEND.forEach(({ color, label }) => {
    doc.setFillColor(color);
    doc.setDrawColor(REPORT_COLORS.gray200);
    doc.rect(legendX, legendY - 3, 4, 4, "FD");
    doc.setTextColor(REPORT_COLORS.gray500);
    doc.text(label, legendX + 6, legendY);
    legendX += 6 + doc.getTextWidth(label) + 8;
  });

  // Table (after the Schedule Anomalies, if any).
  const columns: Column[] = [
    { label: "#", weight: 8, render: (row) => [String(row.index)] },
    { label: "Period", weight: 40, render: (row) => [row.period] },
    { label: "Due Date", weight: 21, render: (row) => [row.dueDate] },
    { label: "Net", weight: 20, render: (row) => [row.netAmount] },
    {
      label: "Taxes & Levies",
      weight: 32,
      render: (row) => (row.taxes.length ? row.taxes : ["-"]),
    },
    {
      label: "Admin Fees",
      weight: 30,
      render: (row) => (row.fees.length ? row.fees : ["-"]),
    },
    { label: "Total", weight: 20, render: (row) => [row.total] },
    { label: "Created", weight: 21, render: (row) => [row.created] },
    {
      label: "Status",
      weight: 19,
      render: (row) => [statusText(row.succeeded)],
    },
  ];
  if (report.hasCollections) {
    columns.push({
      label: "Collections",
      weight: 30,
      render: (row) => [collectionsLabel(row.collections)],
    });
  }
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  const widths = columns.map(
    (column) => (column.weight / totalWeight) * contentWidth,
  );
  const statusIndex = columns.findIndex((column) => column.label === "Status");
  const collectionsIndex = columns.findIndex(
    (column) => column.label === "Collections",
  );
  const totalIndex = columns.findIndex((column) => column.label === "Total");

  let y = drawAnomalies(
    doc,
    report.anomalies,
    legendY + 6,
    contentWidth,
    pageHeight,
  );
  drawTableHeader(doc, columns, widths, y);
  y += TABLE_HEADER_HEIGHT;

  report.rows.forEach((row, rowIndex) => {
    const cellLines = columns.map((column, i) =>
      column
        .render(row)
        .flatMap(
          (line) =>
            doc.splitTextToSize(
              line,
              widths[i] - CELL_PADDING_X * 2,
            ) as string[],
        ),
    );
    const rowHeight =
      Math.max(...cellLines.map((lines) => lines.length)) * LINE_HEIGHT +
      CELL_PADDING_Y * 2;

    if (y + rowHeight > pageHeight - FOOTER_SPACE) {
      doc.addPage();
      y = MARGIN;
      drawTableHeader(doc, columns, widths, y);
      y += TABLE_HEADER_HEIGHT;
    }

    // Zebra stripe, then the row-type colour on the index cell (as on screen).
    doc.setFillColor(
      rowIndex % 2 === 1 ? REPORT_COLORS.gray50 : REPORT_COLORS.white,
    );
    doc.rect(MARGIN, y, contentWidth, rowHeight, "F");
    doc.setFillColor(row.rowColor);
    doc.rect(MARGIN, y, widths[0], rowHeight, "F");

    let x = MARGIN;
    cellLines.forEach((lines, i) => {
      const collectionsColor =
        i === collectionsIndex ? collectionsColors(row.collections) : null;
      if (collectionsColor) {
        doc.setFillColor(collectionsColor.bg);
        doc.roundedRect(
          x + 1,
          y + 1.2,
          widths[i] - 2,
          rowHeight - 2.4,
          1.5,
          1.5,
          "F",
        );
      }

      const isBold =
        i === 0 || i === totalIndex || i === statusIndex || Boolean(collectionsColor);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(8);
      if (i === statusIndex) doc.setTextColor(statusColor(row.succeeded));
      else if (collectionsColor) doc.setTextColor(collectionsColor.fg);
      else doc.setTextColor(REPORT_COLORS.gray900);

      lines.forEach((line, lineIndex) => {
        doc.text(
          line,
          x + CELL_PADDING_X,
          y + CELL_PADDING_Y + 3 + lineIndex * LINE_HEIGHT,
        );
      });
      x += widths[i];
    });

    doc.setDrawColor(REPORT_COLORS.gray200);
    doc.line(MARGIN, y + rowHeight, MARGIN + contentWidth, y + rowHeight);
    y += rowHeight;
  });

  // Footer on every page.
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(REPORT_COLORS.secondary);
    doc.line(MARGIN, pageHeight - 8, pageWidth - MARGIN, pageHeight - 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(REPORT_COLORS.gray500);
    doc.text(`Schedule ${schedule.id || "-"}`, MARGIN, pageHeight - 4);
    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - MARGIN,
      pageHeight - 4,
      { align: "right" },
    );
  }
}
