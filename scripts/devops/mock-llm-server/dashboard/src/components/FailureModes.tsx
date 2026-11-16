import type { EndpointConfig, ErrorType } from "../types";
import { ERROR_TYPES } from "../types";
import { Toggle } from "./Toggle";

interface Props {
  values: EndpointConfig | null;
  showStreaming: boolean;
  onUpdate: (updates: Partial<EndpointConfig>) => void;
}

export function FailureModes({ values, showStreaming, onUpdate }: Props) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] text-gray-500">Failure Injection</h3>
      {!values ? (
        <div className="text-xs text-gray-500">Waiting for config...</div>
      ) : (
        <FailureFields
          values={values}
          showStreaming={showStreaming}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

function FailureFields({
  values,
  showStreaming,
  onUpdate,
}: {
  values: EndpointConfig;
  showStreaming: boolean;
  onUpdate: (updates: Partial<EndpointConfig>) => void;
}) {
  const errorTypes = values.errorTypes || [];

  const toggleErrorType = (type: ErrorType) => {
    const next = errorTypes.includes(type)
      ? errorTypes.filter((item) => item !== type)
      : [...errorTypes, type];
    onUpdate({ errorTypes: next });
  };

  return (
    <div className="space-y-1">
      <div>
        <div className="flex justify-between text-[11px] leading-tight">
          <span className="text-gray-500">Error Rate</span>
          <span className="font-mono text-gray-300">
            {Math.round(values.errorRate * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={values.errorRate * 100}
          onChange={(event) =>
            onUpdate({ errorRate: Number(event.target.value) / 100 })
          }
          className="h-1 w-full cursor-pointer appearance-none rounded bg-gray-700 accent-red-500"
        />
      </div>

      {values.errorRate > 0 && (
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

      {showStreaming && (
        <>
          <div>
            <div className="flex justify-between text-[11px] leading-tight">
              <span className="text-gray-500">Stream Interrupt Rate</span>
              <span className="font-mono text-gray-300">
                {Math.round(values.streamInterruptRate * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={values.streamInterruptRate * 100}
              onChange={(event) =>
                onUpdate({
                  streamInterruptRate: Number(event.target.value) / 100,
                })
              }
              className="h-1 w-full cursor-pointer appearance-none rounded bg-gray-700 accent-orange-500"
            />
          </div>

          <div className="border-t border-gray-700 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Load Degradation</span>
              <Toggle
                enabled={values.loadDegradationEnabled}
                onChange={(enabled) =>
                  onUpdate({ loadDegradationEnabled: enabled })
                }
                color="purple"
              />
            </div>
            {values.loadDegradationEnabled && (
              <div className="mt-1">
                <div className="flex justify-between text-[11px] leading-tight">
                  <span className="text-gray-500">Max Slowdown Factor</span>
                  <span className="font-mono text-gray-300">
                    {values.loadDegradationFactor.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={values.loadDegradationFactor}
                  onChange={(event) =>
                    onUpdate({
                      loadDegradationFactor: Number(event.target.value),
                    })
                  }
                  className="h-1 w-full cursor-pointer appearance-none rounded bg-gray-700 accent-purple-500"
                />
              </div>
            )}
          </div>
        </>
      )}
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
      type="button"
      onClick={onClick}
      className={`rounded px-1 py-px text-[11px] leading-tight transition-colors ${active ? "bg-red-600 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
    >
      {label}
    </button>
  );
}
