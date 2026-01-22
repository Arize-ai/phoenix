import type { DynamicConfig, GlobalConfig } from "../types";

interface Props {
  config: DynamicConfig | null;
  onUpdate: (updates: Partial<GlobalConfig>) => void;
}

export function ErrorInjection({ config, onUpdate }: Props) {
  if (!config) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Error Injection</h2>
        <div className="text-gray-500">Waiting for config...</div>
      </div>
    );
  }

  const { global } = config;
  const errorRate = global.errorRate;
  const errorTypes = global.errorTypes || [];

  const toggleErrorType = (type: "timeout" | "server_error" | "bad_request") => {
    const newTypes = errorTypes.includes(type)
      ? errorTypes.filter((t) => t !== type)
      : [...errorTypes, type];
    onUpdate({ errorTypes: newTypes });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-lg font-semibold mb-4">Error Injection</h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Error Rate</span>
            <span className="font-mono">{Math.round(errorRate * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={errorRate * 100}
            onChange={(e) => onUpdate({ errorRate: Number(e.target.value) / 100 })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>

        {errorRate > 0 && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Error Types</label>
            <div className="flex flex-wrap gap-2">
              <ErrorTypeButton
                label="Server Error (500)"
                active={errorTypes.includes("server_error")}
                onClick={() => toggleErrorType("server_error")}
              />
              <ErrorTypeButton
                label="Bad Request (400)"
                active={errorTypes.includes("bad_request")}
                onClick={() => toggleErrorType("bad_request")}
              />
              <ErrorTypeButton
                label="Timeout"
                active={errorTypes.includes("timeout")}
                onClick={() => toggleErrorType("timeout")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorTypeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-sm transition-colors ${
        active
          ? "bg-red-600 text-white"
          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
      }`}
    >
      {label}
    </button>
  );
}
