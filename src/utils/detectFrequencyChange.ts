import type { PaymentScheduleResponse, ScheduleItem } from "../types";
import { isCollectionType } from "./collectionType";

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

/** Whole days from start to end, or NaN when either date is invalid. */
function daysBetween(start: string, end: string): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return Number.NaN;
  return Math.round((endTime - startTime) / (1000 * 60 * 60 * 24));
}

/** Whether a period length is about a month. */
function isRoughlyMonthly(days: number): boolean {
  return days >= MONTHLY_MIN_DAYS && days <= MONTHLY_MAX_DAYS;
}

/** Whether a period length covers essentially the whole cover period. */
function isRoughlyAnnual(days: number, coverDays: number): boolean {
  return coverDays > 0 && days >= coverDays * ANNUAL_COVERAGE_RATIO;
}

/** Whether the schedule is collected annually. */
function isAnnualSchedule(schedule: PaymentScheduleResponse): boolean {
  return (schedule.collectionFrequency || "").toLowerCase() === "annual";
}

/** Index of the last item matching the predicate, or -1. */
function findLastIndex(
  items: ScheduleItem[],
  predicate: (item: ScheduleItem) => boolean,
): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i])) return i;
  }
  return -1;
}

/** Whether the item is a Full Item. */
function isFull(item: ScheduleItem): boolean {
  return isCollectionType(item, "full");
}

/**
 * The 'Full' record whose period shape 1 inspects: the item itself when it is a Full Item, else the
 * Basis Item behind a Pro-Rata Item when that Basis Item is Full, else null.
 */
function fullBasisCandidate(item: ScheduleItem): ScheduleItem | null {
  if (isFull(item)) return item;
  if (item.originalItem && isFull(item.originalItem))
    return item.originalItem;
  return null;
}

/**
 * Shape 1 (annual true-up): scans for a Full record spanning essentially the whole cover period once
 * at least two monthly-length Full Items have been seen. Also returns the monthly count observed.
 */
function detectAnnualTrueUp(
  items: ScheduleItem[],
  coverDays: number,
): { detection: FrequencyChangeDetection | null; monthlyCount: number } {
  let monthlyCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (
      isFull(item) &&
      isRoughlyMonthly(daysBetween(item.periodStartDate, item.periodEndDate))
    ) {
      monthlyCount++;
    }

    const candidate =
      monthlyCount >= MIN_MONTHLY_OBSERVATIONS
        ? fullBasisCandidate(item)
        : null;
    if (!candidate) continue;

    const candidateDays = daysBetween(
      candidate.periodStartDate,
      candidate.periodEndDate,
    );
    if (
      isRoughlyAnnual(candidateDays, coverDays) &&
      !isRoughlyMonthly(candidateDays)
    ) {
      return {
        monthlyCount,
        detection: {
          detected: true,
          pivotItemId: item.id,
          pivotIndex: i,
          message: `This schedule appears to have switched from Monthly to Annual collection around item #${i} (basis period ${candidate.periodStartDate} to ${candidate.periodEndDate}).`,
        },
      };
    }
  }

  return { detection: null, monthlyCount };
}

/** Shape 2 (late switch): the pivot is the last Full Item ending on the cover end date, else the last Full Item. */
function detectLateSwitch(
  schedule: PaymentScheduleResponse,
  monthlyCount: number,
): FrequencyChangeDetection {
  const items = schedule.scheduleItems;
  const remainderIndex = findLastIndex(
    items,
    (item) =>
      isFull(item) &&
      daysBetween(item.periodEndDate, schedule.coverEndDate) === 0,
  );
  const pivotIndex =
    remainderIndex >= 0 ? remainderIndex : findLastIndex(items, isFull);
  const pivot = items[pivotIndex];
  return {
    detected: true,
    pivotItemId: pivot.id,
    pivotIndex,
    message: `This schedule is Annual but contains ${monthlyCount} monthly-length collections, so it appears to have switched from Monthly to Annual late in the cover period; the remaining cover is collected by item #${pivotIndex} (period ${pivot.periodStartDate} to ${pivot.periodEndDate}).`,
  };
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
export function detectFrequencyChange(
  schedule: PaymentScheduleResponse,
): FrequencyChangeDetection {
  const coverDays = daysBetween(schedule.coverStartDate, schedule.coverEndDate);
  // NaN (an invalid cover date) must also bail out, which a bare `coverDays <= 0` would miss.
  if (Number.isNaN(coverDays) || coverDays <= 0) return { detected: false };

  const { detection, monthlyCount } = detectAnnualTrueUp(
    schedule.scheduleItems,
    coverDays,
  );
  if (detection) return detection;

  if (monthlyCount >= MIN_MONTHLY_OBSERVATIONS && isAnnualSchedule(schedule)) {
    return detectLateSwitch(schedule, monthlyCount);
  }

  return { detected: false };
}
