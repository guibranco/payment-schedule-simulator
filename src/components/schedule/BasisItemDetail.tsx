import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { ScheduleItem } from "../../types";
import { formatReportDate as formatDate } from "../../utils/scheduleReport";

/**
 * A Pro-Rata Item's Basis Item: where it sits relative to the schedule, and its fields.
 */
export default function BasisItemDetail({
  basisItem,
  scheduleItems,
}: {
  basisItem: ScheduleItem;
  scheduleItems: ScheduleItem[];
}) {
  const matchIndex = scheduleItems.findIndex((si) => si.id === basisItem.id);

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        {matchIndex >= 0 ? (
          <p>
            This matches schedule item <strong>#{matchIndex}</strong> in the
            table above.
          </p>
        ) : (
          <p>
            This item isn&apos;t part of the current schedule&apos;s items — it
            was likely generated on the fly by the Payment Schedule service to
            compute this adjustment, rather than being a persisted schedule
            item. This is the usual case for a Basis Item.
          </p>
        )}
      </div>
      <p className="text-xs text-gray-500">
        The full-period item this Pro-Rata Item&apos;s amount is calculated from
        (<code>originalItem</code> in the JSON).
      </p>
      <BasisItemFields item={basisItem} />
    </div>
  );
}

/** The Basis Item's fields as a two-column grid of labelled values. */
function BasisItemFields({ item }: { item: ScheduleItem }) {
  const taxes = Object.entries(item.taxesAndLevies || {});
  const fees = Object.entries(item.adminFees || {});

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <Field label="Id">
        <span className="break-all">{item.id}</span>
      </Field>
      <Field label="Collection Type">{item.collectionType}</Field>
      <Field label="Period">
        {formatDate(item.periodStartDate)} - {formatDate(item.periodEndDate)}
      </Field>
      <Field label="Due Date">{formatDate(item.dueDate)}</Field>
      <Field label="Net Amount">
        €{Number(item.netAmount ?? 0).toFixed(2)}
      </Field>
      <Field label="Amount Due">
        €{Number(item.amountDue ?? 0).toFixed(2)}
      </Field>
      <Field label="Taxes & Levies">
        {taxes.length > 0
          ? taxes.map(([key, value]) => (
              <span key={key} className="block">
                {key}: €{Number(value || 0).toFixed(2)}
              </span>
            ))
          : "-"}
      </Field>
      <Field label="Admin Fees">
        {fees.length > 0
          ? fees.map(([key, value]) => (
              <span key={key} className="block">
                {key}: €{Number(value.amountDue || 0).toFixed(2)}
              </span>
            ))
          : "-"}
      </Field>
      <Field label="Collection Item Created Date">
        {formatDate(item.collectionItemCreatedDate)}
      </Field>
      <Field label="Has Its Own Basis Item">
        {item.originalItem ? "Yes" : "No"}
      </Field>
    </div>
  );
}

/** A labelled value in the Basis Item grid. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-medium text-gray-500">{label}</h3>
      <p>{children}</p>
    </div>
  );
}
