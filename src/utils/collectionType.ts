import type { ScheduleItem } from '../types';

/**
 * CollectionType casing depends on the source: the Payment Schedule Service returns
 * camelCase ('full', 'proRata') while Policy Admin/Rerates/SEQ documents use PascalCase
 * ('Full', 'ProRata'), so comparisons must ignore case.
 */
export function isCollectionType(item: Pick<ScheduleItem, 'collectionType'> | null | undefined, type: 'full' | 'proRata'): boolean {
  return (item?.collectionType || '').toLowerCase() === type.toLowerCase();
}
