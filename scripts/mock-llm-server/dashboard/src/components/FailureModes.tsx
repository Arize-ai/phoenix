import type { DynamicConfig, GlobalConfig, ErrorType } from "../types";
import { ERROR_TYPES } from "../types";
import { Toggle } from "./Toggle";

interface Props {
  config: DynamicConfig | null;
  onUpdate: (updates: Partial<GlobalConfig>) => void;
}

export function FailureModes({ config, onUpdate }: Props) {
  if (!config) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <h2 className="text-sm font-medium mb-2">Failure Injection</h2>
        <div className="text-gray-500 text-xs">Waiting for config...</div>
      </div>
    );
  }

  const { global } = config;
  const errorRate = global.errorRate;
  const errorTypes = global.errorTypes || [];
  const streamInterruptRate = global.streamInterruptRate || 0;
  const loadDegradationEnabled = global.loadDegradationEnabled || false;
  const loadDegradationFactor = global.loadDegradationFactor || 2.0;

  const toggleErrorType = (type: ErrorType) => {
    const newTypes = errorTypes.includes(type)
      ? errorTypes.filter((t) => t !== type)
      : [...errorTypes, type];
    onUpdate({ errorTypes: newTypes });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <h2 className="text-sm font-medium mb-2">Failure Injection</h2>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-gray-500">Error Rate</span>
            <span className="font-mono text-gray-300">
              {Math.round(errorRate * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={errorRate * 100}
            onChange={(e) =>
              onUpdate({ errorRate: Number(e.target.value) / 100 })
            }
            className="w-full h-1.5 bg-gray-700 rounded appearance-none cursor-pointer accent-red-500"
          />
        </div>

        {errorRate > 0 && (
          <div className="flex flex-wrap gap-1">
            {ERROR_TYPES.map(({ id, label }) => (
              <ErrorTypeButton
                key={id}
                label={label}
                active={errorTypes.includes(id)}
                onClick={() => toggleErrorType(id)}
              />
            ))}
          </div>
        )}

        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-gray-500">Stream Interrupt Rate</span>
            <span className="font-mono text-gray-300">
              {Math.round(streamInterruptRate * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={streamInterruptRate * 100}
            onChange={(e) =>
              onUpdate({ streamInterruptRate: Number(e.target.value) / 100 })
            }
            className="w-full h-1.5 bg-gray-700 rounded appearance-none cursor-pointer accent-orange-500"
          />
        </div>

        <div className="border-t border-gray-700 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Load Degradation</span>
            <Toggle
              enabled={loadDegradationEnabled}
              onChange={(enabled) =>
                onUpdate({ loadDegradationEnabled: enabled })
              }
              color="purple"
            />
          </div>
          {loadDegradationEnabled && (
            <div className="mt-1">
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-500">Max Slowdown Factor</span>
                <span className="font-mono text-gray-300">
                  {loadDegradationFactor.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={loadDegradationFactor}
                onChange={(e) =>
                  onUpdate({ loadDegradationFactor: Number(e.target.value) })
                }
                className="w-full h-1.5 bg-gray-700 rounded appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          )}
        </div>
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
      className={`px-1.5 py-0.5 rounded text-xs transition-colors ${active ? "bg-red-600 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
    >
      {label}
    </button>
  );
}
