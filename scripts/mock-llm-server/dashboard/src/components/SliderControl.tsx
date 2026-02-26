interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  accentColor?: "blue" | "yellow";
  displayMultiplier?: number; // Multiply displayed value (e.g., 100 for percentages)
  onChange: (value: number) => void;
}

const accentColorClasses = {
  blue: "accent-blue-500",
  yellow: "accent-yellow-500",
} as const;

export function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  accentColor = "blue",
  displayMultiplier = 1,
  onChange,
}: SliderControlProps) {
  const displayValue = value * displayMultiplier;
  // Format percentage values to whole numbers, others to reasonable precision
  const formattedValue =
    unit === "%"
      ? Math.round(displayValue)
      : displayValue % 1 === 0
        ? displayValue
        : displayValue.toFixed(1);
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono text-gray-300">
          {formattedValue}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-1.5 w-full cursor-pointer appearance-none rounded bg-gray-700 ${accentColorClasses[accentColor]}`}
      />
    </div>
  );
}
