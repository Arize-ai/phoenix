import type { EndpointConfig } from "../types";
import { SliderControl } from "./SliderControl";

interface Props {
  values: EndpointConfig | null;
  showResponseDelay: boolean;
  showStreaming: boolean;
  showToolCalls: boolean;
  onUpdate: (updates: Partial<EndpointConfig>) => void;
}

export function LatencyControls({
  values,
  showResponseDelay,
  showStreaming,
  showToolCalls,
  onUpdate,
}: Props) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] text-gray-500">Latency</h3>
      {!values ? (
        <div className="text-xs text-gray-500">Waiting for config...</div>
      ) : (
        <div
          className={
            showStreaming ? "grid grid-cols-2 gap-x-3 gap-y-1" : "space-y-1"
          }
        >
          {showResponseDelay && (
            <SliderControl
              label="Response Delay"
              value={values.responseDelayMs ?? 0}
              min={0}
              max={10000}
              step={50}
              unit="ms"
              onChange={(value) => onUpdate({ responseDelayMs: value })}
            />
          )}
          {showStreaming && (
            <>
              <SliderControl
                label="Initial Delay"
                value={values.streamInitialDelayMs}
                min={0}
                max={5000}
                step={50}
                unit="ms"
                onChange={(value) => onUpdate({ streamInitialDelayMs: value })}
              />
              <SliderControl
                label="Chunk Delay"
                value={values.streamDelayMs}
                min={0}
                max={500}
                step={10}
                unit="ms"
                onChange={(value) => onUpdate({ streamDelayMs: value })}
              />
              <SliderControl
                label="Jitter"
                value={values.streamJitterMs}
                min={0}
                max={200}
                step={5}
                unit="ms"
                onChange={(value) => onUpdate({ streamJitterMs: value })}
              />
              <SliderControl
                label="Chunk Size"
                value={values.streamChunkSize}
                min={1}
                max={100}
                step={1}
                unit=" chars"
                onChange={(value) => onUpdate({ streamChunkSize: value })}
              />
            </>
          )}
          {showToolCalls && (
            <SliderControl
              label="Tool Call Probability"
              value={values.toolCallProbability}
              min={0}
              max={1}
              step={0.01}
              unit="%"
              displayMultiplier={100}
              onChange={(value) => onUpdate({ toolCallProbability: value })}
            />
          )}
        </div>
      )}
    </div>
  );
}
