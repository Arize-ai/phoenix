interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  accentColor?: "blue" | "yellow";
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
  onChange,
}: SliderControlProps) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono text-gray-300">
          {value}
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
        className={`w-full h-1.5 bg-gray-700 rounded appearance-none cursor-pointer ${accentColorClasses[accentColor]}`}
      />
    </div>
  );
}
