import type { DynamicConfig, GlobalConfig } from "../types";

interface Props {
  config: DynamicConfig | null;
  onUpdate: (updates: Partial<GlobalConfig>) => void;
}

export function LatencyControls({ config, onUpdate }: Props) {
  if (!config) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <h2 className="text-sm font-medium mb-2">Latency Controls</h2>
        <div className="text-gray-500 text-xs">Waiting for config...</div>
      </div>
    );
  }

  const { global } = config;

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <h2 className="text-sm font-medium mb-2">Latency Controls</h2>
      <div className="space-y-2">
        <SliderControl label="Initial Delay" value={global.streamInitialDelayMs} min={0} max={5000} step={50} unit="ms" onChange={(value) => onUpdate({ streamInitialDelayMs: value })} />
        <SliderControl label="Chunk Delay" value={global.streamDelayMs} min={0} max={500} step={10} unit="ms" onChange={(value) => onUpdate({ streamDelayMs: value })} />
        <SliderControl label="Jitter" value={global.streamJitterMs} min={0} max={200} step={5} unit="ms" onChange={(value) => onUpdate({ streamJitterMs: value })} />
        <SliderControl label="Chunk Size" value={global.streamChunkSize} min={1} max={100} step={1} unit=" chars" onChange={(value) => onUpdate({ streamChunkSize: value })} />
      </div>
    </div>
  );
}

function SliderControl({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void; }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono text-gray-300">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded appearance-none cursor-pointer accent-blue-500" />
    </div>
  );
}
