import type { ReactNode } from "react";
import { Euro } from "lucide-react";
import type { PaymentScheduleResponse } from "../../types";
import { formatReportDate as formatDate } from "../../utils/scheduleReport";

/** The headline figures above the schedule table: total, collection day, cover period and ID. */
export default function ScheduleSummaryCards({
  schedule,
  totalAmount,
}: {
  schedule: PaymentScheduleResponse;
  totalAmount: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="p-4 bg-primary/10 rounded-lg">
        <h3 className="text-sm font-medium text-primary">Total Amount</h3>
        <p className="mt-2 flex items-center text-2xl font-semibold text-primary">
          <Euro className="w-5 h-5 mr-1" />
          {totalAmount.toFixed(2)}
        </p>
      </div>
      <SummaryCard title="Collection Day" large>
        {schedule.collectionFrequency === "annual" ? "-" : schedule.collectionDay}
      </SummaryCard>
      <SummaryCard title="Cover Period">
        {formatDate(schedule.coverStartDate)} -{" "}
        {formatDate(schedule.coverEndDate)}
      </SummaryCard>
      <SummaryCard title="Schedule ID" breakAll>
        {schedule.id}
      </SummaryCard>
    </div>
  );
}

/** A neutral summary card with a title and a value. */
function SummaryCard({
  title,
  large = false,
  breakAll = false,
  children,
}: {
  title: string;
  large?: boolean;
  breakAll?: boolean;
  children: ReactNode;
}) {
  const valueClass = large
    ? "mt-2 text-2xl font-semibold text-gray-900"
    : `mt-2 text-sm font-medium text-gray-900${breakAll ? " break-all" : ""}`;
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      <p className={valueClass}>{children}</p>
    </div>
  );
}
