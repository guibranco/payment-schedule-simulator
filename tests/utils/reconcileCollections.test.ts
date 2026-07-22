import { describe, it, expect } from 'vitest';
import {
  parseCollectionsJson,
  reconcileScheduleItems,
  summarizeReconciliation,
  isSuccessfulReconciledStatus,
  getTransactionDate,
  wasRetriedAfterFailure
} from '../../src/utils/reconcileCollections';
import { CollectionTransaction, ReconciledStatus, ScheduleItem } from '../../src/types';

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'item-1',
    collectionType: 'Full',
    periodStartDate: '2026-01-10',
    periodEndDate: '2026-02-09',
    adjustmentDate: '0001-01-01T00:00:00-00:25',
    dueDate: '2025-11-25',
    amountDue: 34.09,
    netAmount: 32.46,
    taxesAndLevies: {},
    adminFees: {},
    succeeded: null,
    ...overrides
  };
}

function makeTxn(overrides: Partial<CollectionTransaction> = {}): CollectionTransaction {
  return {
    paymentScheduleItemIds: ['item-1'],
    amountDue: 34.09,
    collectionStatus: 'collected',
    providerDetails: { processingDate: '2025-11-25T22:05:39.4698746+00:00' },
    ...overrides
  };
}

describe('isSuccessfulReconciledStatus', () => {
  it.each<[ReconciledStatus, boolean]>([
    ['collected', true],
    ['refunded', true],
    ['rejected', false],
    ['pending', false]
  ])('treats %s as successful: %s', (status, expected) => {
    expect(isSuccessfulReconciledStatus(status)).toBe(expected);
  });
});

describe('wasRetriedAfterFailure', () => {
  it('is true when a rejection is followed by a resubmission attempt', () => {
    const transactions = [
      makeTxn({ collectionStatus: 'rejected', isResubmission: false }),
      makeTxn({ collectionStatus: 'collected', isResubmission: true })
    ];
    expect(wasRetriedAfterFailure(transactions)).toBe(true);
  });

  it('is true when a rejection is followed by a real-time retry attempt', () => {
    const transactions = [
      makeTxn({ collectionStatus: 'rejected' }),
      makeTxn({ collectionStatus: 'rejected', isResubmission: true }),
      makeTxn({ collectionStatus: 'collected', isRealtime: true })
    ];
    expect(wasRetriedAfterFailure(transactions)).toBe(true);
  });

  it('is false for a single rejection with no retry attempt yet', () => {
    const transactions = [makeTxn({ collectionStatus: 'rejected' })];
    expect(wasRetriedAfterFailure(transactions)).toBe(false);
  });

  it('is false for a standalone refund with no follow-up retry', () => {
    const transactions = [makeTxn({ collectionStatus: 'refunded' })];
    expect(wasRetriedAfterFailure(transactions)).toBe(false);
  });

  it('is false for a plain realtime collection with no prior failure', () => {
    const transactions = [makeTxn({ collectionStatus: 'collected', isRealtime: true })];
    expect(wasRetriedAfterFailure(transactions)).toBe(false);
  });

  it('is false when a real-time collection is refunded afterward, since the retry attempt did not follow a failure', () => {
    const transactions = [
      makeTxn({
        collectionStatus: 'collected',
        isRealtime: true,
        providerDetails: { processingDate: '2026-01-01T00:00:00Z' }
      }),
      makeTxn({
        collectionStatus: 'refunded',
        providerDetails: { processingDate: '2026-02-01T00:00:00Z' }
      })
    ];
    expect(wasRetriedAfterFailure(transactions)).toBe(false);
  });

  it('is false for an empty transaction list', () => {
    expect(wasRetriedAfterFailure([])).toBe(false);
  });

  it('treats an empty-string collectionStatus as neither a failure nor a retry trigger', () => {
    const transactions = [
      makeTxn({ collectionStatus: '' }),
      makeTxn({ collectionStatus: '', isResubmission: true })
    ];
    expect(wasRetriedAfterFailure(transactions)).toBe(false);
  });
});

describe('getTransactionDate', () => {
  it('prefers providerDetails.processingDate over every other date field', () => {
    const txn = makeTxn({
      providerDetails: { processingDate: 'P' },
      modifiedDate: 'M',
      createdDate: 'C',
      valueDate: 'V',
      dueDate: 'D'
    });
    expect(getTransactionDate(txn)).toBe('P');
  });

  it('falls back to modifiedDate when processingDate is absent', () => {
    const txn = makeTxn({ providerDetails: undefined, modifiedDate: 'M', createdDate: 'C', valueDate: 'V', dueDate: 'D' });
    expect(getTransactionDate(txn)).toBe('M');
  });

  it('falls back to createdDate when processingDate/modifiedDate are absent', () => {
    const txn = makeTxn({ providerDetails: undefined, createdDate: 'C', valueDate: 'V', dueDate: 'D' });
    expect(getTransactionDate(txn)).toBe('C');
  });

  it('falls back to valueDate when processingDate/modifiedDate/createdDate are absent', () => {
    const txn = makeTxn({ providerDetails: undefined, valueDate: 'V', dueDate: 'D' });
    expect(getTransactionDate(txn)).toBe('V');
  });

  it('falls back to dueDate as a last resort', () => {
    const txn = makeTxn({ providerDetails: undefined, dueDate: 'D' });
    expect(getTransactionDate(txn)).toBe('D');
  });

  it('returns undefined when no date field is present at all', () => {
    const txn = makeTxn({ providerDetails: undefined, dueDate: undefined });
    expect(getTransactionDate(txn)).toBeUndefined();
  });
});

describe('parseCollectionsJson', () => {
  it('parses a valid JSON array of transactions', () => {
    const raw = JSON.stringify([makeTxn()]);
    expect(parseCollectionsJson(raw)).toHaveLength(1);
  });

  it('throws on invalid JSON syntax', () => {
    expect(() => parseCollectionsJson('{ not valid')).toThrow(SyntaxError);
  });

  it('throws when the payload is not an array', () => {
    expect(() => parseCollectionsJson('{}')).toThrow('Expected a JSON array of collection transactions.');
  });

  it('throws when an array entry is not an object', () => {
    expect(() => parseCollectionsJson(JSON.stringify([null]))).toThrow('is not an object');
    expect(() => parseCollectionsJson(JSON.stringify(['a string']))).toThrow('is not an object');
  });

  it('throws when an entry is missing paymentScheduleItemIds', () => {
    const raw = JSON.stringify([{ collectionStatus: 'collected' }]);
    expect(() => parseCollectionsJson(raw)).toThrow('missing paymentScheduleItemIds');
  });

  it('throws when an entry is missing collectionStatus', () => {
    const raw = JSON.stringify([{ paymentScheduleItemIds: ['item-1'] }]);
    expect(() => parseCollectionsJson(raw)).toThrow('missing collectionStatus');
  });

  it('throws when an entry is missing amountDue', () => {
    const raw = JSON.stringify([{ paymentScheduleItemIds: ['item-1'], collectionStatus: 'collected' }]);
    expect(() => parseCollectionsJson(raw)).toThrow('missing or has an invalid amountDue');
  });

  it('throws when an entry has a non-numeric amountDue', () => {
    const raw = JSON.stringify([
      { paymentScheduleItemIds: ['item-1'], collectionStatus: 'collected', amountDue: 'not-a-number' }
    ]);
    expect(() => parseCollectionsJson(raw)).toThrow('missing or has an invalid amountDue');
  });

  it('coerces a numeric string amountDue to a number (as the Collections API may serialize it)', () => {
    const raw = JSON.stringify([
      { paymentScheduleItemIds: ['item-1'], collectionStatus: 'collected', amountDue: '34.09' }
    ]);
    expect(parseCollectionsJson(raw)[0].amountDue).toBe(34.09);
  });

  it('throws on an empty or whitespace-only string amountDue instead of silently coercing to 0', () => {
    const blank = JSON.stringify([{ paymentScheduleItemIds: ['item-1'], collectionStatus: 'collected', amountDue: '' }]);
    const whitespace = JSON.stringify([
      { paymentScheduleItemIds: ['item-1'], collectionStatus: 'collected', amountDue: '   ' }
    ]);
    expect(() => parseCollectionsJson(blank)).toThrow('missing or has an invalid amountDue');
    expect(() => parseCollectionsJson(whitespace)).toThrow('missing or has an invalid amountDue');
  });

  it('accepts a genuine zero amountDue', () => {
    const raw = JSON.stringify([{ paymentScheduleItemIds: ['item-1'], collectionStatus: 'collected', amountDue: 0 }]);
    expect(parseCollectionsJson(raw)[0].amountDue).toBe(0);
  });
});

describe('reconcileScheduleItems', () => {
  it('marks an item as collected when its transaction succeeded', () => {
    const items = [makeItem()];
    const collections = [makeTxn({ collectionStatus: 'collected' })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.status).toBe('collected');
    expect(result.get('item-1')?.amountMismatch).toBe(false);
    expect(result.get('item-1')?.statusMismatch).toBe(false);
  });

  it('sets wasRetried when a rejection is followed by a resubmission for that item', () => {
    const items = [makeItem()];
    const collections = [
      makeTxn({ collectionStatus: 'rejected', providerDetails: { processingDate: '2026-01-25T00:00:00Z' } }),
      makeTxn({
        collectionStatus: 'collected',
        isResubmission: true,
        providerDetails: { processingDate: '2026-02-01T00:00:00Z' }
      })
    ];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.wasRetried).toBe(true);
  });

  it('leaves wasRetried false for an item with only a single, not-yet-retried rejection', () => {
    const items = [makeItem()];
    const collections = [makeTxn({ collectionStatus: 'rejected' })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.wasRetried).toBe(false);
  });

  it('treats a transaction with no date fields at all as the earliest attempt when sorting', () => {
    const items = [makeItem()];
    const collections = [
      { paymentScheduleItemIds: ['item-1'], amountDue: 1, collectionStatus: 'rejected' },
      makeTxn({ collectionStatus: 'collected', providerDetails: { processingDate: '2026-01-01T00:00:00Z' } })
    ];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.status).toBe('collected');
  });

  it('uses the chronologically latest transaction when a rejection is later resubmitted', () => {
    const items = [makeItem()];
    const collections = [
      makeTxn({
        collectionStatus: 'rejected',
        providerDetails: { processingDate: '2026-01-25T22:04:10+00:00', errorMessage: 'Not sufficient funds' }
      }),
      makeTxn({
        collectionStatus: 'collected',
        providerDetails: { processingDate: '2026-02-01T22:04:47+00:00' }
      })
    ];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.status).toBe('collected');
    expect(result.get('item-1')?.transactions).toHaveLength(2);
    expect(result.get('item-1')?.latestTransaction?.collectionStatus).toBe('collected');
  });

  it('marks an item as pending when no transaction references it', () => {
    const items = [makeItem()];
    const result = reconcileScheduleItems(items, []);

    expect(result.get('item-1')?.status).toBe('pending');
    expect(result.get('item-1')?.transactions).toHaveLength(0);
  });

  it('flags an amount mismatch for a single-item transaction with a different amount', () => {
    const items = [makeItem({ amountDue: 34.09 })];
    const collections = [makeTxn({ amountDue: 10 })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.amountMismatch).toBe(true);
  });

  it('does not flag an amount mismatch for a batched transaction covering multiple items', () => {
    const items = [makeItem({ amountDue: 34.09 })];
    const collections = [makeTxn({ amountDue: 116.73, paymentScheduleItemIds: ['item-1', 'item-2'] })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.amountMismatch).toBe(false);
  });

  it('flags a status mismatch when the schedule item claims succeeded but Collections shows rejected', () => {
    const items = [makeItem({ succeeded: true })];
    const collections = [makeTxn({ collectionStatus: 'rejected' })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.statusMismatch).toBe(true);
  });

  it('flags a status mismatch when the schedule item claims failure but Collections shows collected', () => {
    const items = [makeItem({ succeeded: false })];
    const collections = [makeTxn({ collectionStatus: 'collected' })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.statusMismatch).toBe(true);
  });

  it('does not flag a status mismatch when the schedule item has no recorded succeeded value', () => {
    const items = [makeItem({ succeeded: null })];
    const collections = [makeTxn({ collectionStatus: 'rejected' })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.statusMismatch).toBe(false);
  });

  it('treats a refund as a successful outcome, not a status mismatch, when the item claims succeeded', () => {
    const items = [makeItem({ succeeded: true })];
    const collections = [makeTxn({ collectionStatus: 'refunded' })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.status).toBe('refunded');
    expect(result.get('item-1')?.statusMismatch).toBe(false);
  });

  it('flags a status mismatch when the schedule item claims failure but Collections shows a refund', () => {
    const items = [makeItem({ succeeded: false })];
    const collections = [makeTxn({ collectionStatus: 'refunded' })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.statusMismatch).toBe(true);
  });

  it('normalizes an unrecognized collection status to pending', () => {
    const items = [makeItem()];
    const collections = [makeTxn({ collectionStatus: 'processing' })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.status).toBe('pending');
  });

  it('normalizes an empty-string collection status to pending rather than throwing', () => {
    const items = [makeItem()];
    const collections = [makeTxn({ collectionStatus: '' })];

    const result = reconcileScheduleItems(items, collections);

    expect(result.get('item-1')?.status).toBe('pending');
  });
});

describe('summarizeReconciliation', () => {
  it('counts items by status and tallies mismatches', () => {
    const items = [
      makeItem({ id: 'a', succeeded: true }),
      makeItem({ id: 'b', succeeded: null }),
      makeItem({ id: 'c', succeeded: null })
    ];
    const collections = [
      makeTxn({ paymentScheduleItemIds: ['a'], collectionStatus: 'rejected' }),
      makeTxn({ paymentScheduleItemIds: ['b'], collectionStatus: 'refunded' })
    ];

    const summary = summarizeReconciliation(reconcileScheduleItems(items, collections));

    expect(summary).toEqual({
      totalItems: 3,
      collected: 0,
      rejected: 1,
      refunded: 1,
      pending: 1,
      mismatches: 1
    });
  });
});
