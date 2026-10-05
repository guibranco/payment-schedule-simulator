import React, { useMemo, useState } from "react";
import {
  FileJson,
  FileSpreadsheet,
  FileText,
  FileCode,
  Image,
  Shapes,
} from "lucide-react";
import type {
  PaymentScheduleResponse,
  ScheduleItem,
  CollectionTransaction,
} from "../types";
import { exportScheduleImage } from "../utils/scheduleImage";
import {
  buildScheduleReportDocument,
  formatReportDate as formatDate,
} from "../utils/scheduleReport";
import { renderSchedulePdf } from "../utils/schedulePdf";
import {
  convertResponseToFormat,
  type ScheduleFormat,
} from "../utils/scheduleDetector";
import { STORAGE_KEYS } from "../constants";
import {
  reconcileScheduleItems,
  summarizeReconciliation,
  getEffectiveSucceeded,
  getEffectiveCreatedDate,
} from "../utils/reconcileCollections";
import { detectScheduleAnomalies } from "../utils/scheduleAnomalies";
import Modal from "./Modal";
import SplitMenuButton, { type MenuOption } from "./schedule/SplitMenuButton";
import ScheduleSummaryCards from "./schedule/ScheduleSummaryCards";
import AnomaliesPanel from "./schedule/AnomaliesPanel";
import ReconciliationSummaryBar from "./schedule/ReconciliationSummaryBar";
import ScheduleLegend from "./schedule/ScheduleLegend";
import ScheduleItemsTable from "./schedule/ScheduleItemsTable";
import ReconciliationDetail from "./schedule/ReconciliationDetail";
import BasisItemDetail from "./schedule/BasisItemDetail";

interface Props {
  schedule: PaymentScheduleResponse;
  onStatusChange?: (index: number) => void;
  collections?: CollectionTransaction[] | null;
  onClearCollections?: () => void;
}

type ExportFormat = "json" | "csv" | "pdf" | "html" | "png" | "svg";
type IconComponent = React.ComponentType<{ className?: string }>;

const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  json: "JSON",
  csv: "CSV",
  pdf: "PDF",
  html: "HTML",
  png: "PNG",
  svg: "SVG",
};

const EXPORT_FORMAT_ICONS: Record<ExportFormat, IconComponent> = {
  json: FileJson,
  csv: FileSpreadsheet,
  pdf: FileText,
  html: FileCode,
  png: Image,
  svg: Shapes,
};

const EXPORT_FORMATS = Object.keys(EXPORT_FORMAT_LABELS) as ExportFormat[];

const EXPORT_OPTIONS: MenuOption<ExportFormat>[] = EXPORT_FORMATS.map(
  (format) => ({
    value: format,
    label: EXPORT_FORMAT_LABELS[format],
    Icon: EXPORT_FORMAT_ICONS[format],
  }),
);

/** Whether a saved string is one of the supported export formats. */
function isExportFormat(value: string | null): value is ExportFormat {
  return Boolean(value) && (EXPORT_FORMATS as string[]).includes(value ?? "");
}

// 'seq' is an input-only format (a SEQ log of Policy Admin's raw request) — it's never
// a valid "View JSON as..." target, so it's excluded from the type rather than just the data.
type ViewJsonFormat = Exclude<ScheduleFormat, "seq">;

const VIEW_JSON_FORMAT_LABELS: Record<ViewJsonFormat, string> = {
  policyAdmin: "Policy Admin CosmosDB Document",
  rerates: "Rerates CosmosDB Document",
  request: "Payment Schedule Request (Amendment)",
  response: "Payment Schedule Response",
};

const VIEW_JSON_OPTIONS: MenuOption<ViewJsonFormat>[] = (
  ["policyAdmin", "rerates", "request", "response"] as ViewJsonFormat[]
).map((format) => ({ value: format, label: VIEW_JSON_FORMAT_LABELS[format] }));

const DAY_MS = 1000 * 60 * 60 * 24;

/** Triggers a browser download of the given content. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
export default function ScheduleDisplay({
  schedule,
  onStatusChange,
  collections,
  onClearCollections,
}: Readonly<Props>) {
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [reconciliationDetailItemId, setReconciliationDetailItemId] = useState<
    string | null
  >(null);
  const [basisItemDetail, setBasisItemDetail] = useState<ScheduleItem | null>(
    null,
  );
  const [viewJsonFormat, setViewJsonFormat] =
    useState<ViewJsonFormat>("response");

  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULE_EXPORT_FORMAT);
    return isExportFormat(saved) ? saved : "json";
  });

  /** Remembers the chosen export format across visits. */
  const selectExportFormat = (format: ExportFormat) => {
    setExportFormat(format);
    localStorage.setItem(STORAGE_KEYS.SCHEDULE_EXPORT_FORMAT, format);
  };

  const scheduleItems = useMemo(
    () => schedule?.scheduleItems || [],
    [schedule],
  );

  const totalAmount = scheduleItems.reduce(
    (sum, item) => sum + Number(item?.amountDue ?? 0),
    0,
  );

  const reconciliation = useMemo(
    () =>
      collections && collections.length > 0
        ? reconcileScheduleItems(scheduleItems, collections)
        : null,
    [scheduleItems, collections],
  );
  const reconciliationSummary = useMemo(
    () => (reconciliation ? summarizeReconciliation(reconciliation) : null),
    [reconciliation],
  );
  const reconciliationDetail = reconciliationDetailItemId
    ? reconciliation?.get(reconciliationDetailItemId)
    : null;

  const anomalies = useMemo(
    () => detectScheduleAnomalies(schedule),
    [schedule],
  );

  /** The item's status, falling back to the Collections-derived one when none is recorded. */
  const getEffectiveSucceededForItem = (item: ScheduleItem) =>
    getEffectiveSucceeded(item, reconciliation);

  /** The item's created date, falling back to the Collections-derived one when none is recorded. */
  const getEffectiveCreatedDateForItem = (item: ScheduleItem) =>
    getEffectiveCreatedDate(item, reconciliation);

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
      "Index",
      "PeriodStartDate",
      "PeriodEndDate",
      "DaysDueDateBeforePeriodStart",
      "DaysInPeriod",
      "DaysRemainingInPeriod",
      "DueDate",
      "AmountDue",
      "AdminFeesTotal",
      "AdminFees",
      "NetPremium",
      "TaxesAndLeviesTotal",
      "TaxesAndLevies",
      "CollectionItemCreatedDate",
      "Succeeded",
      "AdjustmentDate",
      "HasOriginalItem",
      "Type",
      "CollectionsStatus",
      "CollectionsRetried",
    ];

    const rows = scheduleItems.map((item, index) => {
      const periodStart = new Date(item.periodStartDate);
      const periodEnd = new Date(item.periodEndDate);
      const dueDate = new Date(item.dueDate);

      // Calculate days between due date and period start
      const daysDueDateBeforePeriodStart = Math.floor(
        (periodStart.getTime() - dueDate.getTime()) / DAY_MS,
      );

      // Calculate days in period
      const daysInPeriod =
        Math.floor((periodEnd.getTime() - periodStart.getTime()) / DAY_MS) + 1;

      // Calculate days remaining in period (from current date)
      const now = new Date();
      const daysRemainingInPeriod = Math.floor(
        (periodEnd.getTime() - now.getTime()) / DAY_MS,
      );

      const adminFeesTotal = Object.values(item.adminFees || {}).reduce(
        (sum, fee) => sum + (fee.amountDue || 0),
        0,
      );
      const taxesAndLeviesTotal = Object.values(
        item.taxesAndLevies || {},
      ).reduce((sum, value) => sum + (value || 0), 0);

      const adminFeesStr = Object.entries(item.adminFees || {})
        .map(([key, value]) => `${key}|${value.amountDue}|${value.taxAmount}`)
        .join(":");

      const taxesAndLeviesStr = Object.entries(item.taxesAndLevies || {})
        .map(([key, value]) => `${key}|${value}`)
        .join(":");

      const { value: effectiveCreatedDate } =
        getEffectiveCreatedDateForItem(item);
      const { value: effectiveSucceeded } = getEffectiveSucceededForItem(item);
      const collectionsEntry = reconciliation?.get(item.id);

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
        adminFeesStr || "",
        item.netAmount,
        taxesAndLeviesTotal,
        taxesAndLeviesStr || "",
        effectiveCreatedDate ? formatDate(effectiveCreatedDate) : "",
        effectiveSucceeded?.toString() || "",
        item.adjustmentDate ? formatDate(item.adjustmentDate) : "",
        (
          item.originalItem !== undefined && item.originalItem !== null
        ).toString(),
        item.collectionType,
        collectionsEntry ? collectionsEntry.status : "",
        collectionsEntry ? collectionsEntry.wasRetried.toString() : "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    downloadBlob(
      new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
      `schedule-${schedule?.id || "export"}.csv`,
    );
  };

  /**
   * Downloads the schedule as JSON, with Collections-derived statuses/dates applied and,
   * when collections are loaded, a per-item reconciliation summary.
   */
  const downloadJson = () => {
    const exportedItems = scheduleItems.map((item) => {
      const { value: effectiveCreatedDate } =
        getEffectiveCreatedDateForItem(item);
      const { value: effectiveSucceeded } = getEffectiveSucceededForItem(item);
      return {
        ...item,
        collectionItemCreatedDate: effectiveCreatedDate,
        succeeded: effectiveSucceeded,
      };
    });

    const exportedSchedule: Record<string, unknown> = {
      ...schedule,
      scheduleItems: exportedItems,
    };
    if (reconciliation) {
      exportedSchedule.collectionsReconciliation = scheduleItems.map((item) => {
        const entry = reconciliation.get(item.id);
        return {
          scheduleItemId: item.id,
          status: entry?.status ?? "pending",
          wasRetried: entry?.wasRetried ?? false,
          amountMismatch: entry?.amountMismatch ?? false,
          statusMismatch: entry?.statusMismatch ?? false,
          transactionCount: entry?.transactions.length ?? 0,
        };
      });
    }

    downloadBlob(
      new Blob([JSON.stringify(exportedSchedule, null, 2)], {
        type: "application/json",
      }),
      `schedule-${schedule?.id || "export"}.json`,
    );
  };

  /** Downloads the branded, standalone HTML report. */
  const downloadHtml = () => {
    downloadBlob(
      new Blob([buildScheduleReportDocument(schedule, collections)], {
        type: "text/html",
      }),
      `schedule-${schedule.id}.html`,
    );
  };

  /** Downloads the branded landscape A4 PDF report. */
  const downloadPdf = async () => {
    const jsPDFModule = await import("jspdf");
    const doc = new jsPDFModule.default({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    renderSchedulePdf(doc, schedule, collections);
    doc.save(`schedule-${schedule.id}.pdf`);
  };

  /** Exports in the chosen format, showing a format-specific error if it fails. */
  const handleExport = async () => {
    setExportError(null);
    try {
      switch (exportFormat) {
        case "json":
          downloadJson();
          break;
        case "csv":
          downloadCsv();
          break;
        case "html":
          downloadHtml();
          break;
        case "pdf":
          await downloadPdf();
          break;
        case "png":
        case "svg":
          await exportScheduleImage(
            schedule,
            exportFormat,
            collections ?? null,
          );
          break;
        default: {
          const unsupported: never = exportFormat;
          throw new Error(`Unsupported export format: ${String(unsupported)}`);
        }
      }
    } catch (err) {
      console.error("Error exporting schedule:", err);
      setExportError(
        `Failed to export schedule as ${EXPORT_FORMAT_LABELS[exportFormat]}. Please try again.`,
      );
    }
  };

  if (!schedule) {
    return <div className="p-4 text-gray-600">No schedule data available.</div>;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <div className="flex justify-end flex-wrap gap-2 mb-6">
          <SplitMenuButton
            label={`View JSON as ${VIEW_JSON_FORMAT_LABELS[viewJsonFormat]}`}
            title={`View schedule JSON as ${VIEW_JSON_FORMAT_LABELS[viewJsonFormat]}`}
            Icon={FileJson}
            menuLabel="Choose JSON view format"
            options={VIEW_JSON_OPTIONS}
            selected={viewJsonFormat}
            onSelect={setViewJsonFormat}
            onClick={() => setIsJsonModalOpen(true)}
            variant="neutral"
            menuAlign="left"
            menuWidthClass="w-64"
          />
          <SplitMenuButton
            label={`Export as ${EXPORT_FORMAT_LABELS[exportFormat]}`}
            title={`Export schedule as ${EXPORT_FORMAT_LABELS[exportFormat]}`}
            Icon={EXPORT_FORMAT_ICONS[exportFormat]}
            menuLabel="Choose export format"
            options={EXPORT_OPTIONS}
            selected={exportFormat}
            onSelect={selectExportFormat}
            onClick={handleExport}
            variant="primary"
            menuAlign="right"
            menuWidthClass="w-40"
          />
        </div>

        {exportError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md">
            {exportError}
          </div>
        )}

        <ScheduleSummaryCards schedule={schedule} totalAmount={totalAmount} />
        <AnomaliesPanel anomalies={anomalies} />
        {reconciliationSummary && (
          <ReconciliationSummaryBar
            summary={reconciliationSummary}
            onClear={onClearCollections}
          />
        )}
        <ScheduleLegend />
        <ScheduleItemsTable
          items={scheduleItems}
          anomalies={anomalies}
          reconciliation={reconciliation}
          getCreatedDate={getEffectiveCreatedDateForItem}
          getSucceeded={getEffectiveSucceededForItem}
          onStatusChange={onStatusChange}
          onShowBasisItem={setBasisItemDetail}
          onShowReconciliation={setReconciliationDetailItemId}
        />
      </div>

      <Modal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        title={`Schedule JSON — ${VIEW_JSON_FORMAT_LABELS[viewJsonFormat]}`}
      >
        <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto">
          <code>
            {JSON.stringify(
              convertResponseToFormat(schedule, viewJsonFormat),
              null,
              2,
            )}
          </code>
        </pre>
      </Modal>

      <Modal
        isOpen={reconciliationDetailItemId !== null}
        onClose={() => setReconciliationDetailItemId(null)}
        title={`Collections history — item ${reconciliationDetailItemId ?? ""}`}
      >
        <ReconciliationDetail entry={reconciliationDetail} />
      </Modal>

      <Modal
        isOpen={basisItemDetail !== null}
        onClose={() => setBasisItemDetail(null)}
        title="Basis Item"
      >
        {basisItemDetail && (
          <BasisItemDetail
            basisItem={basisItemDetail}
            scheduleItems={scheduleItems}
          />
        )}
      </Modal>
    </>
  );
}
