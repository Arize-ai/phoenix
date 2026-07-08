import type { DynamicConfig, GlobalConfig } from "../types";
import { SliderControl } from "./SliderControl";

interface Props {
  config: DynamicConfig | null;
  onUpdate: (updates: Partial<GlobalConfig>) => void;
}

export function LatencyControls({ config, onUpdate }: Props) {
  if (!config) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
        <h2 className="mb-2 text-sm font-medium">Streaming Controls</h2>
        <div className="text-xs text-gray-500">Waiting for config...</div>
      </div>
    );
  }

  const { global } = config;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <h2 className="mb-2 text-sm font-medium">Streaming Controls</h2>
      <div className="space-y-2">
        <SliderControl
          label="Initial Delay"
          value={global.streamInitialDelayMs}
          min={0}
          max={5000}
          step={50}
          unit="ms"
          onChange={(value) => onUpdate({ streamInitialDelayMs: value })}
        />
        <SliderControl
          label="Chunk Delay"
          value={global.streamDelayMs}
          min={0}
          max={500}
          step={10}
          unit="ms"
          onChange={(value) => onUpdate({ streamDelayMs: value })}
        />
        <SliderControl
          label="Jitter"
          value={global.streamJitterMs}
          min={0}
          max={200}
          step={5}
          unit="ms"
          onChange={(value) => onUpdate({ streamJitterMs: value })}
        />
        <SliderControl
          label="Chunk Size"
          value={global.streamChunkSize}
          min={1}
          max={100}
          step={1}
          unit=" chars"
          onChange={(value) => onUpdate({ streamChunkSize: value })}
        />
        <SliderControl
          label="Tool Call Probability"
          value={global.toolCallProbability}
          min={0}
          max={1}
          step={0.01}
          unit="%"
          displayMultiplier={100}
          onChange={(value) => onUpdate({ toolCallProbability: value })}
        />
      </div>
    </div>
  );
}
