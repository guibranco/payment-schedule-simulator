import { ListChecks, X } from "lucide-react";
import type { ReconciliationSummary } from "../../types";

/** Counts of each Reconciled Outcome after loading collections, with a button to clear them. */
export default function ReconciliationSummaryBar({
  summary,
  onClear,
}: Readonly<{
  summary: ReconciliationSummary;
  onClear?: () => void;
}>) {
  return (
    <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 text-indigo-900">
        <ListChecks className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium">
          Collections reconciliation: {summary.collected} collected,{" "}
          {summary.rejected} rejected, {summary.refunded} refunded,{" "}
          {summary.pending} pending
          {summary.mismatches > 0 && (
            <span className="text-amber-700">
              {" "}
              — {summary.mismatches} flagged for review
            </span>
          )}
        </span>
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-sm text-indigo-700 hover:text-indigo-900 transition-colors"
          title="Clear loaded collections"
        >
          <X className="w-4 h-4" />
          Clear
        </button>
      )}
    </div>
  );
}
