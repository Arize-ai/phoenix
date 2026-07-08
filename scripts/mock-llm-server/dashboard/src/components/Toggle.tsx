interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  color?: "yellow" | "purple" | "blue" | "green";
}

const colorClasses = {
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
};

export function Toggle({ enabled, onChange, color = "blue" }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative h-4 w-8 rounded-full transition-colors ${
        enabled ? colorClasses[color] : "bg-gray-600"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
