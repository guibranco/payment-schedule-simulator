import type { PaymentScheduleResponse, ScheduleItem } from '../types';

export interface FrequencyChangeDetection {
  detected: boolean;
  pivotItemId?: string;
  pivotIndex?: number;
  message?: string;
}

const MONTHLY_MIN_DAYS = 25;
const MONTHLY_MAX_DAYS = 35;
const ANNUAL_COVERAGE_RATIO = 0.9;
const MIN_MONTHLY_OBSERVATIONS = 2;

function daysBetween(start: string, end: string): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (isNaN(startTime) || isNaN(endTime)) return NaN;
  return Math.round((endTime - startTime) / (1000 * 60 * 60 * 24));
}

function isRoughlyMonthly(days: number): boolean {
  return days >= MONTHLY_MIN_DAYS && days <= MONTHLY_MAX_DAYS;
}

function isRoughlyAnnual(days: number, coverDays: number): boolean {
  return coverDays > 0 && days >= coverDays * ANNUAL_COVERAGE_RATIO;
}

function isAnnualSchedule(schedule: PaymentScheduleResponse): boolean {
  return (schedule.collectionFrequency || '').toLowerCase() === 'annual';
}

function findLastIndex(items: ScheduleItem[], predicate: (item: ScheduleItem) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i])) return i;
  }
  return -1;
}

/**
 * Detects a schedule that started on Monthly collections and later switched to Annual.
 *
 * Both recognised shapes start with a run of at least two monthly-length 'Full' items:
 *
 * 1. Annual true-up — a later 'Full' record (a top-level item, or the originalItem basis behind a
 *    pro-rata adjustment) whose period spans essentially the whole cover period. That record is the pivot.
 *
 * 2. Late switch — Policy Admin re-collects the remaining cover as a single 'Full' item under the new
 *    frequency. When the switch happens near the end of the cover period that remainder is itself only a
 *    month or so long, so no record spans the cover period and shape 1 cannot fire. The tell is then the
 *    schedule's own collectionFrequency being Annual while it still carries monthly-length Full
 *    collections, which a schedule that was Annual from inception never has. The pivot is the last Full
 *    item ending on the cover end date: the remainder collection appended by the switch.
 */
export function detectFrequencyChange(schedule: PaymentScheduleResponse): FrequencyChangeDetection {
  const coverDays = daysBetween(schedule.coverStartDate, schedule.coverEndDate);
  if (!(coverDays > 0)) return { detected: false };

  let monthlyCount = 0;

  for (let i = 0; i < schedule.scheduleItems.length; i++) {
    const item = schedule.scheduleItems[i];

    if (item.collectionType === 'Full') {
      const days = daysBetween(item.periodStartDate, item.periodEndDate);
      if (isRoughlyMonthly(days)) monthlyCount++;
    }

    if (monthlyCount < MIN_MONTHLY_OBSERVATIONS) continue;

    const candidate: ScheduleItem | null =
      item.collectionType === 'Full' ? item : item.originalItem?.collectionType === 'Full' ? item.originalItem : null;
    if (!candidate) continue;

    const candidateDays = daysBetween(candidate.periodStartDate, candidate.periodEndDate);
    if (isRoughlyAnnual(candidateDays, coverDays) && !isRoughlyMonthly(candidateDays)) {
      return {
        detected: true,
        pivotItemId: item.id,
        pivotIndex: i,
        message: `This schedule appears to have switched from Monthly to Annual collection around item #${i} (basis period ${candidate.periodStartDate} to ${candidate.periodEndDate}).`
      };
    }
  }

  if (monthlyCount >= MIN_MONTHLY_OBSERVATIONS && isAnnualSchedule(schedule)) {
    const items = schedule.scheduleItems;
    const isFull = (item: ScheduleItem) => item.collectionType === 'Full';
    const remainderIndex = findLastIndex(items, (item) => isFull(item) && daysBetween(item.periodEndDate, schedule.coverEndDate) === 0);
    const pivotIndex = remainderIndex >= 0 ? remainderIndex : findLastIndex(items, isFull);
    const pivot = items[pivotIndex];
    return {
      detected: true,
      pivotItemId: pivot.id,
      pivotIndex,
      message: `This schedule is Annual but contains ${monthlyCount} monthly-length collections, so it appears to have switched from Monthly to Annual late in the cover period; the remaining cover is collected by item #${pivotIndex} (period ${pivot.periodStartDate} to ${pivot.periodEndDate}).`
    };
  }

  return { detected: false };
}
