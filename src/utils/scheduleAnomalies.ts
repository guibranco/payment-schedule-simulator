import type { PaymentScheduleResponse, ScheduleItem } from '../types';
import { isCollectionType } from './collectionType';
import { detectFrequencyChange } from './detectFrequencyChange';

export type AnomalySeverity = 'info' | 'warning';

export type AnomalyKind =
  | 'frequencySwitch'
  | 'orphanedProRataItem'
  | 'nestedBasisItem'
  | 'proRataAmountMismatch'
  | 'unverifiedProRataAmount'
  | 'stampDutyImbalance'
  | 'unexpectedStampDutyAmount'
  | 'annualPremiumMismatch'
  | 'collectionFeeCharged'
  | 'prohibitedCancellationFee'
  | 'surgeryDetected';

/** A detected condition suggesting a schedule is unusual or possibly wrong (see CONTEXT.md). */
export interface ScheduleAnomaly {
  kind: AnomalyKind;
  severity: AnomalySeverity;
  title: string;
  message: string;
  /** Indexes of the Schedule Items the anomaly points at; empty for schedule-wide anomalies. */
  itemIndexes: number[];
}

const STAMP_DUTY = 'SMD';
const CANCELLATION_FEE = 'CAN';
const COLLECTION_FEE = 'CLF';
const STAMP_DUTY_AMOUNT = 1;
const VOIDED_OR_CANCELLED_STATUS = 'CX';
/** The latest cover end date on which a Cancellation Fee above zero may have been charged (CPC regulation). */
const LAST_CANCELLATION_FEE_DATE = '2026-06-30';
const AMOUNT_TOLERANCE = 0.02;
/** Dividing a premium into 12 instalments leaves up to €0.11, all added to the first Full Item. */
const ROUNDING_REMAINDER_TOLERANCE = 0.12;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day number of an ISO date/date-time, ignoring time and offset (periods are inclusive whole days). */
function dayNumber(date: string | null | undefined): number {
  if (!date) return NaN;
  return Math.round(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / DAY_MS);
}

function formatAmount(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

function itemList(indexes: number[]): string {
  return indexes.map((i) => `#${i}`).join(', ');
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

function adminFeeAmount(item: ScheduleItem, code: string): number | null {
  const fee = Object.entries(item.adminFees || {}).find(([key]) => key.toUpperCase() === code)?.[1];
  return fee ? Number(fee.amountDue || 0) : null;
}

function isAdminFeeItem(item: ScheduleItem): boolean {
  return Object.keys(item.adminFees || {}).length > 0;
}

/** Full Items that collect premium (not Admin Fee Items), in schedule order with their indexes. */
function premiumFullItems(items: ScheduleItem[]): Array<{ item: ScheduleItem; index: number }> {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isCollectionType(item, 'full') && !isAdminFeeItem(item));
}

function detectFrequencySwitch(schedule: PaymentScheduleResponse): ScheduleAnomaly[] {
  const detection = detectFrequencyChange(schedule);
  if (!detection.detected) return [];
  return [
    {
      kind: 'frequencySwitch',
      severity: 'info',
      title: 'Frequency Switch',
      message: detection.message ?? 'This schedule appears to have switched from Monthly to Annual collection.',
      itemIndexes: detection.pivotIndex !== undefined ? [detection.pivotIndex] : []
    }
  ];
}

function detectOrphanedProRataItems(items: ScheduleItem[]): ScheduleAnomaly[] {
  const indexes = items.flatMap((item, index) => (isCollectionType(item, 'proRata') && !item.originalItem ? [index] : []));
  if (indexes.length === 0) return [];
  return [
    {
      kind: 'orphanedProRataItem',
      severity: 'warning',
      title: 'Orphaned Pro-Rata Item',
      message: `This schedule is possibly wrong: ${plural(indexes.length, 'Pro-Rata Item', 'Pro-Rata Items')} ${itemList(indexes)} ${plural(indexes.length, 'has', 'have')} no Basis Item. A Pro-Rata Item is always calculated from a Basis Item, so without it the amount and period can't be verified.`,
      itemIndexes: indexes
    }
  ];
}

function detectNestedBasisItems(items: ScheduleItem[]): ScheduleAnomaly[] {
  const indexes = items.flatMap((item, index) => (item.originalItem?.originalItem ? [index] : []));
  if (indexes.length === 0) return [];
  return [
    {
      kind: 'nestedBasisItem',
      severity: 'warning',
      title: 'Nested Basis Item',
      message: `The Basis Item of ${plural(indexes.length, 'item', 'items')} ${itemList(indexes)} has a Basis Item of its own. Basis Items are only one level deep, so the chain should have stopped at the first one.`,
      itemIndexes: indexes
    }
  ];
}

/**
 * The only Pro-Rata scenario that can be checked so far: Full Items contiguously cover the Basis
 * period from its start up to the day before the Pro-Rata Item starts, and the Pro-Rata Item runs to
 * the Basis period's end. The Pro-Rata amount is then the Basis amount minus those Full Items.
 * Returns null when the item doesn't fit that scenario.
 */
function expectedProRataAmount(
  proRata: ScheduleItem,
  fullItems: Array<{ item: ScheduleItem; index: number }>
): { expected: number; tolerance: number } | null {
  const basis = proRata.originalItem;
  if (!basis) return null;

  const basisStart = dayNumber(basis.periodStartDate);
  const proRataStart = dayNumber(proRata.periodStartDate);
  if (dayNumber(proRata.periodEndDate) !== dayNumber(basis.periodEndDate) || !(proRataStart > basisStart)) return null;

  const covering = fullItems
    .filter(({ item }) => dayNumber(item.periodStartDate) >= basisStart && dayNumber(item.periodEndDate) < proRataStart)
    .sort((a, b) => dayNumber(a.item.periodStartDate) - dayNumber(b.item.periodStartDate));
  if (covering.length === 0) return null;

  let nextDay = basisStart;
  for (const { item } of covering) {
    if (dayNumber(item.periodStartDate) !== nextDay) return null;
    nextDay = dayNumber(item.periodEndDate) + 1;
  }
  if (nextDay !== proRataStart) return null;

  const firstFullIndex = fullItems[0]?.index;
  const includesFirst = covering.some(({ index }) => index === firstFullIndex);
  return {
    expected: Number(basis.amountDue) - covering.reduce((sum, { item }) => sum + Number(item.amountDue), 0),
    tolerance: includesFirst ? ROUNDING_REMAINDER_TOLERANCE : AMOUNT_TOLERANCE
  };
}

function detectProRataAmounts(items: ScheduleItem[]): ScheduleAnomaly[] {
  const fullItems = premiumFullItems(items);
  const mismatches: Array<{ index: number; expected: number; actual: number }> = [];
  const unverified: number[] = [];

  items.forEach((item, index) => {
    // Orphaned Pro-Rata Items are already reported; there's nothing to check them against.
    if (!isCollectionType(item, 'proRata') || !item.originalItem) return;
    const check = expectedProRataAmount(item, fullItems);
    if (!check) {
      unverified.push(index);
    } else if (Math.abs(check.expected - Number(item.amountDue)) > check.tolerance) {
      mismatches.push({ index, expected: check.expected, actual: Number(item.amountDue) });
    }
  });

  const anomalies: ScheduleAnomaly[] = mismatches.map(({ index, expected, actual }) => ({
    kind: 'proRataAmountMismatch',
    severity: 'warning',
    title: 'Pro-Rata Amount Mismatch',
    message: `Pro-Rata Item #${index} is ${formatAmount(actual)}, but its Basis Item minus the Full Items already due for that period gives ${formatAmount(expected)}.`,
    itemIndexes: [index]
  }));

  if (unverified.length > 0) {
    anomalies.push({
      kind: 'unverifiedProRataAmount',
      severity: 'info',
      title: 'Unverified Pro-Rata Amount',
      message: `The amount of ${plural(unverified.length, 'Pro-Rata Item', 'Pro-Rata Items')} ${itemList(unverified)} wasn't checked: this scenario isn't supported by the amount check yet.`,
      itemIndexes: unverified
    });
  }
  return anomalies;
}

function totalAmountDue(items: ScheduleItem[]): number {
  return items.reduce((sum, item) => sum + Number(item.amountDue || 0), 0);
}

function detectStampDuty(schedule: PaymentScheduleResponse): ScheduleAnomaly[] {
  const items = schedule.scheduleItems;
  // Charges and refunds in the order they were applied (Adjustment Date, then schedule order).
  const entries = items
    .map((item, index) => ({ index, amount: adminFeeAmount(item, STAMP_DUTY), adjusted: dayNumber(item.adjustmentDate) }))
    .filter((entry): entry is { index: number; amount: number; adjusted: number } => entry.amount !== null && entry.amount !== 0)
    .sort((a, b) => (a.adjusted || 0) - (b.adjusted || 0) || a.index - b.index);

  const anomalies: ScheduleAnomaly[] = [];

  let net = 0;
  const outOfSequence: number[] = [];
  for (const entry of entries) {
    net += entry.amount > 0 ? 1 : -1;
    if (net < 0 || net > 1) outOfSequence.push(entry.index);
  }

  // A Void nets everything, Stamp Duty included, to zero. Without a status, a zero total is the only signal.
  const statusAllowsVoid = !schedule.riskStatus || schedule.riskStatus.toUpperCase() === VOIDED_OR_CANCELLED_STATUS;
  const isVoid = statusAllowsVoid && Math.abs(totalAmountDue(items)) <= AMOUNT_TOLERANCE;
  const expectedNet = isVoid ? 0 : 1;

  if (outOfSequence.length > 0 || net !== expectedNet) {
    const chargeCount = entries.filter((e) => e.amount > 0).length;
    const refundCount = entries.length - chargeCount;
    const reason =
      outOfSequence.length > 0
        ? `Stamp Duty charges and refunds don't alternate (see ${plural(outOfSequence.length, 'item', 'items')} ${itemList(outOfSequence)}).`
        : `It nets ${net} Stamp Duty ${plural(Math.abs(net), 'charge', 'charges')} (${chargeCount} charged, ${refundCount} refunded), but ${isVoid ? 'a Voided schedule should net 0' : 'a live schedule should net exactly 1'}.`;
    anomalies.push({
      kind: 'stampDutyImbalance',
      severity: 'warning',
      title: 'Stamp Duty Imbalance',
      message: reason,
      itemIndexes: outOfSequence.length > 0 ? outOfSequence : entries.map((e) => e.index)
    });
  }

  const unexpected = entries.filter((e) => Math.abs(Math.abs(e.amount) - STAMP_DUTY_AMOUNT) > 0.005).map((e) => e.index);
  if (unexpected.length > 0) {
    anomalies.push({
      kind: 'unexpectedStampDutyAmount',
      severity: 'info',
      title: 'Unexpected Stamp Duty Amount',
      message: `Stamp Duty on ${plural(unexpected.length, 'item', 'items')} ${itemList(unexpected)} isn't the fixed ${formatAmount(STAMP_DUTY_AMOUNT)}.`,
      itemIndexes: unexpected
    });
  }
  return anomalies;
}

function detectAnnualPremiumMismatch(schedule: PaymentScheduleResponse): ScheduleAnomaly[] {
  const premium = schedule.annualisedPremium;
  if (premium === null || premium === undefined || (schedule.collectionFrequency || '').toLowerCase() !== 'annual') return [];
  // After an MTA the Annualised Premium is the new premium while the Full Item keeps the old one.
  if (schedule.scheduleItems.some((item) => isCollectionType(item, 'proRata'))) return [];

  const coverStart = dayNumber(schedule.coverStartDate);
  const coverEnd = dayNumber(schedule.coverEndDate);
  return premiumFullItems(schedule.scheduleItems)
    .filter(({ item }) => dayNumber(item.periodStartDate) === coverStart && dayNumber(item.periodEndDate) === coverEnd)
    .filter(({ item }) => Math.abs(Number(item.netAmount) - Number(premium)) > AMOUNT_TOLERANCE)
    .map(({ item, index }) => ({
      kind: 'annualPremiumMismatch' as const,
      severity: 'warning' as const,
      title: 'Annual Premium Mismatch',
      message: `Full Item #${index} covers the whole cover period, but its net amount ${formatAmount(Number(item.netAmount))} doesn't match the Annualised Premium ${formatAmount(Number(premium))}.`,
      itemIndexes: [index]
    }));
}

function detectAdminFees(schedule: PaymentScheduleResponse): ScheduleAnomaly[] {
  const items = schedule.scheduleItems;
  const anomalies: ScheduleAnomaly[] = [];

  const collectionFeeItems = items.flatMap((item, index) => (adminFeeAmount(item, COLLECTION_FEE) !== null ? [index] : []));
  if (collectionFeeItems.length > 0) {
    anomalies.push({
      kind: 'collectionFeeCharged',
      severity: 'warning',
      title: 'Collection Fee Charged',
      message: `${plural(collectionFeeItems.length, 'Item', 'Items')} ${itemList(collectionFeeItems)} ${plural(collectionFeeItems.length, 'carries', 'carry')} a Collection Fee (${COLLECTION_FEE}), which compliance forbids charging.`,
      itemIndexes: collectionFeeItems
    });
  }

  if (dayNumber(schedule.coverEndDate) > dayNumber(LAST_CANCELLATION_FEE_DATE)) {
    const cancellationFeeItems = items.flatMap((item, index) => {
      const amount = adminFeeAmount(item, CANCELLATION_FEE);
      return amount !== null && amount !== 0 ? [index] : [];
    });
    if (cancellationFeeItems.length > 0) {
      anomalies.push({
        kind: 'prohibitedCancellationFee',
        severity: 'warning',
        title: 'Prohibited Cancellation Fee',
        message: `${plural(cancellationFeeItems.length, 'Item', 'Items')} ${itemList(cancellationFeeItems)} ${plural(cancellationFeeItems.length, 'carries', 'carry')} a non-zero Cancellation Fee (${CANCELLATION_FEE}), but the cover ends after 30/06/2026, when Cancellation Fees were no longer charged (CPC regulation).`,
        itemIndexes: cancellationFeeItems
      });
    }
  }
  return anomalies;
}

function detectSurgery(schedule: PaymentScheduleResponse): ScheduleAnomaly[] {
  const modifiedBy = schedule.modifiedBy;
  if (!modifiedBy || !modifiedBy.includes('@')) return [];
  return [
    {
      kind: 'surgeryDetected',
      severity: 'info',
      title: 'Surgery Detected',
      message: `This schedule was last modified manually by ${modifiedBy} rather than by a system account, indicating a Surgery.`,
      itemIndexes: []
    }
  ];
}

/** Runs every Schedule Anomaly check, returning warnings before info, each group in detection order. */
export function detectScheduleAnomalies(schedule: PaymentScheduleResponse | null | undefined): ScheduleAnomaly[] {
  if (!schedule) return [];
  const items = schedule.scheduleItems || [];
  const scheduleWithItems = { ...schedule, scheduleItems: items };

  const anomalies = [
    ...detectOrphanedProRataItems(items),
    ...detectNestedBasisItems(items),
    ...detectProRataAmounts(items),
    ...detectStampDuty(scheduleWithItems),
    ...detectAnnualPremiumMismatch(scheduleWithItems),
    ...detectAdminFees(scheduleWithItems),
    ...detectFrequencySwitch(scheduleWithItems),
    ...detectSurgery(scheduleWithItems)
  ];
  return [...anomalies.filter((a) => a.severity === 'warning'), ...anomalies.filter((a) => a.severity === 'info')];
}
