import { AlertTriangle } from "lucide-react";
import type { CollectionTransaction, ItemReconciliation } from "../../types";
import { getTransactionDate } from "../../utils/reconcileCollections";
import { formatReportDate as formatDate } from "../../utils/scheduleReport";

const TRANSACTION_COLUMNS = [
  "Processed",
  "Status",
  "Channel",
  "Amount",
  "Reference",
  "Error",
];

/**
 * The channel a transaction was submitted through — used to explain which attempts
 * were retries (resubmission or real-time) versus the original.
 */
function channelLabel(txn: CollectionTransaction): string {
  if (txn.isResubmission) return "Resubmission";
  if (txn.isRealtime) return "Real-time";
  return "Standard";
}

/** The Collection Transactions behind one item's Reconciled Outcome, with any mismatch flagged. */
export default function ReconciliationDetail({
  entry,
}: {
  entry: ItemReconciliation | null | undefined;
}) {
  if (!entry || entry.transactions.length === 0) {
    return (
      <p className="text-gray-600">
        No matching Collections Service transactions found for this schedule
        item.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <MismatchWarning entry={entry} />
      <TransactionsTable transactions={entry.transactions} />
    </div>
  );
}

/** Explains a status or amount mismatch between the schedule item and its collections. */
function MismatchWarning({ entry }: { entry: ItemReconciliation }) {
  if (!entry.amountMismatch && !entry.statusMismatch) return null;
  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>
        {entry.statusMismatch && (
          <p>
            The schedule item&apos;s recorded status doesn&apos;t match the
            latest Collections outcome.
          </p>
        )}
        {entry.amountMismatch && (
          <p>The collected amount differs from this item&apos;s amount due.</p>
        )}
      </div>
    </div>
  );
}

/** One row per Collection Transaction: when, outcome, channel, amount, reference and error. */
function TransactionsTable({
  transactions,
}: {
  transactions: CollectionTransaction[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead>
          <tr>
            {TRANSACTION_COLUMNS.map((column) => (
              <th
                key={column}
                className="px-3 py-2 text-left font-medium text-gray-500"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((txn, i) => (
            <tr key={txn.transactionReference || i}>
              <td className="px-3 py-2 whitespace-nowrap">
                {formatDate(getTransactionDate(txn))}
              </td>
              <td className="px-3 py-2 capitalize">{txn.collectionStatus}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {channelLabel(txn)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                €{Number(txn.amountDue ?? 0).toFixed(2)}
              </td>
              <td className="px-3 py-2 break-all">
                {txn.transactionReference || "-"}
              </td>
              <td className="px-3 py-2">
                {txn.providerDetails?.errorMessage || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
