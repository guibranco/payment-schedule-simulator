import React from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Clock,
  History,
  Info,
  MinusCircle,
  RefreshCw,
  Undo2,
  X,
  XCircle,
} from "lucide-react";
import type {
  ItemReconciliation,
  ReconciledStatus,
  ScheduleItem,
} from "../../types";
import type { ScheduleAnomaly } from "../../utils/scheduleAnomalies";
import { isCollectionType } from "../../utils/collectionType";
import { formatReportDate as formatDate } from "../../utils/scheduleReport";
import type { EffectiveValue } from "../../utils/reconcileCollections";

type IconComponent = React.ComponentType<{ className?: string }>;

const RECONCILIATION_BADGES: Record<
  ReconciledStatus,
  { label: string; className: string; Icon: IconComponent }
> = {
  collected: {
    label: "Collected",
    className: "bg-green-100 text-green-800",
    Icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-800",
    Icon: XCircle,
  },
  refunded: {
    label: "Refunded",
    className: "bg-blue-100 text-blue-800",
    Icon: Undo2,
  },
  pending: {
    label: "Pending",
    className: "bg-gray-100 text-gray-600",
    Icon: Clock,
  },
};

const CELL_CLASS = "px-3 py-3 whitespace-nowrap text-sm text-gray-900";

/** The index cell's colour: Refund Item, then Admin Fee Item, then Pro-Rata Item, else Full Item. */
function indexBackgroundClass(item: ScheduleItem): string {
  if (Number(item.amountDue) < 0) return "bg-blue-100";
  if (item.adminFees && Object.keys(item.adminFees).length > 0)
    return "bg-orange-100";
  if (isCollectionType(item, "proRata")) return "bg-yellow-100";
  return "bg-green-100";
}

interface Props {
  item: ScheduleItem;
  index: number;
  isFrequencySwitchPivot: boolean;
  /** The item's anomalies other than the Frequency Switch, which has its own marker. */
  anomalies: ScheduleAnomaly[];
  createdDate: EffectiveValue<string | null | undefined>;
  succeeded: EffectiveValue<boolean | null>;
  /** Whether collections are loaded, so the Collections column is shown. */
  showCollections: boolean;
  reconciliation: ItemReconciliation | undefined;
  onStatusChange?: (index: number) => void;
  onShowBasisItem: (basisItem: ScheduleItem) => void;
  onShowReconciliation: (itemId: string) => void;
}

/** One Schedule Item as a table row, with anomaly markers, status and Collections badge. */
export default function ScheduleItemRow({
  item,
  index,
  isFrequencySwitchPivot,
  anomalies,
  createdDate,
  succeeded,
  showCollections,
  reconciliation,
  onStatusChange,
  onShowBasisItem,
  onShowReconciliation,
}: Props) {
  const basisItem = item.originalItem;

  return (
    <tr
      className={`hover:bg-gray-50 ${isFrequencySwitchPivot ? "ring-2 ring-inset ring-amber-400" : ""}`}
    >
      <td className={`${CELL_CLASS} ${indexBackgroundClass(item)}`}>
        <span className="inline-flex items-center gap-1">
          {index}
          {isFrequencySwitchPivot && (
            <ArrowRightLeft
              className="w-3.5 h-3.5 text-amber-700"
              aria-label="Frequency changed here"
            />
          )}
          {anomalies.map((anomaly) => (
            <AnomalyMarker key={anomaly.kind} anomaly={anomaly} />
          ))}
        </span>
      </td>
      <td className={CELL_CLASS}>
        {formatDate(item.periodStartDate)} - {formatDate(item.periodEndDate)}
      </td>
      <td className={CELL_CLASS}>{formatDate(item.dueDate)}</td>
      <td className={CELL_CLASS}>
        €{Number(item?.netAmount ?? 0).toFixed(2)}
      </td>
      <td className={CELL_CLASS}>
        <TaxesList taxes={item.taxesAndLevies} />
      </td>
      <td className={CELL_CLASS}>
        <AdminFeesList fees={item.adminFees} />
      </td>
      <td className={CELL_CLASS}>
        €{Number(item?.amountDue ?? 0).toFixed(2)}
      </td>
      <td className={CELL_CLASS}>
        <CreatedDate createdDate={createdDate} />
      </td>
      <td className={CELL_CLASS}>
        <StatusIcon
          succeeded={succeeded.value}
          derived={succeeded.derived}
          onClick={onStatusChange ? () => onStatusChange(index) : undefined}
        />
      </td>
      <td className={CELL_CLASS}>{formatDate(item.adjustmentDate)}</td>
      <td className={CELL_CLASS}>
        {basisItem ? (
          <button
            type="button"
            onClick={() => onShowBasisItem(basisItem)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:opacity-80 transition-opacity"
            title="View Basis Item details"
          >
            <History className="w-3.5 h-3.5" />
            Yes
          </button>
        ) : (
          "No"
        )}
      </td>
      {showCollections && (
        <td className="px-3 py-3 whitespace-nowrap text-sm">
          <CollectionsBadge
            entry={reconciliation}
            onClick={() => onShowReconciliation(item.id)}
          />
        </td>
      )}
    </tr>
  );
}

/** A small warning or info icon in the index cell, labelled with the anomaly's title. */
function AnomalyMarker({ anomaly }: { anomaly: ScheduleAnomaly }) {
  return anomaly.severity === "warning" ? (
    <AlertTriangle
      className="w-3.5 h-3.5 text-red-700"
      aria-label={anomaly.title}
    />
  ) : (
    <Info className="w-3.5 h-3.5 text-blue-700" aria-label={anomaly.title} />
  );
}

/** Taxes and levies as one "code: €amount" line each, or "-" when there are none. */
function TaxesList({ taxes }: { taxes: Record<string, number> | undefined }) {
  const entries = Object.entries(taxes || {});
  if (entries.length === 0) return <>-</>;
  return (
    <>
      {entries.map(([key, value]) => (
        <div key={key}>
          {key}: €{Number(value || 0).toFixed(2)}
        </div>
      ))}
    </>
  );
}

/** Admin fees as one "code: €amount (+ tax)" line each, or "-" when there are none. */
function AdminFeesList({ fees }: { fees: ScheduleItem["adminFees"] | undefined }) {
  const entries = Object.entries(fees || {});
  if (entries.length === 0) return <>-</>;
  return (
    <>
      {entries.map(([key, value]) => (
        <div key={key}>
          {key}: €{Number(value.amountDue || 0).toFixed(2)}
          {Number(value.taxAmount || 0) > 0 &&
            ` + €${Number(value.taxAmount || 0).toFixed(2)} tax`}
        </div>
      ))}
    </>
  );
}

/** The collection item's created date, italicised when derived from Collections. */
function CreatedDate({
  createdDate,
}: {
  createdDate: EffectiveValue<string | null | undefined>;
}) {
  if (!createdDate.value) return <>-</>;
  return (
    <span
      className={createdDate.derived ? "italic text-gray-500" : undefined}
      title={
        createdDate.derived
          ? "Derived from Collections reconciliation — not recorded on the schedule item"
          : undefined
      }
    >
      {formatDate(createdDate.value)}
    </span>
  );
}

/**
 * The item's succeeded status as an icon, tagged "auto" when derived from Collections.
 * With `onClick`, it's a button that cycles the status.
 */
function StatusIcon({
  succeeded,
  derived,
  onClick,
}: {
  succeeded: boolean | null;
  derived: boolean;
  onClick?: () => void;
}) {
  const title = derived
    ? "Derived from Collections reconciliation — this schedule item has no recorded status"
    : "Click to change status";
  const content = (
    <span className="inline-flex items-center gap-1">
      <SucceededIcon succeeded={succeeded} />
      {derived && (
        <span className="text-[10px] font-medium text-indigo-600 uppercase">
          auto
        </span>
      )}
    </span>
  );

  return onClick ? (
    <button
      onClick={onClick}
      className="hover:bg-gray-100 p-1 rounded-full transition-colors"
      title={title}
    >
      {content}
    </button>
  ) : (
    <span title={derived ? title : undefined}>{content}</span>
  );
}

/** A dash, tick or cross for unknown, succeeded or failed. */
function SucceededIcon({ succeeded }: { succeeded: boolean | null }) {
  if (succeeded === null)
    return <MinusCircle className="w-5 h-5 text-gray-400" />;
  return succeeded ? (
    <Check className="w-5 h-5 text-green-500" />
  ) : (
    <X className="w-5 h-5 text-red-500" />
  );
}

/** The item's Reconciled Outcome as a clickable badge, flagging retries and mismatches. */
function CollectionsBadge({
  entry,
  onClick,
}: {
  entry: ItemReconciliation | undefined;
  onClick: () => void;
}) {
  if (!entry) return <>-</>;
  const { label, className, Icon } = RECONCILIATION_BADGES[entry.status];
  const hasIssue = entry.amountMismatch || entry.statusMismatch;
  const titleParts = [
    entry.transactions.length > 0
      ? `${entry.transactions.length} matching transaction(s) — click for details`
      : "No matching Collections transaction found — click for details",
  ];
  if (entry.wasRetried) {
    titleParts.push(
      "Retried via resubmission/real-time after an earlier rejection or refund",
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${className}`}
      title={titleParts.join(" · ")}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {entry.wasRetried && (
        <RefreshCw className="w-3.5 h-3.5" aria-label="Retried" />
      )}
      {hasIssue && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
    </button>
  );
}
