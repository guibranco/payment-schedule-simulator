import type { ItemReconciliation, ScheduleItem } from "../../types";
import type { ScheduleAnomaly } from "../../utils/scheduleAnomalies";
import type { EffectiveValue } from "../../utils/reconcileCollections";
import ScheduleItemRow from "./ScheduleItemRow";

const COLUMNS = [
  "Index",
  "Period",
  "Due Date",
  "Net Amount",
  "Taxes & Levies",
  "Admin Fees",
  "Total",
  "Collection Item Created Date",
  "Status",
  "Adjustment Date",
  "Has Basis Item",
];

interface Props {
  items: ScheduleItem[];
  anomalies: ScheduleAnomaly[];
  /** Reconciliation per item id, or null when no collections are loaded. */
  reconciliation: Map<string, ItemReconciliation> | null;
  getCreatedDate: (
    item: ScheduleItem,
  ) => EffectiveValue<string | null | undefined>;
  getSucceeded: (item: ScheduleItem) => EffectiveValue<boolean | null>;
  onStatusChange?: (index: number) => void;
  onShowBasisItem: (basisItem: ScheduleItem) => void;
  onShowReconciliation: (itemId: string) => void;
}

/** The Schedule Items table, adding a Collections column once collections are loaded. */
export default function ScheduleItemsTable({
  items,
  anomalies,
  reconciliation,
  getCreatedDate,
  getSucceeded,
  onStatusChange,
  onShowBasisItem,
  onShowReconciliation,
}: Readonly<Props>) {
  const frequencySwitchIndex = anomalies.find(
    (anomaly) => anomaly.kind === "frequencySwitch",
  )?.itemIndexes[0];
  const columns = reconciliation ? [...COLUMNS, "Collections"] : COLUMNS;

  /** The item's anomalies, except the Frequency Switch, which is marked separately. */
  const anomaliesForItem = (index: number) =>
    anomalies.filter(
      (anomaly) =>
        anomaly.kind !== "frequencySwitch" &&
        anomaly.itemIndexes.includes(index),
    );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item, index) => (
            <ScheduleItemRow
              key={item.id}
              item={item}
              index={index}
              isFrequencySwitchPivot={index === frequencySwitchIndex}
              anomalies={anomaliesForItem(index)}
              createdDate={getCreatedDate(item)}
              succeeded={getSucceeded(item)}
              showCollections={reconciliation !== null}
              reconciliation={reconciliation?.get(item.id)}
              onStatusChange={onStatusChange}
              onShowBasisItem={onShowBasisItem}
              onShowReconciliation={onShowReconciliation}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
