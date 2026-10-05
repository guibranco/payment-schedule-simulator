const LEGEND_ENTRIES = [
  { swatchClass: "bg-green-100", label: "Full Item" },
  { swatchClass: "bg-yellow-100", label: "Pro-Rata Item" },
  { swatchClass: "bg-orange-100", label: "Admin Fee Item" },
  { swatchClass: "bg-blue-100", label: "Refund Item" },
];

/** Explains the index-cell colours used for each kind of Schedule Item. */
export default function ScheduleLegend() {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-900 mb-2">Legend</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {LEGEND_ENTRIES.map(({ swatchClass, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${swatchClass}`} />
            <span className="text-sm text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
