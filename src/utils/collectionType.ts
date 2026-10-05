import type { ScheduleItem } from '../types';

/**
 * CollectionType casing depends on the source: the Payment Schedule Service returns
 * camelCase ('full', 'proRata') while Policy Admin/Rerates/SEQ documents use PascalCase
 * ('Full', 'ProRata'), so comparisons must ignore case.
 */
export function isCollectionType(item: Pick<ScheduleItem, 'collectionType'> | null | undefined, type: 'full' | 'proRata'): boolean {
  return (item?.collectionType || '').toLowerCase() === type.toLowerCase();
}

/**
 * Indexes of pro-rata items with no originalItem. A pro-rata adjustment is always computed
 * against the Full item it replaces, so a missing originalItem means the schedule lost that
 * basis and the item's amount/period can't be verified — the schedule is likely wrong.
 */
export function findProRataItemsWithoutOriginal(items: ScheduleItem[]): number[] {
  return items.flatMap((item, index) => (isCollectionType(item, 'proRata') && !item.originalItem ? [index] : []));
}
