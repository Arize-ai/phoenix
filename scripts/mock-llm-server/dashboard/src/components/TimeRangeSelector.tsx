import type { TimeRange } from "../utils/timeRange";

interface Props {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "5m", label: "5m" },
  { value: "30m", label: "30m" },
  { value: "60m", label: "60m" },
];

export function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 bg-gray-700/50 rounded p-0.5">
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            value === range.value
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-600"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
