import {
  CollectionTransaction,
  ItemReconciliation,
  ReconciledStatus,
  ReconciliationSummary,
  ScheduleItem
} from '../types';

const AMOUNT_TOLERANCE = 0.01;
const KNOWN_STATUSES: ReconciledStatus[] = ['collected', 'rejected', 'refunded'];

/**
 * The best available timestamp for a transaction, in order of how authoritative it is
 * about when the collection actually happened: provider processing date first, then the
 * record's own modified/created dates, then the scheduled value/due dates as a last resort.
 */
export function getTransactionDate(txn: CollectionTransaction): string | undefined {
  return txn.providerDetails?.processingDate || txn.modifiedDate || txn.createdDate || txn.valueDate || txn.dueDate;
}

function getProcessingTime(txn: CollectionTransaction): number {
  const raw = getTransactionDate(txn);
  const time = raw ? new Date(raw).getTime() : NaN;
  return isNaN(time) ? 0 : time;
}

function normalizeStatus(status: string): ReconciledStatus {
  const normalized = (status || '').toLowerCase() as ReconciledStatus;
  return KNOWN_STATUSES.includes(normalized) ? normalized : 'pending';
}

/**
 * A refund is a successfully completed collection event in its own right (the money
 * moved, then was successfully returned) — not a failure — so it counts as successful
 * alongside 'collected'. Only 'rejected' (and 'pending', i.e. no attempt yet) are not.
 */
export function isSuccessfulReconciledStatus(status: ReconciledStatus): boolean {
  return status === 'collected' || status === 'refunded';
}

/**
 * True when a rejected or refunded attempt in this item's history was followed up
 * through a resubmission or real-time retry channel — surfaced so a failed/refunded
 * item that's already been retried can be told apart from one still awaiting a retry.
 */
export function wasRetriedAfterFailure(transactions: CollectionTransaction[]): boolean {
  const hadFailureOrRefund = transactions.some((txn) => {
    const status = (txn.collectionStatus || '').toLowerCase();
    return status === 'rejected' || status === 'refunded';
  });
  const hasRetryAttempt = transactions.some((txn) => txn.isResubmission || txn.isRealtime);
  return hadFailureOrRefund && hasRetryAttempt;
}

/**
 * Parses and lightly validates raw JSON as a Collections Service transaction array.
 */
export function parseCollectionsJson(raw: string): CollectionTransaction[] {
  const json = JSON.parse(raw);

  if (!Array.isArray(json)) {
    throw new Error('Expected a JSON array of collection transactions.');
  }

  return json.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Entry at index ${index} is not an object.`);
    }
    if (!Array.isArray(entry.paymentScheduleItemIds)) {
      throw new Error(`Entry at index ${index} is missing paymentScheduleItemIds.`);
    }
    if (!entry.collectionStatus) {
      throw new Error(`Entry at index ${index} is missing collectionStatus.`);
    }
    if (
      entry.amountDue === null ||
      entry.amountDue === undefined ||
      (typeof entry.amountDue === 'string' && entry.amountDue.trim() === '') ||
      isNaN(Number(entry.amountDue))
    ) {
      throw new Error(`Entry at index ${index} is missing or has an invalid amountDue.`);
    }
    // Coerce here (e.g. a numeric string) so CollectionTransaction.amountDue is genuinely a number downstream.
    entry.amountDue = Number(entry.amountDue);
    return entry as CollectionTransaction;
  });
}

/**
 * Reconciles each schedule item against the Collections Service transactions that
 * reference it (via paymentScheduleItemIds). When an item has multiple attempts —
 * a rejection followed by a resubmission, say — the chronologically latest one (by
 * provider processing date) is treated as the item's current outcome.
 */
export function reconcileScheduleItems(
  scheduleItems: ScheduleItem[],
  collections: CollectionTransaction[]
): Map<string, ItemReconciliation> {
  const result = new Map<string, ItemReconciliation>();

  for (const item of scheduleItems) {
    const transactions = collections
      .filter((txn) => txn.paymentScheduleItemIds.includes(item.id))
      .sort((a, b) => getProcessingTime(a) - getProcessingTime(b));

    const latestTransaction = transactions.length > 0 ? transactions[transactions.length - 1] : null;
    const status: ReconciledStatus = latestTransaction ? normalizeStatus(latestTransaction.collectionStatus) : 'pending';

    // Batched collections cover several items with one combined amount, so amount
    // reconciliation only makes sense when the transaction covers this item alone.
    const amountMismatch =
      latestTransaction !== null &&
      latestTransaction.paymentScheduleItemIds.length === 1 &&
      Math.abs(Number(latestTransaction.amountDue) - Number(item.amountDue)) > AMOUNT_TOLERANCE;

    const statusMismatch = item.succeeded !== null && item.succeeded !== isSuccessfulReconciledStatus(status);
    const wasRetried = wasRetriedAfterFailure(transactions);

    result.set(item.id, { status, transactions, latestTransaction, amountMismatch, statusMismatch, wasRetried });
  }

  return result;
}

export function summarizeReconciliation(reconciliation: Map<string, ItemReconciliation>): ReconciliationSummary {
  const summary: ReconciliationSummary = {
    totalItems: reconciliation.size,
    collected: 0,
    rejected: 0,
    refunded: 0,
    pending: 0,
    mismatches: 0
  };

  for (const entry of reconciliation.values()) {
    summary[entry.status] += 1;
    if (entry.amountMismatch || entry.statusMismatch) {
      summary.mismatches += 1;
    }
  }

  return summary;
}
