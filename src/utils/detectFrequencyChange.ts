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

/**
 * Detects a schedule that started on Monthly collections and later switched to Annual.
 * The tell is a run of ~monthly-length 'Full' items followed by a 'Full' record — either a
 * top-level item, or the originalItem basis behind a later pro-rata true-up adjustment —
 * whose period spans essentially the whole cover period rather than a single month.
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

  return { detected: false };
}
