import { AlertTriangle, ArrowRightLeft, Info } from "lucide-react";
import type { ScheduleAnomaly } from "../../utils/scheduleAnomalies";

/** Lists every Schedule Anomaly, warnings first; renders nothing when there are none. */
export default function AnomaliesPanel({
  anomalies,
}: {
  anomalies: ScheduleAnomaly[];
}) {
  if (anomalies.length === 0) return null;

  return (
    <section
      aria-label="Schedule Anomalies"
      className="mb-6 border border-gray-200 rounded-lg overflow-hidden"
    >
      <h3 className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-900 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        Schedule Anomalies ({anomalies.length})
      </h3>
      <ul className="divide-y divide-gray-200">
        {anomalies.map((anomaly) => (
          <AnomalyEntry
            key={anomaly.kind + anomaly.itemIndexes.join(",")}
            anomaly={anomaly}
          />
        ))}
      </ul>
    </section>
  );
}

/** The anomaly's icon: the switch arrows for a Frequency Switch, else by severity. */
function AnomalyIcon({ anomaly }: { anomaly: ScheduleAnomaly }) {
  if (anomaly.kind === "frequencySwitch") {
    return (
      <ArrowRightLeft className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-700" />
    );
  }
  return anomaly.severity === "warning" ? (
    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-700" />
  ) : (
    <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-700" />
  );
}

/** One anomaly: its title, severity and message, coloured by severity. Warnings are announced as alerts. */
function AnomalyEntry({ anomaly }: { anomaly: ScheduleAnomaly }) {
  const isWarning = anomaly.severity === "warning";
  return (
    <li
      role={isWarning ? "alert" : undefined}
      className={`p-3 flex items-start gap-2 ${isWarning ? "bg-red-50" : "bg-blue-50"}`}
    >
      <AnomalyIcon anomaly={anomaly} />
      <div className={`text-sm ${isWarning ? "text-red-900" : "text-blue-900"}`}>
        <p className="font-semibold">
          {anomaly.title}
          <span className="ml-2 text-xs font-medium uppercase opacity-70">
            {anomaly.severity}
          </span>
        </p>
        <p>{anomaly.message}</p>
      </div>
    </li>
  );
}
