import { describe, it, expect } from 'vitest';
import { detectFrequencyChange } from '../../src/utils/detectFrequencyChange';
import { PaymentScheduleResponse, ScheduleItem } from '../../src/types';

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'item',
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

function makeSchedule(scheduleItems: ScheduleItem[], overrides: Partial<PaymentScheduleResponse> = {}): PaymentScheduleResponse {
  return {
    id: 'schedule-1',
    token: '',
    hash: '',
    collectionFrequency: 'annual',
    collectionDay: 0,
    inceptionDate: '2025-10-10',
    coverStartDate: '2025-10-10',
    coverEndDate: '2026-10-09',
    scheduleItems,
    ...overrides
  };
}

describe('detectFrequencyChange', () => {
  it('detects a switch modeled on the real-world pattern: monthly collections followed by an annual true-up basis', () => {
    // Mirrors the sample: 9 monthly Full items, then a ProRata item whose originalItem
    // is a synthetic Full record spanning the entire cover period (the annual basis).
    const monthlyPeriods: Array<[string, string]> = [
      ['2025-12-10', '2026-01-09'],
      ['2026-01-10', '2026-02-09'],
      ['2026-02-10', '2026-03-09'],
      ['2026-03-10', '2026-04-09'],
      ['2026-04-10', '2026-05-09'],
      ['2026-05-10', '2026-06-09'],
      ['2026-06-10', '2026-07-09'],
      ['2026-07-10', '2026-08-09'],
      ['2026-08-10', '2026-09-09']
    ];
    const monthlyItems: ScheduleItem[] = monthlyPeriods.map(([periodStartDate, periodEndDate], i) =>
      makeItem({ id: `monthly-${i}`, collectionType: 'Full', periodStartDate, periodEndDate })
    );

    const pivotItem = makeItem({
      id: 'pivot-item',
      collectionType: 'ProRata',
      periodStartDate: '2026-09-10',
      periodEndDate: '2026-10-09',
      originalItem: makeItem({
        id: 'synthetic-annual-basis',
        collectionType: 'Full',
        periodStartDate: '2025-10-10',
        periodEndDate: '2026-10-09',
        amountDue: 331.91,
        netAmount: 319.15
      })
    });

    const schedule = makeSchedule([...monthlyItems, pivotItem]);

    const result = detectFrequencyChange(schedule);

    expect(result.detected).toBe(true);
    expect(result.pivotItemId).toBe('pivot-item');
    expect(result.pivotIndex).toBe(monthlyItems.length);
  });

  it('does not detect a switch for a schedule that stays monthly throughout', () => {
    const items: ScheduleItem[] = Array.from({ length: 12 }, (_, i) =>
      makeItem({
        id: `monthly-${i}`,
        collectionType: 'Full',
        periodStartDate: `2026-${String(i + 1).padStart(2, '0')}-10`,
        periodEndDate: `2026-${String(i + 1).padStart(2, '0')}-28`
      })
    );

    const result = detectFrequencyChange(makeSchedule(items));

    expect(result.detected).toBe(false);
  });

  it('does not detect a switch for a schedule that is annual from the start', () => {
    const items: ScheduleItem[] = [
      makeItem({ id: 'annual-1', collectionType: 'Full', periodStartDate: '2025-10-10', periodEndDate: '2026-10-09' })
    ];

    const result = detectFrequencyChange(makeSchedule(items));

    expect(result.detected).toBe(false);
  });

  it('requires at least 2 monthly-length observations before considering a candidate as a switch', () => {
    const items: ScheduleItem[] = [
      makeItem({ id: 'monthly-1', collectionType: 'Full', periodStartDate: '2025-10-10', periodEndDate: '2025-11-09' }),
      makeItem({ id: 'annual-basis', collectionType: 'Full', periodStartDate: '2025-10-10', periodEndDate: '2026-10-09' })
    ];

    const result = detectFrequencyChange(makeSchedule(items));

    expect(result.detected).toBe(false);
  });

  it('ignores ProRata items when counting monthly observations', () => {
    const items: ScheduleItem[] = [
      makeItem({ id: 'pro-rata-1', collectionType: 'ProRata', periodStartDate: '2025-10-10', periodEndDate: '2025-11-09' }),
      makeItem({ id: 'pro-rata-2', collectionType: 'ProRata', periodStartDate: '2025-11-10', periodEndDate: '2025-12-09' }),
      makeItem({ id: 'annual-basis', collectionType: 'Full', periodStartDate: '2025-10-10', periodEndDate: '2026-10-09' })
    ];

    const result = detectFrequencyChange(makeSchedule(items));

    expect(result.detected).toBe(false);
  });

  it('does not detect a switch when a ProRata item with no Full originalItem appears after enough monthly observations', () => {
    const items: ScheduleItem[] = [
      makeItem({ id: 'monthly-1', collectionType: 'Full', periodStartDate: '2025-10-10', periodEndDate: '2025-11-09' }),
      makeItem({ id: 'monthly-2', collectionType: 'Full', periodStartDate: '2025-11-10', periodEndDate: '2025-12-09' }),
      makeItem({ id: 'pro-rata-no-original', collectionType: 'ProRata', periodStartDate: '2025-12-10', periodEndDate: '2025-12-20' })
    ];

    const result = detectFrequencyChange(makeSchedule(items));

    expect(result.detected).toBe(false);
  });

  it('returns false for a zero-length or invalid cover period instead of throwing', () => {
    const schedule = makeSchedule([], { coverStartDate: '2026-01-01', coverEndDate: '2026-01-01' });
    expect(detectFrequencyChange(schedule).detected).toBe(false);

    const invalidSchedule = makeSchedule([], { coverStartDate: 'not-a-date', coverEndDate: '2026-01-01' });
    expect(detectFrequencyChange(invalidSchedule).detected).toBe(false);
  });
});
